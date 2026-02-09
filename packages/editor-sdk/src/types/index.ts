/**
 * @revealui/editor-sdk - Editor Abstraction Types
 *
 * Pure interfaces and types. No editor-specific code.
 * Editors are external executables, never libraries.
 */

/** Capabilities an editor adapter may support */
export interface EditorCapabilities {
  openProject: boolean;
  openFile: boolean;
  jumpToLine: boolean;
  applyConfig: boolean;
  installExtension: boolean;
  getRunningInstances: boolean;
}

/** A command to send to an editor — pure data, no side effects */
export type EditorCommand =
  | { type: "open-project"; path: string }
  | { type: "open-file"; path: string; line?: number; column?: number }
  | { type: "apply-config"; config: Record<string, unknown> }
  | { type: "install-extension"; extensionId: string }
  | { type: "get-status" };

/** Result of executing an editor command */
export interface EditorCommandResult {
  success: boolean;
  command: EditorCommand["type"];
  message?: string;
  data?: unknown;
}

/** Events emitted by editor adapters */
export type EditorEvent =
  | { type: "editor-opened"; editorId: string; pid?: number }
  | { type: "editor-closed"; editorId: string }
  | { type: "file-opened"; editorId: string; path: string }
  | { type: "config-applied"; editorId: string }
  | { type: "error"; editorId: string; error: string };

/** Metadata about a registered editor */
export interface EditorInfo {
  id: string;
  name: string;
  version?: string;
  capabilities: EditorCapabilities;
}
