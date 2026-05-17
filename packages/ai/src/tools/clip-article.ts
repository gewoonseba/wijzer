import { extractArticle } from '@wijzer/content';
import { tool } from 'ai';
import { z } from 'zod';

export const clipArticleTool = tool({
  description:
    'Extract main article content from a blog post, news article, or long-form web page using readability parsing.',
  inputSchema: z.object({
    url: z.string().url().describe('Article URL'),
  }),
  execute: async ({ url }) => {
    const data = await extractArticle(url);
    const usable = data.textContent.trim().length > 80;
    return {
      toolName: 'clipArticle' as const,
      usable,
      quality: data.quality,
      finalUrl: data.finalUrl,
      title: data.title,
      byline: data.byline,
      siteName: data.siteName,
      excerpt: data.excerpt,
      textContent: data.textContent,
      warnings: data.warnings,
      unusableReason: usable
        ? undefined
        : 'Could not extract enough article text from this page',
    };
  },
});
