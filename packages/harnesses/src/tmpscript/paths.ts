import { existsSync, mkdirSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

/** Same data root as harness daemon sock / hotfix store. */
export function revealuiDataDir(): string {
  return join(homedir(), '.local', 'share', 'revealui');
}

/** Canonical control-layer temp-artifact registry directory. */
export function controlTmpscriptDir(): string {
  return join(revealuiDataDir(), 'tmp-scripts');
}

export function controlManifestPath(): string {
  return join(controlTmpscriptDir(), 'manifest.json');
}

/**
 * Legacy Studio-adapter store (pre-cutover). Read for one-time migration only;
 * never write here after cutover.
 */
export function legacyClaudeManifestPath(): string {
  return join(homedir(), '.claude', 'tmp-scripts', 'manifest.json');
}

export function ensureControlTmpscriptDir(): void {
  const dir = controlTmpscriptDir();
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true, mode: 0o700 });
  }
}
