import { Readability } from '@mozilla/readability';
import type { ExtractionQuality } from '@wijzer/core';
import { parseHTML } from 'linkedom';
import { MAX_GENERIC_CHARS } from './constants.js';
import { safeFetch } from './safe-fetch.js';

export type GenericPageExtraction = {
  title: string;
  description?: string;
  headings: string[];
  textContent: string;
  finalUrl: string;
  quality: ExtractionQuality;
  warnings: string[];
};

function truncateText(text: string, max: number): string {
  const normalized = text.replace(/\s+/g, ' ').trim();
  return normalized.length <= max ? normalized : normalized.slice(0, max);
}

export async function extractGenericPage(
  urlString: string,
): Promise<GenericPageExtraction> {
  const { html, finalUrl } = await safeFetch(urlString);
  const warnings: string[] = [];
  const { document } = parseHTML(html);

  const title =
    document.querySelector('title')?.textContent?.trim() || 'Untitled page';

  const description =
    document
      .querySelector('meta[name="description"]')
      ?.getAttribute('content')
      ?.trim() || undefined;

  const headings = Array.from(document.querySelectorAll('h1, h2, h3'))
    .map((el) => el.textContent?.trim())
    .filter((t): t is string => Boolean(t))
    .slice(0, 20);

  let textContent = '';
  const reader = new Readability(document);
  const article = reader.parse();
  if (article?.textContent?.trim()) {
    textContent = article.textContent.trim();
  } else {
    warnings.push('Readability weak; using simplified visible text');
    textContent = document.body?.textContent?.trim() ?? '';
  }

  textContent = truncateText(textContent, MAX_GENERIC_CHARS);
  if (textContent.length >= MAX_GENERIC_CHARS) {
    warnings.push('Page text was truncated for model safety');
  }

  const quality: ExtractionQuality =
    textContent.length > 1200 ? 'high' : textContent.length > 300 ? 'medium' : 'low';

  return {
    title,
    description,
    headings,
    textContent,
    finalUrl,
    quality,
    warnings,
  };
}
