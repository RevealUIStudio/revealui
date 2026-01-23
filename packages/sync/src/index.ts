/**
 * @revealui/sync
 *
 * ElectricSQL client for real-time sync and local-first storage.
 * Provides offline-first capabilities with proper ElectricSQL patterns.
 */

// Re-export types for convenience
export type { ConversationMessage, MemoryItem, MemoryType } from '@revealui/contracts/agents'

// Main exports
export * from './client/index.js'
export type { CollaborationService } from './collaboration/index.js'
export type {
  AuditEvent,
  BackupResult,
  EnterpriseFeatures,
  GDPRData,
  PerformanceMetrics,
} from './enterprise/index.js'
// Re-export enterprise features
export { createEnterpriseFeatures } from './enterprise/index.js'
export * from './hooks/index.js'

// Re-export services for direct access
export type { MemoryService } from './memory/index.js'
export type { DatabaseRecords, MigrationData, MigrationResult } from './migration/index.js'

// Re-export migration functionality
export { createMigrationExecutor, migrateLocalStorageToDatabase } from './migration/index.js'
export * from './operations.js'
export * from './provider/index.js'
export * from './shapes.js'
