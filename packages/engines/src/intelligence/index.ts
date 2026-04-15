/**
 * Intelligence primitive — AI agents, memory, LLM providers, RAG, and tools.
 *
 * Re-exports from @revealui/ai, @revealui/db, and @revealui/contracts.
 */

// ── AI: all exports (memory, LLM, orchestration, tools, embeddings, A2A, skills) ──
export * from '@revealui/ai';

// ── DB: intelligence tables ─────────────────────────────────────────────────
export {
  agentContexts,
  agentMemories,
  agentActions,
  conversations,
  ragDocuments,
  ragChunks,
  codeProvenance,
  codeReviews,
} from '@revealui/db';

// ── Contracts: agent schemas ────────────────────────────────────────────────
export {
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
  type Conversation,
  ConversationSchema,
  type ConversationMessage,
  ConversationMessageSchema,
  type Intent,
  IntentSchema,
  type ToolDefinition,
  ToolDefinitionSchema,
  type MemoryType,
  type MemorySource,
  type IntentType,
  createAgentMemory,
  createAgentContext,
  createConversation,
  createMessage,
} from '@revealui/contracts';

// ── Contracts: A2A protocol types ───────────────────────────────────────────
export {
  type A2AAgentCard,
  A2AAgentCardSchema,
  type A2ACapabilities,
  type A2ASkill,
  type A2ATask,
  type A2ATaskState,
  type A2ATaskStatus,
  type A2AMessage,
  type A2AJsonRpcRequest,
  agentDefinitionToCard,
  toolDefinitionToSkill,
} from '@revealui/contracts';

// ── Contracts: embeddings ───────────────────────────────────────────────────
export {
  createEmbedding,
  DEFAULT_EMBEDDING_DIMENSION,
  DEFAULT_EMBEDDING_MODEL,
  EMBEDDING_DIMENSIONS,
  type Embedding,
  type EmbeddingModel,
  EmbeddingSchema,
} from '@revealui/contracts';
