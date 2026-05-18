import { v } from 'convex/values';
import { internalMutation } from './_generated/server';
import { clipFields } from './validators';

/** One-time import from .data/clips.json (scripts/import-clips-to-convex.mjs). */
export const importClip = internalMutation({
  args: {
    clip: v.object(clipFields),
  },
  handler: async (ctx, { clip }) => {
    const existing = await ctx.db
      .query('clips')
      .withIndex('by_publicId', (q) => q.eq('publicId', clip.publicId))
      .first();
    if (existing) {
      return existing._id;
    }
    return await ctx.db.insert('clips', clip);
  },
});
