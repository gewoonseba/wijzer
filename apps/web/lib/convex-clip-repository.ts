import type { Clip, CreateClipInput } from '@wijzer/core';
import { clipDocToClip, type ConvexClipDoc } from '@wijzer/db/convex-clip-map';
import { ConvexHttpClient } from 'convex/browser';
import { api } from '../../../convex/_generated/api';
import type { ClipRepository } from '@wijzer/db';

export class ConvexClipRepository implements ClipRepository {
  constructor(private readonly client: ConvexHttpClient) {}

  static fromEnv(): ConvexClipRepository {
    const url =
      process.env.CONVEX_URL ?? process.env.NEXT_PUBLIC_CONVEX_URL ?? '';
    if (!url) {
      throw new Error(
        'CLIP_STORE=convex requires CONVEX_URL or NEXT_PUBLIC_CONVEX_URL',
      );
    }
    return new ConvexClipRepository(new ConvexHttpClient(url));
  }

  async create(input: CreateClipInput): Promise<Clip> {
    const doc = (await this.client.mutation(api.clips.create, input)) as ConvexClipDoc;
    return clipDocToClip(doc);
  }

  async list(): Promise<Clip[]> {
    const docs = (await this.client.query(api.clips.list, {})) as ConvexClipDoc[];
    return docs.map(clipDocToClip);
  }

  async getById(id: string): Promise<Clip | null> {
    const doc = (await this.client.query(api.clips.getByPublicId, {
      publicId: id,
    })) as ConvexClipDoc | null;
    return doc ? clipDocToClip(doc) : null;
  }
}
