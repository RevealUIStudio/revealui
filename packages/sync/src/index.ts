/**
 * @revealui/sync
 *
 * ElectricSQL client for real-time sync and local-first storage.
 * Enables hybrid approach with RevealUI API mutations and ElectricSQL reads.
 */

// Re-export types for convenience
export type { MemoryType } from '@revealui/contracts/agents'
export * from './client/index.js'
export * from './hooks/index.js'
export * from './operations.js'
export * from './provider/index.js'
export * from './shapes.js'
