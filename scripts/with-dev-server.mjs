#!/usr/bin/env node
/**
 * Starts `pnpm --filter web dev`, waits until Next reports Ready, runs the given
 * command, then stops the dev server.
 *
 * Usage: node scripts/with-dev-server.mjs -- node scripts/e2e-live-clip.mjs
 */
import { spawn } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { freeDevPort } from './free-dev-port.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const dashIdx = process.argv.indexOf('--');

freeDevPort(3000);

if (dashIdx === -1 || dashIdx >= process.argv.length - 1) {
  console.error('Usage: with-dev-server.mjs -- <command> [args...]');
  process.exit(1);
}

const cmd = process.argv[dashIdx + 1];
const args = process.argv.slice(dashIdx + 2);

let bootLog = '';
const dev = spawn('npx', ['--yes', 'pnpm@9.15.9', '--filter', 'web', 'dev'], {
  cwd: root,
  stdio: ['ignore', 'pipe', 'pipe'],
  env: {
    ...process.env,
    FORCE_COLOR: '0',
    NODE_ENV: 'development',
    // Default mock clips in this harness so CI/local test:ci need no YouTube/AI.
    // Set WIJZER_MOCK_CLIP=0 (or false) to exercise real extraction in the child server.
    WIJZER_MOCK_CLIP: process.env.WIJZER_MOCK_CLIP ?? '1',
  },
});

dev.stdout.on('data', (c) => {
  bootLog += c.toString();
});
dev.stderr.on('data', (c) => {
  bootLog += c.toString();
});

const readyDeadline = Date.now() + 120_000;

try {
  await new Promise((resolveReady, rejectReady) => {
    const tick = () => {
      if (bootLog.includes('Ready')) {
        resolveReady();
      } else if (Date.now() > readyDeadline) {
        rejectReady(
          new Error(
            'Dev server did not become ready in time:\n' + bootLog.slice(-2000),
          ),
        );
      } else {
        setTimeout(tick, 100);
      }
    };
    tick();
  });

  const exitCode = await new Promise((resolveExit) => {
    const child = spawn(cmd, args, {
      cwd: root,
      stdio: 'inherit',
      env: process.env,
    });
    child.on('exit', (code) => resolveExit(code ?? 1));
    child.on('error', () => resolveExit(1));
  });

  process.exitCode = exitCode === 0 ? 0 : exitCode;
} catch (e) {
  console.error(e);
  process.exitCode = 1;
} finally {
  try {
    dev.kill('SIGKILL');
  } catch {
    /* ignore */
  }
  freeDevPort(3000);
}
