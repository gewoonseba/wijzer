import type { ExtractorResult } from './run-extractor.js';

function sentences(text: string, limit = 6): string[] {
  return text
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 20)
    .slice(0, limit);
}

export function summarizeEvidenceLocally(
  evidence: ExtractorResult,
): string {
  const title =
    'title' in evidence && typeof evidence.title === 'string'
      ? evidence.title
      : 'Saved page';

  const body =
    'transcript' in evidence && evidence.transcript
      ? evidence.transcript
      : 'textContent' in evidence && evidence.textContent
        ? evidence.textContent
        : '';

  const overview = body.slice(0, 400).trim() || `Clipped: ${title}`;
  const points = sentences(body);

  const highlights =
    'headings' in evidence && evidence.headings?.length
      ? evidence.headings.slice(0, 5).map((h) => `- ${h}`).join('\n')
      : points.length
        ? points.map((p) => `- ${p}`).join('\n')
        : '- (No detailed text extracted)';

  return `## Overview

${overview}${body.length > 400 ? '…' : ''}

## Key points

${highlights}

## Who it is for

Anyone revisiting **${title}** from their personal link library.`;
}
