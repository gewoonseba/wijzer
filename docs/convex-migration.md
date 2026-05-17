# Convex migration guide

MVP stores clips in a JSON file via `FileClipRepository`. This document describes moving to [Convex](https://convex.dev) without changing the public API or `Clip` type in `@wijzer/core`.

## Target schema

```ts
// convex/schema.ts (future)
import { defineSchema, defineTable } from 'convex/server';
import { v } from 'convex/values';

export default defineSchema({
  clips: defineTable({
    url: v.string(),
    finalUrl: v.optional(v.string()),
    notes: v.string(),
    content: v.string(),
    metadata: v.object({
      kind: v.string(),
      title: v.object({
        value: v.string(),
        source: v.string(), // extracted | inferred | unknown
      }),
      author: v.optional(
        v.object({
          value: v.string(),
          source: v.string(),
        }),
      ),
      siteName: v.optional(
        v.object({
          value: v.string(),
          source: v.string(),
        }),
      ),
      thumbnail: v.optional(v.string()),
      toolUsed: v.string(),
      extractionQuality: v.string(),
      confidence: v.object({
        kind: v.number(),
        title: v.number(),
        author: v.optional(v.number()),
      }),
      warnings: v.array(v.string()),
    }),
    createdAt: v.number(),
  }).index('by_createdAt', ['createdAt']),
});
```

## Repository adapter

Create `packages/db/src/convex-clip-repository.ts` (or `packages/db-convex`):

```ts
export class ConvexClipRepository implements ClipRepository {
  constructor(private client: ConvexHttpClient) {}

  async create(input: CreateClipInput): Promise<Clip> {
    const id = await this.client.mutation(api.clips.create, {
      ...input,
      createdAt: Date.now(),
    });
    return { id, ...input, createdAt: new Date(createdAt).toISOString() };
  }
  // list, getById via queries
}
```

## Wiring in `apps/web`

```ts
// packages/db/src/index.ts
export function getClipRepository(): ClipRepository {
  if (process.env.CLIP_STORE === 'convex') {
    return new ConvexClipRepository(/* … */);
  }
  return new FileClipRepository(FileClipRepository.defaultPath());
}
```

## Migration steps

1. Add `convex/` project and deploy schema.
2. Implement `convex/clips.ts` mutations/queries matching `ClipRepository`.
3. One-time script: read `.data/clips.json` and insert into Convex.
4. Set `CLIP_STORE=convex` and `CONVEX_URL` in production.
5. Remove file store from production; keep file adapter for local offline dev if desired.

## Auth (later)

When clips should be per-user, add Convex auth and a `userId` field + index `by_user_createdAt`. The clip API gains session checks; `clipAgent` pipeline stays unchanged.
