import { extractYouTube } from '@wijzer/content';
import { tool } from 'ai';
import { z } from 'zod';

export const clipYouTubeTool = tool({
  description:
    'Extract YouTube video metadata and transcript/captions. Use for youtube.com, youtu.be, and YouTube shorts URLs.',
  inputSchema: z.object({
    url: z.string().url().describe('YouTube video URL'),
  }),
  execute: async ({ url }) => {
    const data = await extractYouTube(url);
    return {
      toolName: 'clipYouTube' as const,
      usable: data.transcriptAvailable,
      quality: data.quality,
      finalUrl: data.finalUrl,
      thumbnail: data.thumbnail,
      videoId: data.videoId,
      title: data.title,
      channel: data.channel,
      transcript: data.transcript,
      transcriptAvailable: data.transcriptAvailable,
      truncated: data.truncated,
      warnings: data.warnings,
      unusableReason: data.transcriptAvailable
        ? undefined
        : 'No captions/transcript available for this video',
    };
  },
});
