/**
 * @revealui/db/schema/vector - Vector-Capable Database Schemas
 *
 * Schemas for AI/vector operations that require pgvector.
 *
 * NAMING NOTE: the "vector" name refers to pgvector embeddings, not a separate
 * vector database. Every table grouped here lives in the single Neon (Postgres)
 * database alongside the rest of the schema. `agentMemories` is grouped here
 * because it uses vector embeddings, and its FK constraints reference Neon's
 * `sites` and `users` tables.
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
// agentMemories lives in the Neon database; it is re-exported here because the
// published @revealui/ai package imports it from this path.
export { agentMemories } from './agents.js';

// RAG tables (pgvector-backed, stored on Neon)
export * from './rag.js';
