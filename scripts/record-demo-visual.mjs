#!/usr/bin/env node
/**
 * Records a visual tour of Wijzer (no AI / no POST /api/clips).
 * Seeds a demo clip so home + detail pages show real UI with the current design.
 */
import { chromium } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const outDir = process.env.DEMO_OUT_DIR ?? '/opt/cursor/artifacts/demo';
const baseUrl = process.env.DEMO_BASE_URL ?? 'http://127.0.0.1:3000';

const DEMO_CLIP_ID = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11';

const seedStore = {
  clips: [
    {
      id: DEMO_CLIP_ID,
      url: 'https://example.com/blog/wijzer-demo',
      finalUrl: 'https://example.com/blog/wijzer-demo',
      notes: `## My notes

- **Why** I saved this page  
- Checking *markdown* in the demo`,
      content: `## Summary

This is **demo clip content** for a screen recording — no AI call was made.

### Highlights

- Bullet one  
- Bullet two  

[Example link](https://example.com) inside the clip body.`,
      metadata: {
        kind: 'article',
        title: { value: 'Example blog post — Wijzer UI demo', source: 'extracted' },
        siteName: { value: 'Example', source: 'extracted' },
        toolUsed: 'demo-seed',
        extractionQuality: 'high',
        confidence: { kind: 0.85, title: 0.9 },
        warnings: [],
      },
      createdAt: '2026-05-18T12:00:00.000Z',
    },
  ],
};

await mkdir(outDir, { recursive: true });
await mkdir(join(root, '.data'), { recursive: true });
await writeFile(
  join(root, '.data', 'clips.json'),
  JSON.stringify(seedStore, null, 2),
  'utf-8',
);

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({
  viewport: { width: 1280, height: 900 },
  recordVideo: { dir: outDir, size: { width: 1280, height: 900 } },
});
const page = await context.newPage();
page.setDefaultTimeout(60_000);

async function pause(ms) {
  await page.waitForTimeout(ms);
}

console.log('Recording visual demo (seeded clip, no AI) →', outDir);

try {
  await page.goto(baseUrl, { waitUntil: 'networkidle' });
  await pause(2000);
  await page.screenshot({ path: join(outDir, 'visual-01-home.png'), fullPage: true });

  await page.locator(`a[href="/clips/${DEMO_CLIP_ID}"]`).first().click();
  await page.waitForURL(`**/clips/${DEMO_CLIP_ID}`, { timeout: 30_000 });
  await page.waitForLoadState('networkidle');
  await pause(2000);
  await page.screenshot({ path: join(outDir, 'visual-02-detail-top.png'), fullPage: true });

  await page.evaluate(() => window.scrollTo(0, 380));
  await pause(2000);
  await page.screenshot({ path: join(outDir, 'visual-03-detail-clip.png'), fullPage: true });

  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await pause(2000);
  await page.screenshot({ path: join(outDir, 'visual-04-detail-notes.png'), fullPage: true });

  await page.goto(`${baseUrl}/`, { waitUntil: 'networkidle' });
  await pause(1500);
  await page.locator('#url').fill('');
  await page.locator('#url').pressSequentially('https://example.com/next-clip', { delay: 25 });
  await pause(800);
  await page.locator('#notes').fill('');
  await page
    .locator('#notes')
    .pressSequentially('## Notes\n\nPaste and **Clip** when API keys are set.', {
      delay: 15,
    });
  await pause(2000);
  await page.screenshot({ path: join(outDir, 'visual-05-form.png'), fullPage: true });

  await pause(2500);
} catch (err) {
  console.error('Recording failed:', err);
  await page.screenshot({ path: join(outDir, 'visual-error.png'), fullPage: true });
  process.exitCode = 1;
} finally {
  await context.close();
  await browser.close();
}

const { readdir, rename, copyFile } = await import('node:fs/promises');
const files = await readdir(outDir);
const webm = files.find((f) => f.endsWith('.webm') && f !== 'wijzer-demo-visual.webm');
if (webm) {
  const dest = join(outDir, 'wijzer-demo-visual.webm');
  await rename(join(outDir, webm), dest).catch(async () => {
    await copyFile(join(outDir, webm), dest);
  });
  console.log('Video:', dest);
}

if (process.exitCode) process.exit(process.exitCode);
