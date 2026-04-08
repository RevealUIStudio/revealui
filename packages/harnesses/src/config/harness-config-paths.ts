import { homedir } from 'node:os';
import { join } from 'node:path';

/**
 * Config path mappings for AI harnesses.
 * Mirrors editor-config-paths.ts from packages/editors.
 *
 * Local paths: harness config on this machine.
 * Root paths: backup/sync target on the DevPod (ext4 USB) or LTS (NTFS).
 */

const HOME = homedir();
const REVEALUI_ROOT = process.env.REVEALUI_ROOT ?? join(HOME, '.revealui');

const LOCAL_CONFIG_PATHS: Record<string, string> = {
  'claude-code': join(HOME, '.claude', 'settings.json'),
  cursor: join(HOME, '.cursor', 'settings.json'),
  copilot: join(HOME, '.config', 'github-copilot', 'hosts.json'),
};

const ROOT_CONFIG_FILES: Record<string, string> = {
  'claude-code': 'settings.json',
  cursor: 'settings.json',
  copilot: 'hosts.json',
};

/** Returns the local config file path for a given harness id, or undefined if unknown. */
export function getLocalConfigPath(harnessId: string): string | undefined {
  return LOCAL_CONFIG_PATHS[harnessId];
}

/** Returns the root config file path for a given harness id, or undefined if unknown. */
export function getRootConfigPath(harnessId: string, root = REVEALUI_ROOT): string | undefined {
  const file = ROOT_CONFIG_FILES[harnessId];
  if (!file) return undefined;
  return join(root, 'harness-configs', harnessId, file);
}

/** Returns ids of all harnesses with known config paths. */
export function getConfigurableHarnesses(): string[] {
  return Object.keys(LOCAL_CONFIG_PATHS);
}
