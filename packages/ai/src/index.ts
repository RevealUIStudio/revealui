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
 * │  └── Tools (Registry, Executor)    │
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
export * from './client/index'
export * from './llm/client'
export * from './llm/providers/anthropic'
// Re-export LLM providers and client
export * from './llm/providers/base'
export * from './llm/providers/openai'
// Re-export memory system
export * from './memory/index'
// Re-export orchestration
export * from './orchestration/agent'
export * from './orchestration/memory-integration'
export * from './orchestration/orchestrator'
export * from './orchestration/runtime'
// Re-export tools
export * from './tools/base'
export * from './tools/mcp-adapter'
export * from './tools/registry'
