/**
 * @revealui/sync
 *
 * ElectricSQL client for real-time sync and local-first storage.
 * Provides offline-first capabilities with proper ElectricSQL patterns.
 */

// Re-export types for convenience
export type { MemoryType, MemoryItem, ConversationMessage } from '@revealui/contracts/agents'

// Main exports
export * from './client/index.js'
export * from './hooks/index.js'
export * from './operations.js'
export * from './provider/index.js'
export * from './shapes.js'

// Re-export services for direct access
export type { MemoryService } from './memory/index.js'
export type { CollaborationService } from './collaboration/index.js'

// Re-export migration functionality
export { migrateLocalStorageToDatabase, createMigrationExecutor } from './migration/index.js'
export type { MigrationResult, MigrationData, DatabaseRecords } from './migration/index.js'

// Re-export enterprise features
export { createEnterpriseFeatures } from './enterprise/index.js'
export type { EnterpriseFeatures, AuditEvent, GDPRData, BackupResult, PerformanceMetrics } from './enterprise/index.js'
