/**
 * @revealui/db/schema/vector - Vector-Capable Database Schemas
 *
 * Schemas for AI/vector operations that require pgvector.
 *
 * ARCHITECTURE NOTE: Despite the "vector" naming, `agentMemories` currently
 * lives in NeonDB (not Supabase) because its FK constraints reference
 * NeonDB's `sites` and `users` tables. Cross-database FKs are not possible.
 * The table is re-exported here for semantic grouping (it uses vector embeddings),
 * but its data resides in the REST (Neon) database.
 *
 * RAG tables also require pgvector and follow the same pattern.
 */

// Re-export for convenience (these types are also available from @revealui/contracts/agents)
export type {
  AgentMemory,
  AgentMemory as AgentMemoryType,
  NewAgentMemory,
  NewAgentMemory as NewAgentMemoryType,
} from './agents.js';
// Vector-capable schemas (require pgvector, but live in NeonDB due to FK constraints)
export { agentMemories } from './agents.js';
// RAG tables (pgvector-backed, stored on Supabase)
export * from './rag.js';
