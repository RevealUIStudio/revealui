/**
 * @revealui/db/core/vector - Vector Database Schemas (Supabase)
 *
 * Vector-specific database schemas for AI/vector operations.
 * Currently only includes agent_memories table for semantic search.
 */

// Only vector-related schemas
export { agentMemories } from './agents'
export type { AgentMemory, NewAgentMemory } from './agents'

// Re-export for convenience (these types are also available from @revealui/schema/agents)
export type { AgentMemory as AgentMemoryType, NewAgentMemory as NewAgentMemoryType } from './agents'