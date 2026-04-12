import { copyFileSync, existsSync, mkdirSync, readFileSync } from 'node:fs';
import { dirname } from 'node:path';
import type { ConfigDiffEntry, ConfigSyncDirection, ConfigSyncResult } from '../types/core.js';
import {
  getConfigurableHarnesses,
  getLocalConfigPath,
  getRootConfigPath,
} from './harness-config-paths.js';

/**
 * Syncs harness config between local filesystem and root backup.
 * Mirrors config-sync.ts from packages/editors.
 */
export function syncConfig(
  harnessId: string,
  direction: ConfigSyncDirection,
  root?: string,
): ConfigSyncResult {
  const localPath = getLocalConfigPath(harnessId);
  const rootPath = getRootConfigPath(harnessId, root);

  if (!(localPath && rootPath)) {
    return {
      success: false,
      harnessId,
      direction,
      message: `No config path known for harness: ${harnessId}`,
    };
  }

  try {
    if (direction === 'pull') {
      // Pull: root → local
      if (!existsSync(rootPath)) {
        return {
          success: false,
          harnessId,
          direction,
          message: `Root config not found: ${rootPath}`,
        };
      }
      mkdirSync(dirname(localPath), { recursive: true });
      backupIfExists(localPath);
      copyFileSync(rootPath, localPath);
      return { success: true, harnessId, direction, message: `Pulled ${rootPath} → ${localPath}` };
    } else {
      // Push: local → root
      if (!existsSync(localPath)) {
        return {
          success: false,
          harnessId,
          direction,
          message: `Local config not found: ${localPath}`,
        };
      }
      mkdirSync(dirname(rootPath), { recursive: true });
      backupIfExists(rootPath);
      copyFileSync(localPath, rootPath);
      return { success: true, harnessId, direction, message: `Pushed ${localPath} → ${rootPath}` };
    }
  } catch (err) {
    return {
      success: false,
      harnessId,
      direction,
      message: err instanceof Error ? err.message : String(err),
    };
  }
}

/** Compares local vs root config for a harness. */
export function diffConfig(harnessId: string, root?: string): ConfigDiffEntry {
  const localPath = getLocalConfigPath(harnessId);
  const rootPath = getRootConfigPath(harnessId, root);

  const localExists = !!localPath && existsSync(localPath);
  const ssdExists = !!rootPath && existsSync(rootPath);

  if (!(localExists && ssdExists)) {
    return { harnessId, localExists, ssdExists, identical: false };
  }

  try {
    const localContent = readFileSync(localPath, 'utf8');
    const ssdContent = readFileSync(rootPath, 'utf8');
    return { harnessId, localExists, ssdExists, identical: localContent === ssdContent };
  } catch {
    return { harnessId, localExists, ssdExists, identical: false };
  }
}

/**
 * Sync all known harness configs in a given direction.
 * Returns results for each harness.
 */
export function syncAllConfigs(direction: ConfigSyncDirection, root?: string): ConfigSyncResult[] {
  return getConfigurableHarnesses().map((id) => syncConfig(id, direction, root));
}

/**
 * Diff all known harness configs.
 * Returns diff entries for each harness.
 */
export function diffAllConfigs(root?: string): ConfigDiffEntry[] {
  return getConfigurableHarnesses().map((id) => diffConfig(id, root));
}

/**
 * Validate that a config file contains parseable JSON.
 * Returns null if valid, or an error message if invalid.
 */
export function validateConfigJson(harnessId: string): string | null {
  const localPath = getLocalConfigPath(harnessId);
  if (!localPath) return `No config path known for harness: ${harnessId}`;
  if (!existsSync(localPath)) return `Config file not found: ${localPath}`;

  try {
    const content = readFileSync(localPath, 'utf8');
    JSON.parse(content);
    return null;
  } catch (err) {
    return err instanceof Error ? err.message : String(err);
  }
}

/** Create a .bak copy of a file if it exists (non-fatal if backup fails). */
function backupIfExists(filePath: string): void {
  try {
    if (existsSync(filePath)) {
      copyFileSync(filePath, `${filePath}.bak`);
    }
  } catch {
    // Backup is best-effort  -  don't block the sync
  }
}
