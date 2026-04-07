/**
 * @revealui/db/schema/rest - REST API Schemas (NeonDB)
 *
 * All database schemas for REST API operations, excluding vector-specific tables.
 * This includes:
 * - Users, sessions, authentication
 * - Sites, pages, CMS content
 * - Media, posts, metadata
 * - Agent contexts, conversations, actions (but NOT agent_memories)
 */

// Export agent schemas — agentMemories lives in NeonDB (same as all other tables)
// despite having a vector column, because its FK constraints reference NeonDB tables.
export * from './accounts.js';
export {
  type AgentAction,
  type AgentContext,
  type AgentCreditBalance,
  type AgentMemory,
  type AgentTaskUsage,
  type AiMemorySession,
  agentActions,
  agentContexts,
  agentCreditBalance,
  agentMemories,
  agentTaskUsage,
  aiMemorySessions,
  type Conversation,
  conversations,
  messages,
  type NewAgentAction,
  type NewAgentContext,
  type NewAgentCreditBalance,
  type NewAgentTaskUsage,
  type NewAiMemorySession,
  type NewConversation,
  type NewRegisteredAgent,
  type RegisteredAgent,
  registeredAgents,
  syncMetadata,
  userDevices,
} from './agents.js';
export * from './api-keys.js';
export * from './app-logs.js';
export * from './audit-log.js';
export * from './circuit-breaker.js';
// Export all REST schemas
export * from './cms.js';
export * from './code-provenance.js';
export * from './collab-edits.js';
export * from './coordination.js';
export * from './crdt-operations.js';
export * from './error-events.js';
export * from './gdpr.js';
export * from './idempotency.js';
export * from './jobs.js';
export * from './licenses.js';
export * from './magic-links.js';
export * from './marketplace.js';
export * from './node-ids.js';
export * from './oauth-accounts.js';
export * from './pages.js';
export * from './passkeys.js';
export * from './password-reset-tokens.js';
export * from './products.js';
export * from './rate-limits.js';
export * from './revealcoin.js';
export * from './revmarket.js';
export * from './sites.js';
export * from './tenants.js';
export * from './tickets.js';
export * from './users.js';
export * from './waitlist.js';
export * from './webhook-events.js';
export * from './yjs-documents.js';

// Note: Relations are defined in index.ts to avoid circular dependencies
// They reference agentMemories which is in vector.ts, so we don't export them here
// Relations can still be used via the main index.ts export
