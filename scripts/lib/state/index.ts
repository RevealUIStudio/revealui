/**
 * State Management Module
 *
 * Provides workflow state management with persistent storage.
 *
 * @dependencies
 * - scripts/lib/state/adapters/memory.ts - In-memory state adapter
 * - scripts/lib/state/adapters/pglite.ts - PGlite state adapter
 * - scripts/lib/state/types.ts - State management type definitions
 * - scripts/lib/state/workflow-state.ts - Workflow state implementation
 */

export { MemoryStateAdapter } from './adapters/memory.js';
export { type PGliteAdapterOptions, PGliteStateAdapter } from './adapters/pglite.js';
export * from './types.js';
export * from './workflow-state.js';
