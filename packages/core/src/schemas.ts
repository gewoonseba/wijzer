import { z } from 'zod';

export const provenanceSchema = z.enum(['extracted', 'inferred', 'unknown']);

export const provenanceFieldSchema = z.object({
  value: z.string(),
  source: provenanceSchema,
});

export const clipKindSchema = z.enum(['youtube', 'article', 'generic', 'unknown']);

export const extractionQualitySchema = z.enum(['high', 'medium', 'low']);

export const confidenceSchema = z.object({
  kind: z.number().min(0).max(1),
  title: z.number().min(0).max(1),
  author: z.number().min(0).max(1).optional(),
});

export const clipMetadataSchema = z.object({
  kind: clipKindSchema,
  title: provenanceFieldSchema,
  author: provenanceFieldSchema.optional(),
  siteName: provenanceFieldSchema.optional(),
  thumbnail: z.string().url().optional(),
  toolUsed: z.string(),
  extractionQuality: extractionQualitySchema,
  confidence: confidenceSchema,
  warnings: z.array(z.string()).default([]),
});

export const clipAgentMetadataPatchSchema = z.object({
  kind: clipKindSchema,
  title: provenanceFieldSchema,
  author: provenanceFieldSchema.optional(),
  siteName: provenanceFieldSchema.optional(),
  extractionQuality: extractionQualitySchema,
  confidence: confidenceSchema,
  warnings: z.array(z.string()).default([]),
});

export const clipAgentDeterministicFieldsSchema = z.object({
  toolUsed: z.string(),
  finalUrl: z.string().url().optional(),
  thumbnail: z.string().url().optional(),
});

export const clipAgentResultSchema = z.object({
  content: z.string(),
  metadataPatch: clipAgentMetadataPatchSchema,
  deterministic: clipAgentDeterministicFieldsSchema,
});

export const createClipRequestSchema = z.object({
  url: z.string().url(),
  notes: z.string().default(''),
});

export const urlHintsSchema = z.object({
  originalUrl: z.string().url(),
  hostname: z.string(),
  pathname: z.string(),
  extension: z.string().optional(),
  likelyKind: clipKindSchema,
  reasons: z.array(z.string()),
});
