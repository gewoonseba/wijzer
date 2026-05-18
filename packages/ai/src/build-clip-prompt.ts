import type { UrlHints } from '@wijzer/core';

export function buildClipPrompt(input: {
  url: string;
  notes: string;
  hints: UrlHints;
}): string {
  const hintsBlock = JSON.stringify(input.hints, null, 2);
  return `Clip this URL for my personal library.

URL: ${input.url}

URL hints (non-authoritative, use tool evidence to decide):
${hintsBlock}

User notes (stored separately by the API — do NOT include in content):
${input.notes || '(none)'}

Choose the best tool, extract source material, then produce structured output with markdown content and honest metadata provenance.`;
}
