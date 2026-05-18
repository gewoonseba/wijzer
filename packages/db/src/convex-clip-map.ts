import type { Clip, ClipMetadata, CreateClipInput } from '@wijzer/core';

/** Convex clip document shape returned by queries/mutations. */
export type ConvexClipDoc = {
  _id: string;
  _creationTime: number;
  publicId: string;
  url: string;
  finalUrl: string;
  notes: string;
  content: string;
  metadata: ClipMetadata;
  createdAt: number;
};

export function clipDocToClip(doc: ConvexClipDoc): Clip {
  return {
    id: doc.publicId,
    url: doc.url,
    finalUrl: doc.finalUrl,
    notes: doc.notes,
    content: doc.content,
    metadata: doc.metadata,
    createdAt: new Date(doc.createdAt).toISOString(),
  };
}

export function createInputToClipDoc(
  publicId: string,
  input: CreateClipInput,
  createdAtMs: number,
): Omit<ConvexClipDoc, '_id' | '_creationTime'> {
  return {
    publicId,
    url: input.url,
    finalUrl: input.finalUrl,
    notes: input.notes,
    content: input.content,
    metadata: input.metadata,
    createdAt: createdAtMs,
  };
}
