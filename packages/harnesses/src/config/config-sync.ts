import { copyFileSync, existsSync, mkdirSync, readFileSync } from 'node:fs'
import { dirname } from 'node:path'
import type { ConfigDiffEntry, ConfigSyncDirection, ConfigSyncResult } from '../types/core.js'
import { getLocalConfigPath, getSsdConfigPath } from './harness-config-paths.js'

/**
 * Syncs harness config between local filesystem and SSD backup.
 * Mirrors config-sync.ts from packages/editors.
 */
export function syncConfig(
  harnessId: string,
  direction: ConfigSyncDirection,
  ssdBase?: string,
): ConfigSyncResult {
  const localPath = getLocalConfigPath(harnessId)
  const ssdPath = getSsdConfigPath(harnessId, ssdBase)

  if (!(localPath && ssdPath)) {
    return {
      success: false,
      harnessId,
      direction,
      message: `No config path known for harness: ${harnessId}`,
    }
  }

  try {
    if (direction === 'pull') {
      // Pull: SSD → local
      if (!existsSync(ssdPath)) {
        return { success: false, harnessId, direction, message: `SSD config not found: ${ssdPath}` }
      }
      mkdirSync(dirname(localPath), { recursive: true })
      copyFileSync(ssdPath, localPath)
      return { success: true, harnessId, direction, message: `Pulled ${ssdPath} → ${localPath}` }
    } else {
      // Push: local → SSD
      if (!existsSync(localPath)) {
        return {
          success: false,
          harnessId,
          direction,
          message: `Local config not found: ${localPath}`,
        }
      }
      mkdirSync(dirname(ssdPath), { recursive: true })
      copyFileSync(localPath, ssdPath)
      return { success: true, harnessId, direction, message: `Pushed ${localPath} → ${ssdPath}` }
    }
  } catch (err) {
    return {
      success: false,
      harnessId,
      direction,
      message: err instanceof Error ? err.message : String(err),
    }
  }
}

/** Compares local vs SSD config for a harness. */
export function diffConfig(harnessId: string, ssdBase?: string): ConfigDiffEntry {
  const localPath = getLocalConfigPath(harnessId)
  const ssdPath = getSsdConfigPath(harnessId, ssdBase)

  const localExists = !!localPath && existsSync(localPath)
  const ssdExists = !!ssdPath && existsSync(ssdPath)

  if (!(localExists && ssdExists)) {
    return { harnessId, localExists, ssdExists, identical: false }
  }

  try {
    const localContent = readFileSync(localPath, 'utf8')
    const ssdContent = readFileSync(ssdPath, 'utf8')
    return { harnessId, localExists, ssdExists, identical: localContent === ssdContent }
  } catch {
    return { harnessId, localExists, ssdExists, identical: false }
  }
}
