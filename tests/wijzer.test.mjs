import assert from 'node:assert/strict';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));

const core = await import(join(root, 'packages/core/dist/index.js'));
const content = await import(join(root, 'packages/content/dist/index.js'));
const db = await import(join(root, 'packages/db/dist/index.js'));

const {
  InvalidUrlError,
  ExtractionError,
  NotFoundError,
  ClipTimeoutError,
  createClipRequestSchema,
} = core;
const { validateClipUrl } = content;
const { FileClipRepository } = db;

function sampleMetadata() {
  return {
    kind: 'generic',
    title: { value: 'T', source: 'extracted' },
    toolUsed: 'test',
    extractionQuality: 'high',
    confidence: { kind: 1, title: 1 },
    warnings: [],
  };
}

function sampleCreateInput(overrides = {}) {
  return {
    url: 'https://example.com/page',
    finalUrl: 'https://example.com/page',
    notes: 'n',
    content: 'body',
    metadata: sampleMetadata(),
    ...overrides,
  };
}

describe('WijzerError codes and HTTP status', () => {
  it('InvalidUrlError → 400 / INVALID_URL', () => {
    const e = new InvalidUrlError();
    assert.equal(e.statusCode, 400);
    assert.equal(e.code, 'INVALID_URL');
  });

  it('ExtractionError → 422 by default', () => {
    const e = new ExtractionError('bad extract');
    assert.equal(e.statusCode, 422);
    assert.equal(e.code, 'EXTRACTION_FAILED');
  });

  it('NotFoundError → 404', () => {
    const e = new NotFoundError();
    assert.equal(e.statusCode, 404);
    assert.equal(e.code, 'NOT_FOUND');
  });

  it('ClipTimeoutError → 504', () => {
    const e = new ClipTimeoutError();
    assert.equal(e.statusCode, 504);
    assert.equal(e.code, 'TIMEOUT');
  });
});

describe('createClipRequestSchema', () => {
  it('accepts a valid https URL and optional notes', () => {
    const r = createClipRequestSchema.safeParse({
      url: 'https://example.com/a',
      notes: 'hello',
    });
    assert.equal(r.success, true);
  });

  it('rejects non-URLs', () => {
    const r = createClipRequestSchema.safeParse({
      url: 'not-a-url',
      notes: '',
    });
    assert.equal(r.success, false);
  });

  it('defaults notes to empty string', () => {
    const r = createClipRequestSchema.safeParse({
      url: 'https://example.com/',
    });
    assert.equal(r.success, true);
    if (r.success) {
      assert.equal(r.data.notes, '');
    }
  });
});

describe('validateClipUrl', () => {
  it('throws InvalidUrlError for localhost', async () => {
    await assert.rejects(
      () => validateClipUrl('http://127.0.0.1/'),
      (err) => err instanceof InvalidUrlError,
    );
  });

  it('returns normalized URL string for public https', async () => {
    const u = await validateClipUrl('https://example.com/path');
    assert.match(u, /^https:\/\/example\.com\/path/);
  });
});

describe('FileClipRepository', () => {
  it('list() is empty when the store file does not exist', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'wijzer-clip-'));
    try {
      const path = join(dir, 'nested', 'clips.json');
      const repo = new FileClipRepository(path);
      const clips = await repo.list();
      assert.deepEqual(clips, []);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it('readStore tolerates empty JSON object (no clips key)', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'wijzer-clip-'));
    try {
      await mkdir(join(dir, 'data'), { recursive: true });
      const path = join(dir, 'data', 'clips.json');
      await writeFile(path, '{}', 'utf-8');
      const repo = new FileClipRepository(path);
      const clips = await repo.list();
      assert.deepEqual(clips, []);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it('create persists and list returns the clip', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'wijzer-clip-'));
    try {
      const path = join(dir, 'clips.json');
      const repo = new FileClipRepository(path);
      const clip = await repo.create(sampleCreateInput());
      assert.ok(clip.id);
      const raw = JSON.parse(await readFile(path, 'utf-8'));
      assert.ok(Array.isArray(raw.clips));
      assert.equal(raw.clips.length, 1);
      assert.equal(raw.clips[0].id, clip.id);
      const listed = await repo.list();
      assert.equal(listed.length, 1);
      assert.equal(listed[0].id, clip.id);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });
});
