import { homedir } from 'node:os'
import { join } from 'node:path'

/**
 * Config path mappings for AI harnesses.
 * Mirrors editor-config-paths.ts from packages/editors.
 *
 * Local paths: harness config on this machine.
 * SSD paths: backup/sync target on the DevBox (NTFS or ext4 USB).
 */

const HOME = homedir()
const SSD_BASE = process.env.REVEALUI_SSD_PATH ?? '/mnt/e/.revealui'

const LOCAL_CONFIG_PATHS: Record<string, string> = {
  'claude-code': join(HOME, '.claude', 'settings.json'),
  cursor: join(HOME, '.cursor', 'settings.json'),
  copilot: join(HOME, '.config', 'github-copilot', 'hosts.json'),
}

const SSD_CONFIG_FILES: Record<string, string> = {
  'claude-code': 'settings.json',
  cursor: 'settings.json',
  copilot: 'hosts.json',
}

/** Returns the local config file path for a given harness id, or undefined if unknown. */
export function getLocalConfigPath(harnessId: string): string | undefined {
  return LOCAL_CONFIG_PATHS[harnessId]
}

/** Returns the SSD config file path for a given harness id, or undefined if unknown. */
export function getSsdConfigPath(harnessId: string, ssdBase = SSD_BASE): string | undefined {
  const file = SSD_CONFIG_FILES[harnessId]
  if (!file) return undefined
  return join(ssdBase, 'harness-configs', harnessId, file)
}

/** Returns ids of all harnesses with known config paths. */
export function getConfigurableHarnesses(): string[] {
  return Object.keys(LOCAL_CONFIG_PATHS)
}
