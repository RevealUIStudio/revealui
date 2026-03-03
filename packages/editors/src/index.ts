import { isFeatureEnabled } from '@revealui/core/features'
import { initializeLicense } from '@revealui/core/license'
import { logger } from '@revealui/core/observability/logger'

/**
 * Check if the editors package is licensed for use.
 * Initializes the license cache from environment variables, then checks the tier.
 * Returns false with a warning log if no Pro/Enterprise license is active.
 */
export async function checkEditorsLicense(): Promise<boolean> {
  await initializeLicense()
  if (!isFeatureEnabled('editors')) {
    logger.warn(
      '[@revealui/editors] Editor integration requires a Pro or Enterprise license. ' +
        'Visit https://revealui.com/pricing for details.',
    )
    return false
  }
  return true
}

// Types

// Adapters
export { NeovimAdapter } from './adapters/neovim-adapter.js'
export { VscodeAdapter } from './adapters/vscode-adapter.js'
export { ZedAdapter } from './adapters/zed-adapter.js'
// Config
export { diffConfig, syncConfig } from './config/config-sync.js'
export {
  getConfigurableEditors,
  getLocalConfigPath,
  getSsdConfigPath,
} from './config/editor-config-paths.js'
// Detection
export { autoDetectEditors } from './detection/auto-detector.js'
export {
  findAllEditorProcesses,
  findEditorProcesses,
  findNeovimSockets,
  findProcesses,
} from './detection/process-detector.js'
// Registry
export { EditorRegistry } from './registry/editor-registry.js'
// Server
export { RpcServer } from './server/rpc-server.js'
export type {
  ConfigDiffEntry,
  ConfigSyncDirection,
  ConfigSyncResult,
  EditorAdapter,
  EditorCapabilities,
  EditorCommand,
  EditorCommandResult,
  EditorEvent,
  EditorInfo,
  EditorProcessInfo,
} from './types/index.js'
