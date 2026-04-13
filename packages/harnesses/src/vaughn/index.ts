/**
 * VAUGHN Protocol  -  Versioned Agent Unification, Governance, Handoff, and Normalization
 *
 * Phase 2a: Type Foundation + Phase 2b: Runtime Wiring
 *
 * Re-exports all VAUGHN types, schemas, factories, and utilities.
 */

// Adapter
export type {
  GeneratedFiles,
  McpServerConfig,
  VaughnAdapter,
  VaughnAdapterInfo,
  VaughnCommand,
  VaughnCommandResult,
  VaughnConfig,
  VaughnError,
  VaughnErrorCode,
  VaughnRule,
  VaughnSkill,
} from './adapter.js';
// Capabilities
export type {
  HookGranularity,
  MemoryBackend,
  SandboxMode,
  VaughnCapabilities,
} from './capabilities.js';
export { createDefaultCapabilities, TOOL_PROFILES } from './capabilities.js';
// Config normalization (Phase 2b)
export type { ClaudeCodeSettings, ConfigGenerationResult } from './config-normalizer.js';
export {
  claudeSettingsToVaughnConfig,
  generateAllConfigs,
  vaughnConfigToAgentsMd,
  vaughnConfigToClaudeSettings,
  vaughnConfigToCursorrules,
} from './config-normalizer.js';
// Degradation
export type { DegradationStrategy } from './degradation-strategies.js';
export { getDegradationStrategy } from './degradation-strategies.js';
// Events
export type { VaughnEvent, VaughnEventEnvelope } from './event-envelope.js';
export {
  createEventEnvelope,
  VAUGHN_EVENTS,
  VAUGHN_VERSION,
  vaughnEventEnvelopeSchema,
  vaughnEventSchema,
} from './event-envelope.js';
// Event normalization (Phase 2b)
export type { NormalizedEvent } from './event-normalizer.js';
export { VaughnEventNormalizer } from './event-normalizer.js';
