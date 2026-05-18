import { GatewayError } from '@ai-sdk/gateway';
import { buildUrlHints, validateClipUrl } from '@wijzer/content';
import type { ClipMetadata, CreateClipInput } from '@wijzer/core';
import {
  clipAgentResultSchema,
  ExtractionError,
} from '@wijzer/core';
import { clipAgent } from './agents/clip-agent.js';
import { buildClipPrompt } from './build-clip-prompt.js';
import { withClipTimeout } from './clip-timeout.js';
import { summarizeEvidenceLocally } from './local-summarize.js';
import {
  fallbackExtractor,
  kindFromExtractor,
  selectExtractorFromHints,
} from './select-extractor.js';
import { runExtractor } from './run-extractor.js';
import { summarizeEvidenceWithGateway } from './summarize-with-gateway.js';

const CLIP_TIMEOUT_MS = Number(process.env.WIJZER_CLIP_TIMEOUT_MS ?? 120_000);
const USE_AGENT = process.env.WIJZER_USE_AGENT === 'true';

function hasGatewayKey(): boolean {
  return Boolean(process.env.AI_GATEWAY_API_KEY?.trim());
}

function buildMetadataFromEvidence(
  evidence: Awaited<ReturnType<typeof runExtractor>>,
  toolUsed: string,
  content: string,
  usedLocalSummary: boolean,
  localSummaryNotice?: string,
): ClipMetadata {
  const titleValue =
    'title' in evidence && typeof evidence.title === 'string'
      ? evidence.title
      : 'Untitled';

  const authorValue =
    'channel' in evidence && evidence.channel
      ? evidence.channel
      : 'byline' in evidence && evidence.byline
        ? evidence.byline
        : undefined;

  const siteNameValue =
    'siteName' in evidence && evidence.siteName ? evidence.siteName : undefined;

  const warnings = [...(evidence.warnings ?? [])];
  if (usedLocalSummary) {
    warnings.push(
      localSummaryNotice ??
        'Summary generated locally (no AI_GATEWAY_API_KEY). Add a gateway key for AI summaries.',
    );
  }

  return {
    kind: kindFromExtractor(
      toolUsed as 'clipYouTube' | 'clipArticle' | 'clipGenericUrl',
    ),
    title: { value: titleValue, source: 'extracted' },
    author: authorValue
      ? { value: authorValue, source: 'extracted' }
      : undefined,
    siteName: siteNameValue
      ? { value: siteNameValue, source: 'extracted' }
      : undefined,
    thumbnail:
      'thumbnail' in evidence && evidence.thumbnail
        ? evidence.thumbnail
        : undefined,
    toolUsed,
    extractionQuality: evidence.quality,
    confidence: {
      kind: 0.85,
      title: 0.9,
      author: authorValue ? 0.8 : undefined,
    },
    warnings,
  };
}

type DeterministicOptions = {
  /** When set (e.g. agent path already hit a gateway failure), skip a second gateway call */
  skipAiGateway?: boolean;
  /** Shown in metadata when forcing a local summary despite a gateway API key */
  gatewayFallbackHint?: string;
};

async function createClipDeterministic(
  input: {
    url: string;
    notes: string;
    safeUrl: string;
  },
  signal: AbortSignal,
  opts?: DeterministicOptions,
): Promise<CreateClipInput> {
  const hints = buildUrlHints(input.safeUrl);
  let tool = selectExtractorFromHints(hints);
  let evidence = await runExtractor(tool, input.safeUrl);

  if (!evidence.usable) {
    const alt = fallbackExtractor(tool);
    if (alt && tool !== 'clipYouTube') {
      const altEvidence = await runExtractor(alt, input.safeUrl);
      if (altEvidence.usable) {
        tool = alt;
        evidence = altEvidence;
      }
    }
  }

  if (!evidence.usable) {
    throw new ExtractionError(
      evidence.unusableReason ?? 'Could not extract usable content from this URL',
    );
  }

  const finalUrl = evidence.finalUrl ?? input.safeUrl;
  let content: string;
  let metadata: ClipMetadata;
  let usedLocalSummary = false;

  const tryGateway = hasGatewayKey() && !opts?.skipAiGateway;

  if (tryGateway) {
    try {
      const result = await summarizeEvidenceWithGateway({
        url: input.url,
        notes: input.notes,
        toolUsed: tool,
        evidence,
        abortSignal: signal,
      });
      content = result.content;
      metadata = {
        ...result.metadataPatch,
        toolUsed: result.deterministic.toolUsed,
        thumbnail: result.deterministic.thumbnail,
      };
    } catch (err) {
      if (!GatewayError.isInstance(err)) {
        throw err;
      }
      usedLocalSummary = true;
      content = summarizeEvidenceLocally(evidence);
      const notice =
        opts?.gatewayFallbackHint ??
        `Summary generated locally (AI Gateway error: ${err.message})`;
      metadata = buildMetadataFromEvidence(
        evidence,
        tool,
        content,
        usedLocalSummary,
        notice,
      );
    }
  } else {
    usedLocalSummary = true;
    content = summarizeEvidenceLocally(evidence);
    metadata = buildMetadataFromEvidence(
      evidence,
      tool,
      content,
      usedLocalSummary,
      opts?.gatewayFallbackHint,
    );
  }

  if (!content.trim()) {
    throw new ExtractionError('Clip content is empty after summarization');
  }

  return {
    url: input.url,
    finalUrl,
    notes: input.notes,
    content,
    metadata,
  };
}

async function createClipWithAgent(
  input: {
    url: string;
    notes: string;
    safeUrl: string;
  },
  signal: AbortSignal,
): Promise<CreateClipInput> {
  const hints = buildUrlHints(input.safeUrl);
  const result = await clipAgent.generate({
    prompt: buildClipPrompt({
      url: input.safeUrl,
      notes: input.notes,
      hints,
    }),
    abortSignal: signal,
  });

  const parsed = clipAgentResultSchema.safeParse(result.output);
  if (!parsed.success) {
    throw new ExtractionError('Agent returned invalid structured output');
  }

  const { content, metadataPatch, deterministic } = parsed.data;
  if (!content.trim()) {
    throw new ExtractionError('Agent produced empty clip content');
  }

  const metadata: ClipMetadata = {
    ...metadataPatch,
    toolUsed: deterministic.toolUsed,
    thumbnail: deterministic.thumbnail,
  };

  return {
    url: input.url,
    finalUrl: deterministic.finalUrl ?? input.safeUrl,
    notes: input.notes,
    content,
    metadata,
  };
}

async function createClipFromUrlInner(
  input: { url: string; notes: string },
  signal: AbortSignal,
): Promise<CreateClipInput> {
  const safeUrl = await validateClipUrl(input.url);

  if (USE_AGENT && hasGatewayKey()) {
    try {
      return await createClipWithAgent({ ...input, safeUrl }, signal);
    } catch (err) {
      if (!GatewayError.isInstance(err)) {
        throw err;
      }
      return createClipDeterministic({ ...input, safeUrl }, signal, {
        skipAiGateway: true,
        gatewayFallbackHint: `Agent could not reach AI Gateway (${err.message}). Used local extraction and a non-AI summary instead.`,
      });
    }
  }
  return createClipDeterministic({ ...input, safeUrl }, signal);
}

export async function createClipFromUrl(input: {
  url: string;
  notes: string;
}): Promise<CreateClipInput> {
  return withClipTimeout(
    (signal) => createClipFromUrlInner(input, signal),
    CLIP_TIMEOUT_MS,
  );
}
