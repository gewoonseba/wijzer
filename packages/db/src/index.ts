import { FileClipRepository } from './file-clip-repository.js';
import type { ClipRepository } from './clip-repository.js';

export * from './clip-repository.js';
export * from './convex-clip-map.js';
export * from './file-clip-repository.js';
export * from './in-memory-clip-repository.js';

let defaultRepository: ClipRepository | null = null;

export function getClipRepository(): ClipRepository {
  if (!defaultRepository) {
    defaultRepository = new FileClipRepository(FileClipRepository.defaultPath());
  }
  return defaultRepository;
}

export function setClipRepository(repository: ClipRepository): void {
  defaultRepository = repository;
}
