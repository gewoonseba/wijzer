#!/usr/bin/env node
/**
 * Records a full Wijzer clip flow: empty home → paste URL + notes → Clip → detail page.
 */
import { chromium } from 'playwright';
import { config } from 'dotenv';
import { mkdir, rm, rename, readdir } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
config({ path: join(root, 'apps/web/.env.local') });
config({ path: join(root, '.env.local') });

const outDir = process.env.DEMO_OUT_DIR ?? '/opt/cursor/artifacts/demo';
const baseUrl = process.env.DEMO_BASE_URL ?? 'http://127.0.0.1:3000';
const testUrl =
  process.env.DEMO_CLIP_URL ?? 'https://www.youtube.com/watch?v=dQw4w9WgXcQ';
const testNotes = `## Why I'm saving this

- Classic 80s track — good clipping test
- Verifying notes stay separate from AI summary`;

await mkdir(outDir, { recursive: true });
await rm(join(root, '.data'), { recursive: true, force: true });

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({
  viewport: { width: 1280, height: 900 },
  recordVideo: { dir: outDir, size: { width: 1280, height: 900 } },
});
const page = await context.newPage();
page.setDefaultTimeout(180_000);

async function pause(ms) {
  await page.waitForTimeout(ms);
}

async function fillVisible(selector, text) {
  await page.locator(selector).fill('');
  await page.locator(selector).pressSequentially(text, { delay: 20 });
}

console.log('Recording full clip demo →', outDir);

try {
  await page.goto(baseUrl, { waitUntil: 'networkidle' });
  await pause(2000);

  await page.screenshot({ path: join(outDir, '01-home-empty.png'), fullPage: true });

  await fillVisible('#url', testUrl);
  await pause(1000);
  await fillVisible('#notes', testNotes);
  await pause(2000);

  await page.screenshot({ path: join(outDir, '02-form-filled.png'), fullPage: true });

  const clipRequest = page.waitForResponse(
    (r) => r.url().includes('/api/clips') && r.request().method() === 'POST',
    { timeout: 180_000 },
  );
  await page.click('button[type="submit"]');
  await pause(600);
  await page.screenshot({ path: join(outDir, '03-clipping.png'), fullPage: true });

  const clipResponse = await clipRequest;
  if (!clipResponse.ok()) {
    const errBody = await clipResponse.text();
    throw new Error(`Clip API failed: ${clipResponse.status()} ${errBody}`);
  }

  await page.waitForURL(/\/clips\/[a-f0-9-]+$/i, { timeout: 180_000 });
  await page.waitForLoadState('networkidle');
  await pause(2500);

  await page.screenshot({ path: join(outDir, '04-clip-detail-top.png'), fullPage: true });

  await page.evaluate(() => window.scrollTo(0, 400));
  await pause(2000);
  await page.screenshot({ path: join(outDir, '05-clip-content.png'), fullPage: true });

  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await pause(2000);
  await page.screenshot({ path: join(outDir, '06-clip-notes.png'), fullPage: true });

  const title = await page.locator('h1').first().textContent();
  const notesVisible = await page.locator('text=Your notes').isVisible();
  console.log('Clip title:', title?.trim());
  console.log('Notes section visible:', notesVisible);

  await pause(3000);
} catch (err) {
  console.error('Recording failed:', err);
  await page.screenshot({ path: join(outDir, 'error.png'), fullPage: true });
  process.exitCode = 1;
} finally {
  await context.close();
  await browser.close();
}

const files = await readdir(outDir);
const webm = files.find((f) => f.endsWith('.webm') && f !== 'wijzer-demo-full.webm');
if (webm) {
  const dest = join(outDir, 'wijzer-demo-full.webm');
  await rename(join(outDir, webm), dest).catch(async () => {
    const { copyFile } = await import('node:fs/promises');
    await copyFile(join(outDir, webm), dest);
  });
  console.log('Video:', dest);
}

if (process.exitCode) process.exit(process.exitCode);
