import { extractGenericPage } from '@wijzer/content';
import { tool } from 'ai';
import { z } from 'zod';

export const clipGenericUrlTool = tool({
  description:
    'Fallback extractor for generic web pages: product pages, docs, marketing sites, homepages, and unknown URLs.',
  inputSchema: z.object({
    url: z.string().url().describe('Web page URL'),
  }),
  execute: async ({ url }) => {
    const data = await extractGenericPage(url);
    const usable = data.textContent.trim().length > 80;
    return {
      toolName: 'clipGenericUrl' as const,
      usable,
      quality: data.quality,
      finalUrl: data.finalUrl,
      title: data.title,
      description: data.description,
      headings: data.headings,
      textContent: data.textContent,
      warnings: data.warnings,
      unusableReason: usable
        ? undefined
        : 'Could not extract enough visible text from this page',
    };
  },
});
