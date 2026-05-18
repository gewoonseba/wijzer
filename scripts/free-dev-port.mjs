/**
 * Best-effort: stop whatever is listening on the given TCP port (Unix only).
 * Used so test harnesses can start `next dev` on a fixed port.
 */
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

function killPidsFromOutput(out) {
  const text = out.trim();
  if (!text) return;
  const pids = text.split(/\n/).flatMap((line) => line.trim().split(/\s+/));
  for (const pid of pids) {
    if (!/^\d+$/.test(pid)) continue;
    try {
      process.kill(Number(pid), 'SIGKILL');
    } catch {
      /* ignore */
    }
  }
}

export function freeDevPort(port = 3000) {
  if (process.platform === 'win32') {
    return;
  }
  if (!Number.isFinite(port) || port <= 0) {
    return;
  }

  try {
    const out = execFileSync(
      'lsof',
      ['-nP', `-iTCP:${port}`, '-sTCP:LISTEN', '-t'],
      { encoding: 'utf-8' },
    );
    killPidsFromOutput(out);
  } catch {
    /* no matches or lsof unavailable */
  }

  if (process.platform === 'linux') {
    try {
      execFileSync('fuser', ['-k', '-n', 'tcp', String(port)], {
        stdio: 'ignore',
      });
    } catch {
      /* no listener or fuser missing */
    }
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  freeDevPort(Number(process.argv[2] ?? process.env.PORT ?? 3000));
}
