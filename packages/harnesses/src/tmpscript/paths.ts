import { homedir } from 'node:os';
import { isAbsolute, join } from 'node:path';

/** Compatibility accessor for consumers of the former data root. */
export function revealuiDataDir(): string {
  return join(homedir(), '.local', 'share', 'revealui');
}
export function previousControlManifestPath(): string {
  return join(revealuiDataDir(), 'tmp-scripts', 'manifest.json');
}
export function controlTmpscriptDir(): string {
  const configured = process.env.XDG_STATE_HOME;
  if (configured && !isAbsolute(configured))
    throw new Error('tmpscript: XDG_STATE_HOME must be absolute');
  return join(configured || join(homedir(), '.local', 'state'), 'revealui', 'tmp-scripts');
}
export function controlManifestPath(): string {
  return join(controlTmpscriptDir(), 'manifest.json');
}
export function legacyClaudeManifestPath(): string {
  return join(homedir(), '.claude', 'tmp-scripts', 'manifest.json');
}
