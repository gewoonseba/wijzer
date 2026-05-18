#!/usr/bin/env node
/**
 * Import clips from .data/clips.json into Convex (idempotent by publicId).
 * Requires CLIP_STORE=convex and CONVEX_URL (or NEXT_PUBLIC_CONVEX_URL).
 */
import { config } from 'dotenv';
import { readFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ConvexHttpClient } from 'convex/browser';
import { internal } from '../convex/_generated/api.js';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
config({ path: join(root, '.env.local') });
config({ path: join(root, 'apps/web/.env.local') });

const url = process.env.CONVEX_URL ?? process.env.NEXT_PUBLIC_CONVEX_URL;
if (!url) {
  console.error('Set CONVEX_URL or NEXT_PUBLIC_CONVEX_URL');
  process.exit(1);
}

const storePath =
  process.env.WIJZER_CLIP_STORE_PATH ?? join(root, '.data', 'clips.json');

let raw;
try {
  raw = await readFile(storePath, 'utf-8');
} catch {
  console.error('No clips file at', storePath);
  process.exit(1);
}

const { clips } = JSON.parse(raw);
if (!Array.isArray(clips)) {
  console.error('Invalid clips.json');
  process.exit(1);
}

const client = new ConvexHttpClient(url);
let imported = 0;

for (const clip of clips) {
  const doc = {
    publicId: clip.id,
    url: clip.url,
    finalUrl: clip.finalUrl,
    notes: clip.notes,
    content: clip.content,
    metadata: clip.metadata,
    createdAt: new Date(clip.createdAt).getTime(),
  };
  await client.mutation(internal.import.importClip, { clip: doc });
  imported++;
}

console.log(`Imported ${imported} clip(s) into Convex.`);
