import { clipAgentResultSchema } from '@wijzer/core';
import { generateText, Output } from 'ai';
import type { ExtractorName } from './select-extractor.js';
import type { ExtractorResult } from './run-extractor.js';

const CLIP_MODEL = process.env.WIJZER_CLIP_MODEL ?? 'anthropic/claude-sonnet-4.5';

export async function summarizeEvidenceWithGateway(input: {
  url: string;
  notes: string;
  toolUsed: ExtractorName;
  evidence: ExtractorResult;
  abortSignal?: AbortSignal;
}) {
  const { output } = await generateText({
    model: CLIP_MODEL,
    output: Output.object({ schema: clipAgentResultSchema }),
    abortSignal: input.abortSignal,
    prompt: `You are Wijzer, a personal clipping assistant.

Create a markdown clip summary from the extraction evidence below.
User notes are for context only — do NOT copy them into content.
Mark metadata as extracted when from evidence; inferred only if clearly deducible; otherwise unknown.
Set deterministic.toolUsed to "${input.toolUsed}".
Include deterministic.finalUrl and deterministic.thumbnail when present in evidence.

URL: ${input.url}
User notes (context only):
${input.notes || '(none)'}

Extraction evidence (JSON):
${JSON.stringify(input.evidence, null, 2)}`,
  });

  if (!output) {
    throw new Error('Model returned no structured clip output');
  }

  return output;
}
