import { v } from 'convex/values';

/** Keep in sync with @wijzer/core Zod enums (clipMetadataSchema, etc.). */
export const provenanceSource = v.union(
  v.literal('extracted'),
  v.literal('inferred'),
  v.literal('unknown'),
);

export const clipKind = v.union(
  v.literal('youtube'),
  v.literal('article'),
  v.literal('generic'),
  v.literal('unknown'),
);

export const extractionQuality = v.union(
  v.literal('high'),
  v.literal('medium'),
  v.literal('low'),
);

export const provenanceField = v.object({
  value: v.string(),
  source: provenanceSource,
});

export const clipMetadata = v.object({
  kind: clipKind,
  title: provenanceField,
  author: v.optional(provenanceField),
  siteName: v.optional(provenanceField),
  thumbnail: v.optional(v.string()),
  toolUsed: v.string(),
  extractionQuality,
  confidence: v.object({
    kind: v.number(),
    title: v.number(),
    author: v.optional(v.number()),
  }),
  warnings: v.array(v.string()),
});

export const clipFields = {
  publicId: v.string(),
  url: v.string(),
  finalUrl: v.string(),
  notes: v.string(),
  content: v.string(),
  metadata: clipMetadata,
  createdAt: v.number(),
};
