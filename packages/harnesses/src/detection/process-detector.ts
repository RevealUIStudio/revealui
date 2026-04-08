import { execFile } from 'node:child_process';
import { readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { promisify } from 'node:util';
import type { HarnessProcessInfo } from '../types/core.js';

const execFileAsync = promisify(execFile);

/** Finds running processes matching a pattern using pgrep. */
export async function findProcesses(pattern: string): Promise<{ pid: number; command: string }[]> {
  try {
    const { stdout } = await execFileAsync('pgrep', ['-a', pattern], { timeout: 3000 });
    return stdout
      .trim()
      .split('\n')
      .filter(Boolean)
      .map((line) => {
        const spaceIdx = line.indexOf(' ');
        const pid = parseInt(line.slice(0, spaceIdx), 10);
        const command = line.slice(spaceIdx + 1);
        return { pid, command };
      });
  } catch {
    return [];
  }
}

const HARNESS_PROCESS_PATTERNS: Record<string, string[]> = {
  'claude-code': ['claude'],
  cursor: ['cursor', 'Cursor'],
  copilot: ['copilot'],
};

/** Finds running process instances for a specific harness. */
export async function findHarnessProcesses(harnessId: string): Promise<HarnessProcessInfo[]> {
  const patterns = HARNESS_PROCESS_PATTERNS[harnessId];
  if (!patterns) return [];

  const results = await Promise.all(patterns.map((p) => findProcesses(p)));
  return results.flat().map((p) => ({ ...p, harnessId }));
}

/** Finds running processes for all known harnesses. */
export async function findAllHarnessProcesses(): Promise<HarnessProcessInfo[]> {
  const results = await Promise.all(
    Object.keys(HARNESS_PROCESS_PATTERNS).map((id) => findHarnessProcesses(id)),
  );
  return results.flat();
}

/** Finds Claude Code Unix socket files (used for IPC). */
export async function findClaudeCodeSockets(): Promise<string[]> {
  const dirs = [
    '/tmp',
    process.env.XDG_RUNTIME_DIR,
    join(process.env.HOME ?? '/tmp', '.claude'),
  ].filter(Boolean) as string[];

  const sockets: string[] = [];
  for (const dir of dirs) {
    try {
      const entries = await readdir(dir);
      for (const entry of entries) {
        if (/^claude.*\.sock$/.test(entry)) {
          sockets.push(join(dir, entry));
        }
      }
    } catch {
      // Directory not accessible.
    }
  }
  return sockets;
}
