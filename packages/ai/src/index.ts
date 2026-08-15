/**
 * @revealui/ai - AI System for RevealUI
 *
 * A comprehensive AI system that provides:
 * - Memory management (Working, Episodic, Semantic)
 * - LLM provider abstractions (OpenAI, Anthropic, etc.)
 * - Agent orchestration and execution
 * - Tool calling system
 * - Vector similarity search
 * - CRDT-based persistent state
 *
 * ## Quick Start
 *
 * ```typescript
 * import { EpisodicMemory } from '@revealui/ai/memory/stores'
 * import { NodeIdService } from '@revealui/ai/memory/services'
 * import { AgentOrchestrator, LLMClient, ToolRegistry } from '@revealui/ai'
 *
 * // Memory operations
 * const memory = new EpisodicMemory(userId, nodeId, db)
 * await memory.add(agentMemory)
 * ```
 *
 * LLM, orchestration, and tools all ship from this root entry today:
 * `LLMClient` and `createLLMClientFromEnv` come from `./llm/client.js`,
 * `AgentOrchestrator` from `./orchestration/orchestrator.js`, and
 * `ToolRegistry` plus `globalToolRegistry` from `./tools/registry.js`.
 * See the re-export block below for the full surface.
 *
 * ## Architecture
 *
 * ```
 * ┌─────────────────────────────────────┐
 * │  React Hooks (useMemory, etc.)      │
 * ├─────────────────────────────────────┤
 * │  AI System                          │
 * │  ├── Memory (Working, Episodic)    │
 * │  ├── LLM (Providers, Client)        │
 * │  ├── Orchestration (Agents)        │
 * │  ├── Tools (Registry, Executor)    │
 * │  └── Skills (Agent Skills)         │
 * ├─────────────────────────────────────┤
 * │  CRDT Core (LWW, OR-Set, Counter)  │
 * ├─────────────────────────────────────┤
 * │  Vector Search (pgvector)          │
 * ├─────────────────────────────────────┤
 * │  Persistence (Drizzle/NeonDB)      │
 * └─────────────────────────────────────┘
 * ```
 *
 * @packageDocumentation
 */

// Re-export A2A protocol
export * from './a2a/index.js';
// Re-export audit trail
export * from './audit/index.js';
// Client-side React hooks are intentionally NOT re-exported here.
// This main entry is server-safe. Use @revealui/ai/client for React hooks.
// Re-export embeddings
export * from './embeddings/index.js';
// Re-export ingestion pipeline (RAG document indexing + hybrid search)
export * from './ingestion/index.js';
export * from './llm/artifact-provenance.js';
// Re-export LLM providers and client
export * from './llm/client.js';
export * from './llm/local-ai-profile.js';
export * from './llm/provider-health.js';
export * from './llm/providers/base.js';
export * from './llm/providers/inference-snaps.js';
export * from './llm/providers/openai-compat.js';
export * from './llm/providers/us-origin-snaps.js';
export * from './llm/resolve.js';
export * from './llm/token-counter.js';
export * from './llm/workspace-provider-config.js';
// Re-export memory system
export * from './memory/index.js';
// Re-export orchestration
export * from './orchestration/agent.js';
export * from './orchestration/defaults.js';
export * from './orchestration/memory-integration.js';
export * from './orchestration/orchestrator.js';
export * from './orchestration/runtime.js';
export * from './orchestration/streaming-runtime.js';
export * from './orchestration/ticket-agent.js';
// Re-export skills
export * from './skills/index.js';
// Re-export specification templates
export * from './templates/index.js';
// Re-export tools
export * from './tools/base.js';
export * from './tools/deduplicator.js';
export * from './tools/document-summarizer.js';
export * from './tools/governance.js';
export * from './tools/integrity-audit.js';
export * from './tools/mcp-adapter.js';
export * from './tools/mcp-elicitation.js';
export * from './tools/mcp-events.js';
export * from './tools/mcp-sampling.js';
export * from './tools/memory/index.js';
export * from './tools/registry.js';
export * from './tools/ticket-tools.js';
export * from './tools/web/index.js';
