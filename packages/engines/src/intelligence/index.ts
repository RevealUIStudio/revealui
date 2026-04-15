/**
 * Intelligence primitive — AI agents, memory, LLM providers, RAG, and tools.
 *
 * Re-exports from @revealui/ai, @revealui/db, and @revealui/contracts.
 */

// ── AI: all exports (memory, LLM, orchestration, tools, embeddings, A2A, skills) ──
export * from '@revealui/ai';
// ── Contracts: agent schemas ────────────────────────────────────────────────
// ── Contracts: A2A protocol types ───────────────────────────────────────────
// ── Contracts: embeddings ───────────────────────────────────────────────────
export {
  type A2AAgentCard,
  A2AAgentCardSchema,
  type A2ACapabilities,
  type A2AJsonRpcRequest,
  type A2AMessage,
  type A2ASkill,
  type A2ATask,
  type A2ATaskState,
  type A2ATaskStatus,
  AGENT_SCHEMA_VERSION,
  type AgentActionRecord,
  AgentActionRecordSchema,
  type AgentContext,
  AgentContextSchema,
  type AgentDefinition,
  AgentDefinitionSchema,
  type AgentMemory,
  AgentMemorySchema,
  type AgentState,
  AgentStateSchema,
  agentDefinitionToCard,
  type Conversation,
  type ConversationMessage,
  ConversationMessageSchema,
  ConversationSchema,
  createAgentContext,
  createAgentMemory,
  createConversation,
  createEmbedding,
  createMessage,
  DEFAULT_EMBEDDING_DIMENSION,
  DEFAULT_EMBEDDING_MODEL,
  EMBEDDING_DIMENSIONS,
  type Embedding,
  type EmbeddingModel,
  EmbeddingSchema,
  type Intent,
  IntentSchema,
  type IntentType,
  type MemorySource,
  type MemoryType,
  type ToolDefinition,
  ToolDefinitionSchema,
  toolDefinitionToSkill,
} from '@revealui/contracts';
// ── DB: intelligence tables ─────────────────────────────────────────────────
export {
  agentActions,
  agentContexts,
  agentMemories,
  codeProvenance,
  codeReviews,
  conversations,
  ragChunks,
  ragDocuments,
} from '@revealui/db';
