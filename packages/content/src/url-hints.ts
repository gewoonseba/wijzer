import type { ClipKind, UrlHints } from '@wijzer/core';
import { assertSafeUrl } from './safe-fetch.js';

const YOUTUBE_HOSTS = new Set([
  'youtube.com',
  'www.youtube.com',
  'm.youtube.com',
  'youtu.be',
  'www.youtu.be',
]);

const ARTICLE_PATH_PATTERNS = [
  /\/blog\//i,
  /\/posts?\//i,
  /\/article\//i,
  /\/news\//i,
  /\/story\//i,
  /\/p\//i,
];

const ARTICLE_HOST_HINTS = [
  'medium.com',
  'substack.com',
  'dev.to',
  'hackernoon.com',
  'nytimes.com',
  'theguardian.com',
  'bbc.com',
  'bbc.co.uk',
  'reuters.com',
];

function getExtension(pathname: string): string | undefined {
  const match = /\.([a-z0-9]{1,8})$/i.exec(pathname);
  return match?.[1]?.toLowerCase();
}

function isYouTubeUrl(hostname: string, pathname: string): boolean {
  const host = hostname.replace(/^www\./, '');
  if (YOUTUBE_HOSTS.has(hostname) || YOUTUBE_HOSTS.has(host)) {
    return true;
  }
  return (
    host === 'youtube.com' &&
    (pathname.startsWith('/watch') ||
      pathname.startsWith('/shorts/') ||
      pathname.startsWith('/embed/'))
  );
}

function isArticleLike(hostname: string, pathname: string): boolean {
  const host = hostname.toLowerCase();
  if (ARTICLE_HOST_HINTS.some((h) => host === h || host.endsWith(`.${h}`))) {
    return true;
  }
  return ARTICLE_PATH_PATTERNS.some((p) => p.test(pathname));
}

export function buildUrlHints(urlString: string): UrlHints {
  const parsed = assertSafeUrl(urlString);
  const hostname = parsed.hostname.toLowerCase();
  const pathname = parsed.pathname;
  const extension = getExtension(pathname);
  const reasons: string[] = [];
  let likelyKind: ClipKind = 'unknown';

  if (isYouTubeUrl(hostname, pathname)) {
    likelyKind = 'youtube';
    reasons.push('hostname matches YouTube');
    if (pathname.includes('/shorts/')) {
      reasons.push('path looks like YouTube Shorts');
    }
  } else if (isArticleLike(hostname, pathname)) {
    likelyKind = 'article';
    reasons.push('hostname or path suggests an article or blog post');
  } else if (
    extension &&
    ['html', 'htm', 'php', 'asp', 'aspx'].includes(extension)
  ) {
    likelyKind = 'generic';
    reasons.push(`HTML-like extension: .${extension}`);
  } else if (pathname === '/' || pathname === '') {
    likelyKind = 'generic';
    reasons.push('homepage path — likely not a single article');
  } else {
    likelyKind = 'generic';
    reasons.push('no strong signal — defaulting to generic web page');
  }

  return {
    originalUrl: parsed.toString(),
    hostname,
    pathname,
    extension,
    likelyKind,
    reasons,
  };
}
