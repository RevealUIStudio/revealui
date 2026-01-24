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
// Note: AgentMemory types are exported from './vector' instead
export {
  type AgentAction,
  type AgentContext,
  agentActions,
  agentContexts,
  type Conversation,
  conversations,
  type NewAgentAction,
  type NewAgentContext,
  type NewConversation,
} from './agents'
// Export all REST schemas
export * from './cms'
export * from './crdt-operations'
export * from './node-ids'
export * from './pages'
export * from './query'
export * from './rate-limits'
export * from './sites'
export * from './users'

// Note: Relations are defined in index.ts to avoid circular dependencies
// They reference agentMemories which is in vector.ts, so we don't export them here
// Relations can still be used via the main index.ts export
