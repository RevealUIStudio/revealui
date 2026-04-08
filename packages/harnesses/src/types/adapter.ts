import type {
  HarnessCapabilities,
  HarnessCommand,
  HarnessCommandResult,
  HarnessEvent,
  HarnessInfo,
} from './core.js';

/**
 * Contract every AI harness adapter must satisfy.
 * Mirrors EditorAdapter from packages/editors.
 *
 * AI tools are external executables — never linked libraries.
 * Communication is data-only: commands in, results out.
 */
export interface HarnessAdapter {
  /** Unique stable identifier, e.g. "claude-code", "cursor", "copilot" */
  readonly id: string;
  /** Human-readable display name */
  readonly name: string;
  /** Returns the static capability set for this harness */
  getCapabilities(): HarnessCapabilities;
  /** Returns live info (version, etc.) — may shell out */
  getInfo(): Promise<HarnessInfo>;
  /** True if the harness executable is on PATH and accessible */
  isAvailable(): Promise<boolean>;
  /** Execute a typed command against this harness */
  execute(command: HarnessCommand): Promise<HarnessCommandResult>;
  /** Subscribe to harness events; returns an unsubscribe function */
  onEvent(handler: (event: HarnessEvent) => void): () => void;
  /** Release all resources held by this adapter */
  dispose(): Promise<void>;
  /** Called by the registry after this adapter has been registered. */
  notifyRegistered?(): void;
  /** Called by the registry just before this adapter is unregistered. */
  notifyUnregistering?(): void;
}
