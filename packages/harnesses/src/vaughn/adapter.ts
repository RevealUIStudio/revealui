/**
 * VAUGHN Adapter Interface (Section 7 of VAUGHN.md)
 *
 * The adapter is the boundary between a tool's native interface and the
 * VAUGHN protocol. This extends the existing HarnessAdapter with full
 * VAUGHN capabilities.
 */

import type { WorkboardState } from '../workboard/workboard-protocol.js';
import type { VaughnCapabilities } from './capabilities.js';
import type { VaughnEventEnvelope } from './event-envelope.js';

// ── Configuration Types (Section 6.1) ─────────────────────────────────────

/** MCP server configuration entry. */
export interface McpServerConfig {
  name: string;
  command: string;
  args?: string[];
  env?: Record<string, string>;
}

/** Canonical configuration schema (Section 6.1). */
export interface VaughnConfig {
  identity: {
    name: string;
    email: string;
    role?: string;
  };
  permissions: {
    autoApprove: string[];
    deny: string[];
    sandboxMode?: 'read-only' | 'workspace-write' | 'full-access';
  };
  environment: {
    variables: Record<string, string>;
    mcpServers: McpServerConfig[];
  };
  rules: VaughnRule[];
  skills: VaughnSkill[];
  commands: VaughnCommand[];
}

/** Tool-agnostic rule definition (Section 6.3). */
export interface VaughnRule {
  id: string;
  description: string;
  content: string;
  appliesTo: string[];
  variables: Record<string, string>;
}

/** Tool-agnostic skill definition. */
export interface VaughnSkill {
  id: string;
  name: string;
  description: string;
  instructions: string;
}

/** Tool-agnostic command definition. */
export interface VaughnCommand {
  id: string;
  name: string;
  description: string;
  steps: string[];
}

// ── Generated Files ───────────────────────────────────────────────────────

/** Result of config generation: a map of file paths to contents. */
export interface GeneratedFiles {
  files: Map<string, string>;
}

// ── Command Result ────────────────────────────────────────────────────────

/** Result of executing a VAUGHN command. */
export interface VaughnCommandResult {
  success: boolean;
  message?: string;
  data?: unknown;
}

// ── Error Types (Section 11) ──────────────────────────────────────────────

/** VAUGHN error codes (Section 11.1). */
export type VaughnErrorCode =
  | 'ADAPTER_UNAVAILABLE'
  | 'CAPABILITY_MISSING'
  | 'TASK_ALREADY_CLAIMED'
  | 'TASK_NOT_FOUND'
  | 'CONFLICT_DETECTED'
  | 'HOOK_BLOCKED'
  | 'SANDBOX_DENIED'
  | 'SESSION_EXPIRED'
  | 'CONFIG_INVALID'
  | 'TOOL_RESERVED'
  | 'WORKBOARD_LOCKED'
  | 'IDENTITY_CONFLICT';

/** Structured error envelope (Section 11.2). */
export interface VaughnError {
  code: VaughnErrorCode;
  message: string;
  agentId?: string;
  details?: Record<string, unknown>;
}

// ── Adapter Info ──────────────────────────────────────────────────────────

/** Summary information about a registered adapter. */
export interface VaughnAdapterInfo {
  id: string;
  available: boolean;
  version: string | null;
  capabilities: VaughnCapabilities;
}

// ── Adapter Interface (Section 7.1) ───────────────────────────────────────

/**
 * Contract for a VAUGHN adapter.
 *
 * This is the full VAUGHN interface. Existing HarnessAdapters can be
 * wrapped to implement this interface incrementally.
 */
export interface VaughnAdapter {
  /** Unique stable identifier, e.g. 'claude-code', 'codex', 'revealui-agent' */
  readonly id: string;

  /** Full capability declaration */
  readonly capabilities: VaughnCapabilities;

  /** Initialize the adapter (connect to tool, set up event listeners) */
  initialize(): Promise<void>;

  /** Release all resources held by this adapter */
  dispose(): Promise<void>;

  /** True if the tool is installed and accessible */
  isAvailable(): Promise<boolean>;

  /** Tool version string, or null if unavailable */
  getVersion(): Promise<string | null>;

  /** Subscribe to VAUGHN-normalized events (adapter -> coordinator) */
  onEvent(handler: (event: VaughnEventEnvelope) => void): void;

  /** Execute a typed command against this tool (coordinator -> adapter) */
  execute?(command: VaughnCommand): Promise<VaughnCommandResult>;

  /** Generate tool-native config files from canonical VAUGHN config */
  generateConfig(config: VaughnConfig): Promise<GeneratedFiles>;

  /** Read tool-native config and parse into canonical form (optional) */
  readConfig?(): Promise<Partial<VaughnConfig>>;

  /** Read workboard state through the tool's native interface (if capable) */
  readWorkboard?(): Promise<WorkboardState>;

  /** Write workboard state through the tool's native interface (if capable) */
  writeWorkboard?(state: WorkboardState): Promise<void>;
}
