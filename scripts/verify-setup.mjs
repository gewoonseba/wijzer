#!/usr/bin/env node
/**
 * Quick smoke checks without calling the clip agent (no API key required).
 */
import { buildUrlHints, validateClipUrl } from '../packages/content/dist/index.js';
import { InvalidUrlError } from '../packages/core/dist/index.js';
import { InMemoryClipRepository } from '../packages/db/dist/index.js';

let passed = 0;
let failed = 0;

function ok(name) {
  passed++;
  console.log(`✓ ${name}`);
}

function fail(name, err) {
  failed++;
  console.error(`✗ ${name}`, err);
}

try {
  await validateClipUrl('http://127.0.0.1/');
  fail('blocks localhost', 'expected throw');
} catch (e) {
  if (e instanceof InvalidUrlError) ok('blocks localhost');
  else fail('blocks localhost', e);
}

const hints = buildUrlHints('https://www.youtube.com/watch?v=dQw4w9WgXcQ');
if (hints.likelyKind === 'youtube') ok('youtube hints');
else fail('youtube hints', hints);

const repo = new InMemoryClipRepository();
const clip = await repo.create({
  url: 'https://example.com',
  finalUrl: 'https://example.com',
  notes: 'test',
  content: 'body',
  metadata: {
    kind: 'generic',
    title: { value: 'T', source: 'extracted' },
    toolUsed: 'test',
    extractionQuality: 'high',
    confidence: { kind: 1, title: 1 },
    warnings: [],
  },
});
if (clip.id) ok('in-memory repository');

console.log(`\n${passed} passed, ${failed} failed`);
if (process.env.AI_GATEWAY_API_KEY) {
  console.log('AI_GATEWAY_API_KEY is set — clip agent E2E can run via POST /api/clips');
} else {
  console.log('AI_GATEWAY_API_KEY not set — skip live clip tests');
}
process.exit(failed > 0 ? 1 : 0);
