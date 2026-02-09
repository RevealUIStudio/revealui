/**
 * @revealui/editor-sdk - Editor Abstraction Types
 *
 * Pure interfaces and types. No editor-specific code.
 * Editors are external executables, never libraries.
 */

/** Capabilities an editor adapter may support */
export interface EditorCapabilities {
  openProject: boolean
  openFile: boolean
  jumpToLine: boolean
  applyConfig: boolean
  installExtension: boolean
  getRunningInstances: boolean
}

/** Direction for config sync operations */
export type ConfigSyncDirection = 'push' | 'pull'

/** A command to send to an editor — pure data, no side effects */
export type EditorCommand =
  | { type: 'open-project'; path: string }
  | { type: 'open-file'; path: string; line?: number; column?: number }
  | { type: 'apply-config'; config: Record<string, unknown> }
  | { type: 'install-extension'; extensionId: string }
  | { type: 'get-status' }
  | { type: 'get-running-instances' }
  | { type: 'sync-config'; direction: ConfigSyncDirection }
  | { type: 'diff-config' }

/** Result of executing an editor command */
export interface EditorCommandResult {
  success: boolean
  command: EditorCommand['type']
  message?: string
  data?: unknown
}

/** Events emitted by editor adapters */
export type EditorEvent =
  | { type: 'editor-opened'; editorId: string; pid?: number }
  | { type: 'editor-closed'; editorId: string }
  | { type: 'file-opened'; editorId: string; path: string }
  | { type: 'config-applied'; editorId: string }
  | { type: 'error'; editorId: string; error: string }

/** Metadata about a registered editor */
export interface EditorInfo {
  id: string
  name: string
  version?: string
  capabilities: EditorCapabilities
}

/** Information about a running editor process */
export interface EditorProcessInfo {
  pid: number
  command: string
  editorId: string
}

/** Result of a config sync operation */
export interface ConfigSyncResult {
  success: boolean
  editorId: string
  direction: ConfigSyncDirection
  message?: string
}

/** Result of comparing local vs SSD config */
export interface ConfigDiffEntry {
  editorId: string
  localExists: boolean
  ssdExists: boolean
  identical: boolean
}
