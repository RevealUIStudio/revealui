import { readFileSync } from 'node:fs';

/** Type of session detected from the runtime environment. */
export type SessionType = 'zed' | 'cursor' | 'terminal';

/**
 * Detects whether the current process is running inside an AI tool (Zed, Cursor)
 * or a plain terminal session by walking the parent process chain.
 *
 * Uses /proc/<pid>/cmdline on Linux/WSL. Falls back to TERM_PROGRAM env var.
 */
export function detectSessionType(): SessionType {
  // Walk parent process chain looking for known AI tool process names.
  try {
    let pid = process.ppid;
    for (let depth = 0; depth < 8; depth++) {
      if (!pid || pid <= 1) break;
      const cmdline = readFileSync(`/proc/${pid}/cmdline`, 'utf8')
        .replace(/\0/g, ' ')
        .toLowerCase();
      if (cmdline.includes('zed')) return 'zed';
      if (cmdline.includes('cursor')) return 'cursor';
      const status = readFileSync(`/proc/${pid}/status`, 'utf8');
      const m = status.match(/PPid:\s+(\d+)/);
      if (!m) break;
      pid = parseInt(m[1] ?? '0', 10);
    }
  } catch {
    // /proc not available (macOS, Windows non-WSL).
  }

  // Fallback: TERM_PROGRAM env var (set by some terminal emulators and IDEs).
  const termProgram = (process.env.TERM_PROGRAM ?? '').toLowerCase();
  if (termProgram.includes('zed')) return 'zed';
  if (termProgram.includes('cursor')) return 'cursor';

  return 'terminal';
}

/**
 * Derives a session ID (e.g. "zed-1", "terminal-2") given a type and a list
 * of existing session IDs already in the workboard.
 *
 * Picks the next available numeric suffix to avoid collisions.
 */
export function deriveSessionId(type: SessionType, existingIds: string[]): string {
  const matching = existingIds
    .filter((id) => id.startsWith(`${type}-`))
    .map((id) => parseInt(id.split('-')[1] ?? '0', 10))
    .filter((n) => !Number.isNaN(n));

  const maxN = matching.length > 0 ? Math.max(...matching) : 0;
  return `${type}-${maxN + 1}`;
}
