import { clipAgentResultSchema } from '@wijzer/core';
import { Output, ToolLoopAgent, stepCountIs } from 'ai';
import { clipArticleTool } from '../tools/clip-article.js';
import { clipGenericUrlTool } from '../tools/clip-generic-url.js';
import { clipYouTubeTool } from '../tools/clip-youtube.js';

const CLIP_MODEL = process.env.WIJZER_CLIP_MODEL ?? 'anthropic/claude-sonnet-4.5';

export const clipAgent = new ToolLoopAgent({
  model: CLIP_MODEL,
  instructions: `You are Wijzer, a personal clipping agent. You clip one URL at a time for a knowledge library.

Rules:
- Use URL hints to choose the best extraction tool.
- Call exactly ONE primary tool first.
- If that tool returns usable: false or very low quality, you may call ONE fallback tool.
- Never call more than two tools total.
- Do not invent quotes or timestamps.
- User notes are for context only — never copy them into content.
- For metadata fields: mark source as "extracted" when from tool output, "inferred" when you deduce from page text, "unknown" only if you must still provide a placeholder title.
- Prefer omitting author/siteName over inventing them.
- Write content as markdown with: Overview, Key points (bullets), Highlights (if any), Who it is for (brief).
- Set deterministic.toolUsed to the tool that provided the main source material.
- Set deterministic.finalUrl and deterministic.thumbnail from tool output when available.`,
  tools: {
    clipYouTube: clipYouTubeTool,
    clipArticle: clipArticleTool,
    clipGenericUrl: clipGenericUrlTool,
  },
  toolChoice: 'auto',
  stopWhen: stepCountIs(6),
  output: Output.object({
    schema: clipAgentResultSchema,
  }),
});

export type ClipAgent = typeof clipAgent;
