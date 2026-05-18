#!/usr/bin/env node
/**
 * End-to-end: POST /api/clips with a real URL, validate saved clip.
 */
import { config } from 'dotenv';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { rm, mkdir } from 'node:fs/promises';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
config({ path: join(root, 'apps/web/.env.local') });
config({ path: join(root, '.env.local') });

const baseUrl = process.env.E2E_BASE_URL ?? 'http://127.0.0.1:3000';
const testUrl =
  process.env.E2E_CLIP_URL ?? 'https://www.youtube.com/watch?v=dQw4w9WgXcQ';
const testNotes = '## E2E test\n\nAutomated clip verification.';

await rm(join(root, '.data'), { recursive: true, force: true });
await mkdir(join(root, '.data'), { recursive: true });

console.log('POST /api/clips …');
console.log('URL:', testUrl);
console.log('AI_GATEWAY_API_KEY:', process.env.AI_GATEWAY_API_KEY ? 'set' : 'not set (local summary fallback)');

const res = await fetch(`${baseUrl}/api/clips`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ url: testUrl, notes: testNotes }),
});

const body = await res.json();
console.log('Status:', res.status);

if (!res.ok) {
  console.error('FAIL', JSON.stringify(body, null, 2));
  process.exit(1);
}

const checks = [
  ['id', Boolean(body.id)],
  ['content length', (body.content?.length ?? 0) > 100],
  ['notes preserved', body.notes === testNotes],
  ['metadata.title', Boolean(body.metadata?.title?.value)],
  ['metadata.toolUsed', Boolean(body.metadata?.toolUsed)],
  ['url', body.url === testUrl],
];

let failed = 0;
for (const [name, ok] of checks) {
  if (ok) console.log('✓', name);
  else {
    console.error('✗', name);
    failed++;
  }
}

if (body.metadata?.warnings?.length) {
  console.log('Warnings:', body.metadata.warnings);
}

console.log('\nClip id:', body.id);
console.log('Title:', body.metadata?.title?.value);
console.log('Tool:', body.metadata?.toolUsed);
console.log('Content preview:', body.content?.slice(0, 200).replace(/\n/g, ' '), '…');

process.exit(failed > 0 ? 1 : 0);
