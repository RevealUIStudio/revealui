/**
 * VAUGHN Protocol  -  Versioned Agent Unification, Governance, Handoff, and Normalization
 *
 * Phase 2a: Type Foundation
 *
 * Re-exports all VAUGHN types, schemas, factories, and utilities.
 */

// Capabilities
export type {
  HookGranularity,
  MemoryBackend,
  SandboxMode,
  VaughnCapabilities,
} from './capabilities.js';
export { createDefaultCapabilities, TOOL_PROFILES } from './capabilities.js';

// Events
export type { VaughnEvent, VaughnEventEnvelope } from './event-envelope.js';
export {
  createEventEnvelope,
  VAUGHN_EVENTS,
  vaughnEventEnvelopeSchema,
  vaughnEventSchema,
  VAUGHN_VERSION,
} from './event-envelope.js';

// Degradation
export type { DegradationStrategy } from './degradation-strategies.js';
export { getDegradationStrategy } from './degradation-strategies.js';

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
