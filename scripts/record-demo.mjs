#!/usr/bin/env node
/**
 * Records a short Playwright demo video of the Wijzer UI.
 * Requires: dev server on BASE_URL, optional AI_GATEWAY_API_KEY for live clip.
 */
import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');
const outDir = process.env.DEMO_OUT_DIR ?? join(root, 'demo-output');
const baseUrl = process.env.DEMO_BASE_URL ?? 'http://127.0.0.1:3000';
const hasAiKey = Boolean(process.env.AI_GATEWAY_API_KEY);

await mkdir(outDir, { recursive: true });

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({
  viewport: { width: 1280, height: 800 },
  recordVideo: { dir: outDir, size: { width: 1280, height: 800 } },
});
const page = await context.newPage();

console.log(`Recording demo → ${outDir}`);
console.log(`App URL: ${baseUrl}`);
console.log(`Live clip: ${hasAiKey ? 'yes' : 'no (will show seeded clip only)'}`);

try {
  await page.goto(baseUrl, { waitUntil: 'networkidle', timeout: 30_000 });
  await page.waitForTimeout(800);

  if (hasAiKey) {
    const testUrl =
      process.env.DEMO_CLIP_URL ??
      'https://www.youtube.com/watch?v=jNQXAC9IVRw'; // short video, often has captions
    await page.fill('#url', testUrl);
    await page.fill('#notes', '## Demo notes\n\nTesting Wijzer clip flow.');
    await page.click('button[type="submit"]');
    await page.waitForSelector('h1', { timeout: 120_000 });
    await page.waitForTimeout(2000);
  } else {
    const firstClip = page.locator('ul a').first();
    if (await firstClip.count()) {
      await firstClip.click();
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(2000);
      await page.goto(baseUrl, { waitUntil: 'networkidle' });
      await page.waitForTimeout(1000);
    }
    await page.screenshot({ path: join(outDir, 'screenshot-home.png'), fullPage: true });
  }

  await page.goto(baseUrl, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1500);
} catch (err) {
  console.error('Demo recording error:', err);
  await page.screenshot({ path: join(outDir, 'screenshot-error.png'), fullPage: true });
}

await context.close();
await browser.close();

const { readdir, rename } = await import('node:fs/promises');
const files = await readdir(outDir).catch(() => []);
const webm = files.find((f) => f.endsWith('.webm'));
if (webm) {
  const dest = join(outDir, 'wijzer-demo.webm');
  await rename(join(outDir, webm), dest).catch(() => {});
  console.log(`Video: ${dest}`);
} else {
  console.log('No video file found (check playwright install).');
}
