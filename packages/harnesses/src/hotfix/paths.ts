import { existsSync, mkdirSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

/** Same data root as harness daemon sock / DB (`cli.ts` DATA_DIR). */
export function revealuiDataDir(): string {
  return join(homedir(), '.local', 'share', 'revealui');
}

/** Canonical control-layer hotfix registry directory. */
export function controlHotfixDir(): string {
  return join(revealuiDataDir(), 'hotfixes');
}

export function controlManifestPath(): string {
  return join(controlHotfixDir(), 'manifest.json');
}

/**
 * Legacy Studio-adapter store (pre-cutover). Read for one-time migration only;
 * never write here after cutover.
 */
export function legacyClaudeManifestPath(): string {
  return join(homedir(), '.claude', 'hotfixes', 'manifest.json');
}

export function ensureControlHotfixDir(): void {
  const dir = controlHotfixDir();
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true, mode: 0o700 });
  }
}
