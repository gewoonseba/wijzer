import { ClipTimeoutError } from '@wijzer/core';

/**
 * Bounds clip creation wall-clock time. Uses Promise.race because not all
 * steps (e.g. some fetch/extractor paths) accept AbortSignal today.
 * Work may continue briefly after rejection; see docs/improvements.md.
 */
export function withClipTimeout<T>(
  operation: (signal: AbortSignal) => Promise<T>,
  timeoutMs: number,
): Promise<T> {
  const abortController = new AbortController();
  const { signal } = abortController;

  let timer: ReturnType<typeof setTimeout> | undefined;

  const timeoutPromise = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      abortController.abort();
      reject(new ClipTimeoutError());
    }, timeoutMs);
  });

  const work = operation(signal).finally(() => {
    if (timer !== undefined) clearTimeout(timer);
  });

  return Promise.race([work, timeoutPromise]);
}
