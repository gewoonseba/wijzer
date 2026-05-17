import type { ClipKind, UrlHints } from '@wijzer/core';

export type ExtractorName = 'clipYouTube' | 'clipArticle' | 'clipGenericUrl';

export function selectExtractorFromHints(hints: UrlHints): ExtractorName {
  switch (hints.likelyKind) {
    case 'youtube':
      return 'clipYouTube';
    case 'article':
      return 'clipArticle';
    default:
      return 'clipGenericUrl';
  }
}

export function fallbackExtractor(
  primary: ExtractorName,
): ExtractorName | null {
  if (primary === 'clipYouTube') return 'clipGenericUrl';
  if (primary === 'clipArticle') return 'clipGenericUrl';
  return null;
}

export function kindFromExtractor(name: ExtractorName): ClipKind {
  switch (name) {
    case 'clipYouTube':
      return 'youtube';
    case 'clipArticle':
      return 'article';
    default:
      return 'generic';
  }
}
