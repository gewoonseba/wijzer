import type { z } from 'zod';
import type { clipMetadataSchema } from './schemas.js';

export type Provenance = 'extracted' | 'inferred' | 'unknown';

export type ProvenanceField = {
  value: string;
  source: Provenance;
};

export type ClipKind = 'youtube' | 'article' | 'generic' | 'unknown';

export type ExtractionQuality = 'high' | 'medium' | 'low';

export type ClipMetadata = z.infer<typeof clipMetadataSchema>;

export type Clip = {
  id: string;
  url: string;
  finalUrl: string;
  notes: string;
  content: string;
  metadata: ClipMetadata;
  createdAt: string;
};

export type CreateClipInput = {
  url: string;
  finalUrl: string;
  notes: string;
  content: string;
  metadata: ClipMetadata;
};

export type UrlHints = {
  originalUrl: string;
  hostname: string;
  pathname: string;
  extension?: string;
  likelyKind: ClipKind;
  reasons: string[];
};
