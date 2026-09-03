import { homedir } from 'node:os';
import { join } from 'node:path';

/**
 * Config path mappings for AI harnesses.
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
  opencode: join(HOME, '.config', 'opencode', 'opencode.json'),
  grok: join(HOME, '.grok', 'config.toml'),
  // VS Code's Linux user settings path (stable convention, unrelated to the
  // agent-plugin Preview surface this build ships). Distinct from `copilot`
  // above -- that id is the GitHub Copilot CLI/host config; this is the
  // editor itself, which is what actually hosts the hook subprocess and the
  // agent-plugin manifest (multi-editor harness design doc §2.3).
  vscode: join(HOME, '.config', 'Code', 'User', 'settings.json'),
};

const ROOT_CONFIG_FILES: Record<string, string> = {
  'claude-code': 'settings.json',
  cursor: 'settings.json',
  copilot: 'hosts.json',
  opencode: 'opencode.json',
  grok: 'config.toml',
  vscode: 'settings.json',
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
