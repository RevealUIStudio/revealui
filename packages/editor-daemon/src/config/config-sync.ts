import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname } from 'node:path'
import { getLocalConfigPath, getSsdConfigPath } from './editor-config-paths.js'

export type ConfigSyncDirection = 'push' | 'pull'

export interface ConfigSyncResult {
  success: boolean
  editorId: string
  direction: ConfigSyncDirection
  message?: string
}

export interface ConfigDiffEntry {
  editorId: string
  localExists: boolean
  ssdExists: boolean
  identical: boolean
}

async function readFileSafe(path: string): Promise<string | null> {
  try {
    return await readFile(path, 'utf-8')
  } catch {
    return null
  }
}

/**
 * Sync config between local and SSD.
 * - push: copy SSD → local
 * - pull: copy local → SSD
 */
export async function syncConfig(
  editorId: string,
  direction: ConfigSyncDirection,
  ssdBase?: string,
): Promise<ConfigSyncResult> {
  const localPath = getLocalConfigPath(editorId)
  const ssdPath = getSsdConfigPath(editorId, ssdBase)

  if (!(localPath && ssdPath)) {
    return { success: false, editorId, direction, message: `Unknown editor: ${editorId}` }
  }

  try {
    if (direction === 'push') {
      // SSD → local
      const content = await readFileSafe(ssdPath)
      if (content === null) {
        return { success: false, editorId, direction, message: `SSD config not found: ${ssdPath}` }
      }
      await mkdir(dirname(localPath), { recursive: true })
      await writeFile(localPath, content, 'utf-8')
    } else {
      // local → SSD
      const content = await readFileSafe(localPath)
      if (content === null) {
        return {
          success: false,
          editorId,
          direction,
          message: `Local config not found: ${localPath}`,
        }
      }
      await mkdir(dirname(ssdPath), { recursive: true })
      await writeFile(ssdPath, content, 'utf-8')
    }
    return { success: true, editorId, direction }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    return { success: false, editorId, direction, message }
  }
}

/** Compare local config vs SSD config for an editor */
export async function diffConfig(editorId: string, ssdBase?: string): Promise<ConfigDiffEntry> {
  const localPath = getLocalConfigPath(editorId)
  const ssdPath = getSsdConfigPath(editorId, ssdBase)

  if (!(localPath && ssdPath)) {
    return { editorId, localExists: false, ssdExists: false, identical: false }
  }

  const [localContent, ssdContent] = await Promise.all([
    readFileSafe(localPath),
    readFileSafe(ssdPath),
  ])

  return {
    editorId,
    localExists: localContent !== null,
    ssdExists: ssdContent !== null,
    identical: localContent !== null && ssdContent !== null && localContent === ssdContent,
  }
}
