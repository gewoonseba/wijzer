import type { ClipRepository } from '@wijzer/db';
import { getClipRepository as getFileClipRepository } from '@wijzer/db';
import { ConvexClipRepository } from '@/lib/convex-clip-repository';

let repository: ClipRepository | null = null;

export function getClipRepository(): ClipRepository {
  if (!repository) {
    if (process.env.CLIP_STORE === 'convex') {
      repository = ConvexClipRepository.fromEnv();
    } else {
      repository = getFileClipRepository();
    }
  }
  return repository;
}
