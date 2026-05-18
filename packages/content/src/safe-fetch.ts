import {
  InvalidUrlError,
  UnsupportedContentTypeError,
  UpstreamFetchError,
} from '@wijzer/core';
import {
  ALLOWED_CONTENT_TYPES,
  FETCH_TIMEOUT_MS,
  MAX_REDIRECTS,
  MAX_RESPONSE_BYTES,
  USER_AGENT,
} from './constants.js';

function isPrivateOrBlockedHost(hostname: string): boolean {
  const host = hostname.toLowerCase().replace(/\.$/, '');
  if (
    host === 'localhost' ||
    host.endsWith('.localhost') ||
    host === '127.0.0.1' ||
    host === '0.0.0.0' ||
    host === '::1' ||
    host === '[::1]'
  ) {
    return true;
  }
  if (host.endsWith('.local') || host.endsWith('.internal')) {
    return true;
  }

  const ipv4Match = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(host);
  if (ipv4Match) {
    const a = Number(ipv4Match[1]);
    const b = Number(ipv4Match[2]);
    if (a === 10) return true;
    if (a === 127) return true;
    if (a === 0) return true;
    if (a === 169 && b === 254) return true;
    if (a === 192 && b === 168) return true;
    if (a === 172 && b >= 16 && b <= 31) return true;
    if (a === 100 && b >= 64 && b <= 127) return true;
  }

  return false;
}

export function assertSafeUrl(urlString: string): URL {
  let parsed: URL;
  try {
    parsed = new URL(urlString);
  } catch {
    throw new InvalidUrlError('URL is not valid');
  }

  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new InvalidUrlError('Only http and https URLs are allowed');
  }

  if (isPrivateOrBlockedHost(parsed.hostname)) {
    throw new InvalidUrlError('URL points to a blocked host');
  }

  return parsed;
}

export async function validateClipUrl(urlString: string): Promise<string> {
  const parsed = assertSafeUrl(urlString);
  return parsed.toString();
}

function isAllowedContentType(contentType: string | null): boolean {
  if (!contentType) return true;
  const base = contentType.split(';')[0]?.trim().toLowerCase() ?? '';
  return ALLOWED_CONTENT_TYPES.some(
    (allowed) => base === allowed || base.startsWith(`${allowed};`),
  );
}

export type SafeFetchResult = {
  finalUrl: string;
  html: string;
  contentType: string | null;
};

export async function safeFetch(urlString: string): Promise<SafeFetchResult> {
  let currentUrl = assertSafeUrl(urlString).toString();

  for (let redirect = 0; redirect <= MAX_REDIRECTS; redirect++) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

    try {
      const response = await fetch(currentUrl, {
        signal: controller.signal,
        redirect: 'manual',
        headers: {
          'User-Agent': USER_AGENT,
          Accept: 'text/html,application/xhtml+xml,text/plain;q=0.9,*/*;q=0.8',
        },
      });

      if (response.status >= 300 && response.status < 400) {
        const location = response.headers.get('location');
        if (!location) {
          throw new UpstreamFetchError('Redirect without location header');
        }
        const next = new URL(location, currentUrl);
        assertSafeUrl(next.toString());
        currentUrl = next.toString();
        continue;
      }

      if (!response.ok) {
        throw new UpstreamFetchError(
          `HTTP ${response.status} fetching ${currentUrl}`,
        );
      }

      const contentType = response.headers.get('content-type');
      if (!isAllowedContentType(contentType)) {
        throw new UnsupportedContentTypeError(
          `Content type not allowed: ${contentType ?? 'unknown'}`,
        );
      }

      const reader = response.body?.getReader();
      if (!reader) {
        throw new UpstreamFetchError('Empty response body');
      }

      const chunks: Uint8Array[] = [];
      let total = 0;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        total += value.byteLength;
        if (total > MAX_RESPONSE_BYTES) {
          throw new UpstreamFetchError('Response exceeds maximum size');
        }
        chunks.push(value);
      }

      const html = new TextDecoder('utf-8', { fatal: false }).decode(
        concatUint8Arrays(chunks),
      );

      return {
        finalUrl: currentUrl,
        html,
        contentType,
      };
    } catch (error) {
      if (error instanceof InvalidUrlError || error instanceof UnsupportedContentTypeError) {
        throw error;
      }
      if (error instanceof UpstreamFetchError) {
        throw error;
      }
      if (error instanceof Error && error.name === 'AbortError') {
        throw new UpstreamFetchError('Request timed out');
      }
      throw new UpstreamFetchError(
        error instanceof Error ? error.message : 'Fetch failed',
      );
    } finally {
      clearTimeout(timeout);
    }
  }

  throw new UpstreamFetchError('Too many redirects');
}

function concatUint8Arrays(chunks: Uint8Array[]): Uint8Array {
  const length = chunks.reduce((sum, c) => sum + c.byteLength, 0);
  const out = new Uint8Array(length);
  let offset = 0;
  for (const chunk of chunks) {
    out.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return out;
}
