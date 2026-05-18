#!/usr/bin/env node
/**
 * Spawns `pnpm --filter web dev`, hits failing API routes, and asserts the dev
 * server process output contains structured `[wijzer:api]` lines (stderr).
 */
import { spawn } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { freeDevPort } from './free-dev-port.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const baseUrl = process.env.E2E_BASE_URL ?? 'http://127.0.0.1:3000';

freeDevPort(3000);

function waitUntil(ms, predicate) {
  const deadline = Date.now() + ms;
  return new Promise((resolveWait, reject) => {
    const tick = () => {
      if (predicate()) {
        resolveWait();
      } else if (Date.now() > deadline) {
        reject(new Error('timeout waiting for dev server'));
      } else {
        setTimeout(tick, 150);
      }
    };
    tick();
  });
}

let log = '';

const child = spawn('npx', ['--yes', 'pnpm@9.15.9', '--filter', 'web', 'dev'], {
  cwd: root,
  env: { ...process.env, FORCE_COLOR: '0' },
  stdio: ['ignore', 'pipe', 'pipe'],
});

child.stdout.on('data', (c) => {
  log += c.toString();
});
child.stderr.on('data', (c) => {
  log += c.toString();
});

let exit = 0;

try {
  await waitUntil(120_000, () => log.includes('Ready'));

  const checks = [];

  const invalidJson = await fetch(`${baseUrl}/api/clips`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: '{',
  });
  checks.push(['invalid JSON → 400', invalidJson.status === 400]);

  const badField = await fetch(`${baseUrl}/api/clips`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url: 'not-a-url', notes: '' }),
  });
  checks.push(['Zod URL → 400', badField.status === 400]);

  const blocked = await fetch(`${baseUrl}/api/clips`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url: 'http://127.0.0.1/', notes: '' }),
  });
  checks.push(['blocked host → 400', blocked.status === 400]);

  const missingClip = await fetch(
    `${baseUrl}/api/clips/00000000-0000-4000-8000-000000000000`,
  );
  checks.push(['missing clip → 404', missingClip.status === 404]);

  for (const [name, ok] of checks) {
    if (!ok) {
      console.error('FAIL:', name);
      exit = 1;
    }
  }

  const expectedCodes = [
    'INVALID_JSON',
    'VALIDATION_ERROR',
    'INVALID_URL',
    'NOT_FOUND',
  ];
  for (const code of expectedCodes) {
    if (!log.includes(code)) {
      console.error(`FAIL: server log missing “${code}”`);
      exit = 1;
    }
  }

  if (!log.includes('[wijzer:api]')) {
    console.error('FAIL: server log missing “[wijzer:api]”');
    exit = 1;
  }

  if (exit === 0) {
    console.log('smoke:api-logs OK');
  } else {
    console.error('--- server log tail ---\n', log.slice(-6000));
  }
} catch (e) {
  console.error(e);
  console.error('--- server log tail ---\n', log.slice(-6000));
  exit = 1;
} finally {
  child.kill('SIGTERM');
}

process.exit(exit);
