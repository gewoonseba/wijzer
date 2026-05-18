#!/usr/bin/env node
/** Seeds a sample clip for UI demo when AI key is unavailable. */
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const dataDir = join(root, '.data');
const filePath = join(dataDir, 'clips.json');

const clip = {
  id: randomUUID(),
  url: 'https://www.youtube.com/watch?v=jNQXAC9IVRw',
  finalUrl: 'https://www.youtube.com/watch?v=jNQXAC9IVRw',
  notes: '## My notes\n\n- First video on YouTube\n- Historic clip',
  content: `## Overview

This is a demo clip showing how Wijzer stores **your notes** separately from **AI-generated content**.

## Key points

- Paste any URL plus optional markdown notes
- The clipping agent picks the right extractor (YouTube, article, or generic)
- Metadata records whether fields were extracted or inferred

## Who it is for

Anyone building a personal link library.`,
  metadata: {
    kind: 'youtube',
    title: { value: 'Me at the zoo', source: 'extracted' },
    author: { value: 'jawed', source: 'extracted' },
    toolUsed: 'clipYouTube',
    extractionQuality: 'high',
    confidence: { kind: 0.95, title: 0.95, author: 0.9 },
    warnings: ['Demo seed data — not from live agent'],
  },
  createdAt: new Date().toISOString(),
};

await mkdir(dataDir, { recursive: true });
await writeFile(filePath, JSON.stringify({ clips: [clip] }, null, 2), 'utf-8');
console.log(`Seeded demo clip: ${clip.id}`);
console.log(`File: ${filePath}`);
