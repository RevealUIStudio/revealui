/**
 * Harness Protocol Adapter Interface
 *
 * The adapter is the boundary between a tool's native interface and the
 * Harness Protocol. This extends the existing HarnessAdapter with full
 * protocol capabilities (capability declaration, normalized events,
 * config generation, optional workboard access).
 */

import type { WorkboardState } from '../workboard/workboard-protocol.js';
import type { ProtocolCapabilities } from './capabilities.js';
import type { ProtocolEventEnvelope } from './event-envelope.js';

// ── Configuration Types ───────────────────────────────────────────────────

/** MCP server configuration entry. */
export interface McpServerConfig {
  name: string;
  command: string;
  args?: string[];
  env?: Record<string, string>;
}

/** Canonical configuration schema. */
export interface ProtocolConfig {
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
  rules: ProtocolRule[];
  skills: ProtocolSkill[];
  commands: ProtocolCommand[];
}

/** Tool-agnostic rule definition. */
export interface ProtocolRule {
  id: string;
  description: string;
  content: string;
  appliesTo: string[];
  variables: Record<string, string>;
}

/** Tool-agnostic skill definition. */
export interface ProtocolSkill {
  id: string;
  name: string;
  description: string;
  instructions: string;
}

/** Tool-agnostic command definition. */
export interface ProtocolCommand {
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

/** Result of executing a protocol command. */
export interface ProtocolCommandResult {
  success: boolean;
  message?: string;
  data?: unknown;
}

// ── Error Types ───────────────────────────────────────────────────────────

/** Protocol error codes. */
export type ProtocolErrorCode =
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

/** Structured error envelope. */
export interface ProtocolError {
  code: ProtocolErrorCode;
  message: string;
  agentId?: string;
  details?: Record<string, unknown>;
}

// ── Adapter Info ──────────────────────────────────────────────────────────

/** Summary information about a registered adapter. */
export interface ProtocolAdapterInfo {
  id: string;
  available: boolean;
  version: string | null;
  capabilities: ProtocolCapabilities;
}

// ── Adapter Interface ─────────────────────────────────────────────────────

/**
 * Contract for a Harness Protocol adapter.
 *
 * This is the full protocol interface. Existing HarnessAdapters can be
 * wrapped to implement this interface incrementally.
 */
export interface ProtocolAdapter {
  /** Unique stable identifier, e.g. 'claude-code', 'codex', 'revealui-agent' */
  readonly id: string;

  /** Full capability declaration */
  readonly capabilities: ProtocolCapabilities;

  /** Initialize the adapter (connect to tool, set up event listeners) */
  initialize(): Promise<void>;

  /** Release all resources held by this adapter */
  dispose(): Promise<void>;

  /** True if the tool is installed and accessible */
  isAvailable(): Promise<boolean>;

  /** Tool version string, or null if unavailable */
  getVersion(): Promise<string | null>;

  /** Subscribe to normalized protocol events (adapter -> coordinator) */
  onEvent(handler: (event: ProtocolEventEnvelope) => void): void;

  /** Execute a typed command against this tool (coordinator -> adapter) */
  execute?(command: ProtocolCommand): Promise<ProtocolCommandResult>;

  /** Generate tool-native config files from canonical ProtocolConfig */
  generateConfig(config: ProtocolConfig): Promise<GeneratedFiles>;

  /** Read tool-native config and parse into canonical form (optional) */
  readConfig?(): Promise<Partial<ProtocolConfig>>;

  /** Read workboard state through the tool's native interface (if capable) */
  readWorkboard?(): Promise<WorkboardState>;

  /** Write workboard state through the tool's native interface (if capable) */
  writeWorkboard?(state: WorkboardState): Promise<void>;
}
