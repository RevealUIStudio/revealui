import type {
  EditorCapabilities,
  EditorCommand,
  EditorCommandResult,
  EditorEvent,
  EditorInfo,
} from "../types/index.js";

/**
 * EditorAdapter — the contract every editor integration must implement.
 *
 * Key safety rules:
 * - Editors are external executables, never linked libraries
 * - Communication is data-only (commands in, results out)
 * - Adapters use spawn() and filesystem writes, never dynamic linking
 * - If the editor is uninstalled, RevealUI still runs
 */
export interface EditorAdapter {
  readonly id: string;
  readonly name: string;
  getCapabilities(): EditorCapabilities;
  getInfo(): Promise<EditorInfo>;
  isAvailable(): Promise<boolean>;
  execute(command: EditorCommand): Promise<EditorCommandResult>;
  onEvent(handler: (event: EditorEvent) => void): () => void;
  dispose(): Promise<void>;
}
