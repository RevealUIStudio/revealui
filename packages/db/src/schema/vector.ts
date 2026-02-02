/**
 * @revealui/db/schema/vector - Vector Database Schemas (Supabase)
 *
 * Vector-specific database schemas for AI/vector operations.
 * Currently only includes agent_memories table for semantic search.
 */

// Re-export for convenience (these types are also available from @revealui/contracts/agents)
export type {
  AgentMemory,
  AgentMemory as AgentMemoryType,
  NewAgentMemory,
  NewAgentMemory as NewAgentMemoryType,
} from './agents.js'
// Only vector-related schemas
export { agentMemories } from './agents.js'
