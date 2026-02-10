import { homedir } from 'node:os'
import { resolve } from 'node:path'

/** Known config file paths per editor */
const CONFIG_PATHS: Record<string, string> = {
  zed: resolve(homedir(), '.config', 'zed', 'settings.json'),
  vscode: resolve(homedir(), '.config', 'Code', 'User', 'settings.json'),
  neovim: resolve(homedir(), '.config', 'nvim', 'init.lua'),
}

/** Get the local config path for an editor */
export function getLocalConfigPath(editorId: string): string | undefined {
  return CONFIG_PATHS[editorId]
}

/** Get the SSD backup path for an editor config */
export function getSsdConfigPath(editorId: string, ssdBase?: string): string | undefined {
  const base = ssdBase ?? process.env.REVEALUI_SSD_PATH ?? '/mnt/e/.revealui'
  if (!CONFIG_PATHS[editorId]) return undefined
  return resolve(base, 'editor-configs', editorId, configFileName(editorId))
}

function configFileName(editorId: string): string {
  switch (editorId) {
    case 'zed':
      return 'settings.json'
    case 'vscode':
      return 'settings.json'
    case 'neovim':
      return 'init.lua'
    default:
      return 'config'
  }
}

/** Get all known editor IDs that have config paths */
export function getConfigurableEditors(): string[] {
  return Object.keys(CONFIG_PATHS)
}
