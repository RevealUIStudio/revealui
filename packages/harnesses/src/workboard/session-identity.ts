import { readFileSync } from 'node:fs';

/**
 * Type of session detected from the runtime environment.
 *
 * Extended in VAUGHN Phase 2a to support tool-prefixed identifiers
 * (e.g. 'claude', 'codex') alongside the original IDE-based types.
 */
export type SessionType = 'claude' | 'codex' | 'zed' | 'cursor' | 'terminal';

/**
 * Detects the session type using a 7-tier VAUGHN identity cascade.
 *
 * | Priority | Source                                            |
 * |----------|---------------------------------------------------|
 * | 1        | VAUGHN_AGENT_ID env var (explicit override)        |
 * | 2        | CLAUDE_AGENT_ROLE env var (tool-specific)           |
 * | 3        | Session cache (/tmp/vaughn-session-<ppid>.id)       |
 * | 4        | Process tree walk (/proc for tool binaries)         |
 * | 5        | IDE detection (Zed, Cursor)                         |
 * | 6        | TERM_PROGRAM env var                                |
 * | 7        | Generic 'terminal' fallback                         |
 */
export function detectSessionType(): SessionType {
  // Tier 1: Explicit VAUGHN_AGENT_ID override
  const vaughnId = process.env.VAUGHN_AGENT_ID;
  if (vaughnId) {
    const tool = vaughnId.split('-')[0]?.toLowerCase();
    if (tool === 'claude') return 'claude';
    if (tool === 'codex') return 'codex';
    if (tool === 'cursor') return 'cursor';
    if (tool === 'zed') return 'zed';
    return 'terminal';
  }

  // Tier 2: Tool-specific env vars
  if (process.env.CLAUDE_AGENT_ROLE) return 'claude';

  // Tier 3: Session cache (reuse previous detection)
  try {
    const cachePath = `/tmp/vaughn-session-${process.ppid}.id`;
    const cached = readFileSync(cachePath, 'utf8').trim();
    if (cached === 'claude' || cached === 'codex' || cached === 'zed' || cached === 'cursor') {
      return cached;
    }
  } catch {
    // Cache miss or not available.
  }

  // Tier 4+5: Process tree walk (tool binaries and IDE detection)
  try {
    let pid = process.ppid;
    for (let depth = 0; depth < 8; depth++) {
      if (!pid || pid <= 1) break;
      const cmdline = readFileSync(`/proc/${pid}/cmdline`, 'utf8')
        .replace(/\0/g, ' ')
        .toLowerCase();
      if (cmdline.includes('claude')) return 'claude';
      if (cmdline.includes('codex')) return 'codex';
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

  // Tier 6: TERM_PROGRAM env var fallback
  const termProgram = (process.env.TERM_PROGRAM ?? '').toLowerCase();
  if (termProgram.includes('zed')) return 'zed';
  if (termProgram.includes('cursor')) return 'cursor';

  // Tier 7: Generic terminal
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
