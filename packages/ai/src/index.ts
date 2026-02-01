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
 * import { EpisodicMemory } from '@revealui/ai/memory/memory'
 * import { NodeIdService } from '@revealui/ai/memory/services'
 *
 * // Memory operations
 * const memory = new EpisodicMemory(userId, nodeId, db)
 * await memory.add(agentMemory)
 *
 * // LLM, orchestration, and tools coming soon
 * ```
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

// Re-export client (client-side) modules
export * from './client/index.js'
// Re-export embeddings
export * from './embeddings/index.js'
// Re-export LLM providers and client
export * from './llm/client.js'
export * from './llm/providers/anthropic.js'
export * from './llm/providers/base.js'
export * from './llm/providers/openai.js'
// Re-export memory system
export * from './memory/index.js'
// Re-export orchestration
export * from './orchestration/agent.js'
export * from './orchestration/memory-integration.js'
export * from './orchestration/orchestrator.js'
export * from './orchestration/runtime.js'
// Re-export skills
export * from './skills/index.js'
// Re-export tools
export * from './tools/base.js'
export * from './tools/mcp-adapter.js'
export * from './tools/registry.js'
