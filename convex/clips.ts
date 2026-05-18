import { v } from 'convex/values';
import { mutation, query } from './_generated/server';
import { clipMetadata } from './validators';

export const list = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db
      .query('clips')
      .withIndex('by_createdAt')
      .order('desc')
      .collect();
  },
});

export const getByPublicId = query({
  args: { publicId: v.string() },
  handler: async (ctx, { publicId }) => {
    return await ctx.db
      .query('clips')
      .withIndex('by_publicId', (q) => q.eq('publicId', publicId))
      .first();
  },
});

export const create = mutation({
  args: {
    url: v.string(),
    finalUrl: v.string(),
    notes: v.string(),
    content: v.string(),
    metadata: clipMetadata,
  },
  handler: async (ctx, args) => {
    const publicId = crypto.randomUUID();
    const duplicate = await ctx.db
      .query('clips')
      .withIndex('by_publicId', (q) => q.eq('publicId', publicId))
      .first();
    if (duplicate) {
      throw new Error('Failed to allocate a unique clip id');
    }

    const createdAt = Date.now();
    const id = await ctx.db.insert('clips', {
      publicId,
      ...args,
      createdAt,
    });
    const doc = await ctx.db.get(id);
    if (!doc) {
      throw new Error('Clip insert failed');
    }
    return doc;
  },
});
