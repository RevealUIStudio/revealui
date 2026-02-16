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

// Export agent schemas except agentMemories
// Note: AgentMemory types are exported from './vector.js' instead
export {
  type AgentAction,
  type AgentContext,
  agentActions,
  agentContexts,
  type Conversation,
  conversations,
  messages,
  type NewAgentAction,
  type NewAgentContext,
  type NewConversation,
  syncMetadata,
  userDevices,
} from './agents.js'
export * from './audit-log.js'
// Export all REST schemas
export * from './cms.js'
export * from './crdt-operations.js'
export * from './licenses.js'
export * from './node-ids.js'
export * from './pages.js'
export * from './password-reset-tokens.js'
export * from './query.js'
export * from './rate-limits.js'
export * from './sites.js'
export * from './todos.js'
export * from './users.js'
export * from './waitlist.js'

// Note: Relations are defined in index.ts to avoid circular dependencies
// They reference agentMemories which is in vector.ts, so we don't export them here
// Relations can still be used via the main index.ts export
