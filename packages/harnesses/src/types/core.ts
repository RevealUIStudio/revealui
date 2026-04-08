/**
 * Core types for the AI harness integration system.
 * Mirrors packages/editors/src/types/core.ts for the harness domain.
 */

export interface HarnessCapabilities {
  /** Can generate code from a prompt */
  generateCode: boolean;
  /** Can analyze/explain existing code */
  analyzeCode: boolean;
  /** Can apply inline code edits */
  applyEdit: boolean;
  /** Can sync configuration files */
  applyConfig: boolean;
  /** Can query workboard state */
  readWorkboard: boolean;
  /** Can write workboard state */
  writeWorkboard: boolean;
}

export type ConfigSyncDirection = 'push' | 'pull';

export type HarnessCommand =
  | { type: 'generate-code'; prompt: string; context?: string; language?: string }
  | { type: 'analyze-code'; filePath: string; question?: string }
  | { type: 'apply-edit'; filePath: string; diff: string }
  | { type: 'apply-config'; configPath: string; content: string }
  | { type: 'get-status' }
  | { type: 'get-running-instances' }
  | { type: 'sync-config'; direction: ConfigSyncDirection }
  | { type: 'diff-config' }
  | { type: 'read-workboard' }
  | { type: 'update-workboard'; sessionId: string; task?: string; files?: string[] }
  | { type: 'headless-prompt'; prompt: string; maxTurns?: number; timeoutMs?: number };

export interface HarnessCommandResult {
  success: boolean;
  command: HarnessCommand['type'];
  message?: string;
  data?: unknown;
}

export type HarnessEvent =
  | { type: 'harness-connected'; harnessId: string }
  | { type: 'harness-disconnected'; harnessId: string }
  | { type: 'generation-started'; taskId: string }
  | { type: 'generation-completed'; taskId: string; output: string }
  | { type: 'error'; harnessId: string; message: string };

export interface HarnessInfo {
  id: string;
  name: string;
  version?: string;
  capabilities: HarnessCapabilities;
}

export interface HarnessProcessInfo {
  pid: number;
  command: string;
  harnessId: string;
}

export interface ConfigSyncResult {
  success: boolean;
  harnessId: string;
  direction: ConfigSyncDirection;
  message?: string;
}

export interface ConfigDiffEntry {
  harnessId: string;
  localExists: boolean;
  ssdExists: boolean;
  identical: boolean;
}

export interface HealthCheckResult {
  healthy: boolean;
  timestamp: string;
  registeredHarnesses: Array<{
    harnessId: string;
    available: boolean;
  }>;
  workboard: {
    readable: boolean;
    sessionCount: number;
    staleSessionIds: string[];
  };
  diagnostics: string[];
}
