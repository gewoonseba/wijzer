#!/usr/bin/env node
/**
 * Smoke test Convex clips API (no Next.js). Requires CONVEX_URL from `npx convex dev`.
 */
import { config } from 'dotenv';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ConvexHttpClient } from 'convex/browser';
import { api } from '../convex/_generated/api.js';
function clipDocToClip(doc) {
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

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
config({ path: join(root, '.env.local') });

const url = process.env.CONVEX_URL ?? process.env.NEXT_PUBLIC_CONVEX_URL;
if (!url) {
  console.error('Set CONVEX_URL (run npx convex dev)');
  process.exit(1);
}

const client = new ConvexHttpClient(url);

const doc = await client.mutation(api.clips.create, {
  url: 'https://example.com/article',
  finalUrl: 'https://example.com/article',
  notes: '## Convex smoke',
  content: 'Smoke test clip body with enough text for validation.',
  metadata: {
    kind: 'generic',
    title: { value: 'Convex smoke', source: 'extracted' },
    toolUsed: 'smoke-convex',
    extractionQuality: 'high',
    confidence: { kind: 1, title: 1 },
    warnings: [],
  },
});

const clip = clipDocToClip(doc);
let failed = 0;

if (!clip.id) failed++;

const list = await client.query(api.clips.list, {});
if (!list.some((c) => c.publicId === clip.id)) {
  console.error('✗ list contains clip');
  failed++;
} else {
  console.log('✓ list contains clip');
}

const got = await client.query(api.clips.getByPublicId, { publicId: clip.id });
if (!got || got.publicId !== clip.id) {
  console.error('✗ getByPublicId');
  failed++;
} else {
  console.log('✓ getByPublicId');
}

console.log('✓ create mutation, clip id:', clip.id);
console.log(failed === 0 ? 'smoke:convex OK' : 'smoke:convex FAILED');
process.exit(failed > 0 ? 1 : 0);
