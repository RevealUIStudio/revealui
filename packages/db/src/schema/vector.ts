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

export type {
  AgentMemory,
  AgentMemory as AgentMemoryType,
  NewAgentMemory,
  NewAgentMemory as NewAgentMemoryType,
} from './agents.js';
// Re-export table + types for convenience.
// agentMemories lives in NeonDB (not Supabase) due to FK constraints on sites/users,
// but is re-exported here because published @revealui/ai imports it from this path.
export { agentMemories } from './agents.js';

// RAG tables (pgvector-backed, stored on Supabase)
export * from './rag.js';
