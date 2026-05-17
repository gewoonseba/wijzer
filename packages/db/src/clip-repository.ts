import type { Clip, CreateClipInput } from '@wijzer/core';

export interface ClipRepository {
  create(input: CreateClipInput): Promise<Clip>;
  list(): Promise<Clip[]>;
  getById(id: string): Promise<Clip | null>;
}
