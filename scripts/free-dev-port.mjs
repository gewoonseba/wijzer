/**
 * Best-effort: stop whatever is listening on the given TCP port (Unix only).
 * Used so test harnesses can start `next dev` on a fixed port.
 */
import { execFileSync } from 'node:child_process';

export function freeDevPort(port = 3000) {
  if (process.platform === 'win32') {
    return;
  }
  if (!Number.isFinite(port) || port <= 0) {
    return;
  }
  try {
    const out = execFileSync('lsof', ['-ti', `TCP:${port}`], {
      encoding: 'utf-8',
    });
    for (const pid of out.trim().split(/\s+/).filter(Boolean)) {
      try {
        process.kill(Number(pid), 'SIGKILL');
      } catch {
        /* ignore */
      }
    }
  } catch {
    /* no process on port */
  }
}
