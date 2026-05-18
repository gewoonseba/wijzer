import { randomUUID } from 'node:crypto';
import type { Clip, CreateClipInput } from '@wijzer/core';
import type { ClipRepository } from './clip-repository.js';

export class InMemoryClipRepository implements ClipRepository {
  private clips = new Map<string, Clip>();

  async create(input: CreateClipInput): Promise<Clip> {
    const clip: Clip = {
      id: randomUUID(),
      ...input,
      createdAt: new Date().toISOString(),
    };
    this.clips.set(clip.id, clip);
    return clip;
  }

  async list(): Promise<Clip[]> {
    return [...this.clips.values()].sort(
      (a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    );
  }

  async getById(id: string): Promise<Clip | null> {
    return this.clips.get(id) ?? null;
  }

  clear(): void {
    this.clips.clear();
  }
}
