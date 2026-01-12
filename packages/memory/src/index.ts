/**
 * @revealui/memory - CRDT-based Persistent Memory System
 *
 * A production-ready memory system for RevealUI that enables:
 * - Real-time collaboration via CRDTs
 * - Offline-first operation with sync-on-reconnect
 * - Hierarchical memory management
 * - Vector similarity search
 *
 * ## Quick Start
 *
 * ```typescript
 * import { LWWRegister, ORSet, PNCounter } from '@revealui/memory/core'
 *
 * // Create a last-writer-wins register for settings
 * const settings = LWWRegister.create<Settings>({ theme: 'dark' })
 * settings.set({ theme: 'light' })
 *
 * // Create an OR-Set for memory storage
 * const memories = ORSet.create<AgentMemory>()
 * const tag = memories.add({ content: 'User prefers concise responses', type: 'preference' })
 *
 * // Merge with remote state
 * const merged = memories.merge(remoteMemories)
 * ```
 *
 * ## Architecture
 *
 * ```
 * ┌─────────────────────────────────────┐
 * │  React Hooks (useMemory, etc.)      │
 * ├─────────────────────────────────────┤
 * │  Memory System (Working, Episodic)  │
 * ├─────────────────────────────────────┤
 * │  CRDT Core (LWW, OR-Set, Counter)   │
 * ├─────────────────────────────────────┤
 * │  Vector Search (pgvector)           │
 * ├─────────────────────────────────────┤
 * │  Persistence (Drizzle/NeonDB)       │
 * └─────────────────────────────────────┘
 * ```
 *
 * @packageDocumentation
 */

// Re-export client (client-side) modules
export * from './client/index'
// Re-export core (server-side) modules
export * from './core/index'
