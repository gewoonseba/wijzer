import { Readability } from '@mozilla/readability';
import type { ExtractionQuality } from '@wijzer/core';
import { parseHTML } from 'linkedom';
import { MAX_ARTICLE_CHARS } from './constants.js';
import { safeFetch } from './safe-fetch.js';

export type ArticleExtraction = {
  title: string;
  byline?: string;
  siteName?: string;
  excerpt?: string;
  textContent: string;
  finalUrl: string;
  quality: ExtractionQuality;
  warnings: string[];
};

function truncateText(text: string, max: number): { text: string; truncated: boolean } {
  const normalized = text.replace(/\s+/g, ' ').trim();
  if (normalized.length <= max) {
    return { text: normalized, truncated: false };
  }
  return { text: normalized.slice(0, max), truncated: true };
}

function scoreQuality(textLength: number, hasTitle: boolean): ExtractionQuality {
  if (textLength > 1500 && hasTitle) return 'high';
  if (textLength > 400) return 'medium';
  return 'low';
}

export async function extractArticle(urlString: string): Promise<ArticleExtraction> {
  const { html, finalUrl } = await safeFetch(urlString);
  const warnings: string[] = [];

  const { document } = parseHTML(html);
  const reader = new Readability(document);
  const article = reader.parse();

  const title =
    article?.title?.trim() ||
    document.querySelector('title')?.textContent?.trim() ||
    'Untitled page';

  const byline = article?.byline?.trim() || undefined;
  const siteName = article?.siteName?.trim() || undefined;
  const excerpt = article?.excerpt?.trim() || undefined;

  let textContent = article?.textContent?.trim() ?? '';
  if (!textContent) {
    warnings.push('Readability could not extract main article text');
    textContent =
      document.querySelector('main')?.textContent?.trim() ||
      document.body?.textContent?.trim() ||
      '';
  }

  const { text: truncatedText, truncated } = truncateText(
    textContent,
    MAX_ARTICLE_CHARS,
  );
  if (truncated) {
    warnings.push('Article text was truncated for model safety');
  }

  const quality = scoreQuality(truncatedText.length, Boolean(title));

  return {
    title,
    byline,
    siteName,
    excerpt,
    textContent: truncatedText,
    finalUrl,
    quality,
    warnings,
  };
}
