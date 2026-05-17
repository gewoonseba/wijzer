import { buildUrlHints, validateClipUrl } from '@wijzer/content';
import type { ClipMetadata, CreateClipInput } from '@wijzer/core';
import {
  clipAgentResultSchema,
  ExtractionError,
} from '@wijzer/core';
import { clipAgent } from './agents/clip-agent.js';
import { buildClipPrompt } from './build-clip-prompt.js';

const CLIP_TIMEOUT_MS = Number(process.env.WIJZER_CLIP_TIMEOUT_MS ?? 120_000);

export async function createClipFromUrl(input: {
  url: string;
  notes: string;
}): Promise<CreateClipInput> {
  const safeUrl = await validateClipUrl(input.url);
  const hints = buildUrlHints(safeUrl);

  const abortController = new AbortController();
  const timeout = setTimeout(() => abortController.abort(), CLIP_TIMEOUT_MS);

  try {
    const result = await clipAgent.generate({
      prompt: buildClipPrompt({
        url: safeUrl,
        notes: input.notes,
        hints,
      }),
      abortSignal: abortController.signal,
    });

    const parsed = clipAgentResultSchema.safeParse(result.output);
    if (!parsed.success) {
      throw new ExtractionError('Agent returned invalid structured output');
    }

    const { content, metadataPatch, deterministic } = parsed.data;

    if (!content.trim()) {
      throw new ExtractionError('Agent produced empty clip content');
    }

    const finalUrl = deterministic.finalUrl ?? safeUrl;

    const metadata: ClipMetadata = {
      ...metadataPatch,
      toolUsed: deterministic.toolUsed,
      thumbnail: deterministic.thumbnail,
    };

    return {
      url: input.url,
      finalUrl,
      notes: input.notes,
      content,
      metadata,
    };
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      const { ClipTimeoutError } = await import('@wijzer/core');
      throw new ClipTimeoutError();
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}
