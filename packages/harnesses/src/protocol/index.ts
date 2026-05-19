/**
 * Harness Protocol  -  agent-tool coordination layer for @revealui/harnesses
 *
 * Re-exports all protocol types, schemas, factories, and utilities.
 *
 * Historical note: this protocol was originally named VAUGHN. Renamed
 * 2026-05-18; see docs/HARNESS_PROTOCOL.md for context. RPC method
 * names (`vaughn.*`) are preserved for wire-format stability.
 */

// Adapter
export type {
  GeneratedFiles,
  McpServerConfig,
  ProtocolAdapter,
  ProtocolAdapterInfo,
  ProtocolCommand,
  ProtocolCommandResult,
  ProtocolConfig,
  ProtocolError,
  ProtocolErrorCode,
  ProtocolRule,
  ProtocolSkill,
} from './adapter.js';
// Capabilities
export type {
  HookGranularity,
  MemoryBackend,
  ProtocolCapabilities,
  SandboxMode,
} from './capabilities.js';
export { createDefaultCapabilities, TOOL_PROFILES } from './capabilities.js';
// Config normalization
export type { ClaudeCodeSettings, ConfigGenerationResult } from './config-normalizer.js';
export {
  claudeSettingsToProtocolConfig,
  generateAllConfigs,
  protocolConfigToAgentsMd,
  protocolConfigToClaudeSettings,
  protocolConfigToCursorrules,
} from './config-normalizer.js';
// Degradation
export type { DegradationStrategy } from './degradation-strategies.js';
export { getDegradationStrategy } from './degradation-strategies.js';
// Events
export type { ProtocolEvent, ProtocolEventEnvelope } from './event-envelope.js';
export {
  createEventEnvelope,
  PROTOCOL_EVENTS,
  PROTOCOL_VERSION,
  protocolEventEnvelopeSchema,
  protocolEventSchema,
} from './event-envelope.js';
// Event normalization
export type { NormalizedEvent } from './event-normalizer.js';
export { EventNormalizer } from './event-normalizer.js';
