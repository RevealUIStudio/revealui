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
