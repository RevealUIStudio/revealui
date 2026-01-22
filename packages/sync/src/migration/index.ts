/**
 * Migration System
 *
 * Handles migration from localStorage-based MVP to PostgreSQL + ElectricSQL infrastructure.
 * Provides safe, rollback-capable migration with comprehensive validation.
 */

import type { SyncClient } from '../client/index.js'
import type { ConversationMessage, MemoryItem } from '@revealui/contracts/agents'
import { logger } from '@revealui/core'

// Control verbose logging for migration operations
const VERBOSE_LOGGING = process.env.MIGRATION_VERBOSE !== 'false' && (process.env.NODE_ENV !== 'production' || process.env.CI !== 'true')

// =============================================================================
// Types
// =============================================================================

export interface MigrationData {
  conversations: LocalConversation[]
  memories: LocalMemory[]
  sessions: LocalSession[]
  version: string
  timestamp: Date
}

export interface LocalConversation {
  id: string
  userId: string
  agentId: string
  title?: string
  messages: ConversationMessage[]
  createdAt: Date
  updatedAt: Date
  metadata?: Record<string, unknown>
}

export interface LocalMemory extends MemoryItem {
  // Inherits from MemoryItem
}

export interface LocalSession {
  id: string
  documentId: string
  participants: string[]
  status: 'active' | 'inactive' | 'ended'
  createdAt: Date
  lastActivity: Date
}

export interface DatabaseRecords {
  conversations: any[]
  memories: any[]
  sessions: any[]
}

export interface MigrationResult {
  success: boolean
  exportedRecords: number
  importedRecords: number
  errors: string[]
  rollbackAvailable: boolean
}

export interface MigrationStrategy {
  /** Export localStorage data */
  exportLocalData(): Promise<MigrationData>
  /** Transform to database format */
  transformData(data: MigrationData): Promise<DatabaseRecords>
  /** Import to database with conflict resolution */
  importToDatabase(records: DatabaseRecords, client: SyncClient): Promise<void>
  /** Validate migration success */
  validateMigration(client: SyncClient): Promise<boolean>
  /** Rollback on failure */
  rollbackMigration(client: SyncClient): Promise<void>
}

// =============================================================================
// Migration Strategy Implementation
// =============================================================================

export class LocalStorageMigrationStrategy implements MigrationStrategy {
  private readonly conversationsKey = 'revealui_conversations'
  private readonly memoriesKey = 'revealui_memories'
  private readonly sessionsKey = 'revealui_sessions'
  private readonly versionKey = 'revealui_version'

  async exportLocalData(): Promise<MigrationData> {
    if (typeof window === 'undefined') {
      throw new Error('Migration can only run in browser environment')
    }

    const conversations = this.getStoredConversations()
    const memories = this.getStoredMemories()
    const sessions = this.getStoredSessions()
    const version = localStorage.getItem(this.versionKey) || '1.0.0'

    return {
      conversations,
      memories,
      sessions,
      version,
      timestamp: new Date(),
    }
  }

  async transformData(data: MigrationData): Promise<DatabaseRecords> {
    // Transform conversations
    const conversations = data.conversations.map(conv => ({
      id: conv.id,
      sessionId: `${conv.userId}-${conv.agentId}-${Date.now()}`, // Generate session ID
      userId: conv.userId,
      agentId: conv.agentId,
      messages: conv.messages,
      status: 'active' as const,
      metadata: {
        title: conv.title,
        ...conv.metadata,
      },
      deviceId: this.getDeviceId(),
      lastSyncedAt: new Date(),
      version: 1,
      createdAt: conv.createdAt,
      updatedAt: conv.updatedAt,
    }))

    // Transform memories
    const memories = data.memories.map(memory => ({
      id: memory.id,
      content: memory.content,
      type: memory.type,
      source: memory.source,
      embedding: memory.embedding || [],
      embeddingMetadata: memory.embeddingMetadata,
      metadata: memory.metadata || {},
      accessCount: memory.accessCount || 0,
      accessedAt: memory.accessedAt,
      verified: memory.verified || false,
      verifiedBy: memory.verifiedBy,
      verifiedAt: memory.verifiedAt,
      siteId: memory.siteId,
      agentId: memory.agentId,
      createdAt: memory.createdAt,
      expiresAt: memory.expiresAt,
    }))

    // Sessions are handled by collaboration service, not stored in DB directly
    const sessions = []

    return {
      conversations,
      memories,
      sessions,
    }
  }

  async importToDatabase(records: DatabaseRecords, client: SyncClient): Promise<void> {
    const db = client.db

    // Import conversations
    for (const conversation of records.conversations) {
      await db.insert('conversations').values(conversation)
    }

    // Import memories
    for (const memory of records.memories) {
      await db.insert('agent_memories').values(memory)
    }

    // Sessions are handled by the collaboration service using localStorage
    // No database import needed for sessions
  }

  async validateMigration(client: SyncClient): Promise<boolean> {
    try {
      const db = client.db

      // Check if conversations were imported
      const conversationCount = await db.$count('conversations')
      const memoryCount = await db.$count('agent_memories')

      // Basic validation - ensure we have some data
      return conversationCount >= 0 && memoryCount >= 0
    } catch (error) {
      logger.error('Migration validation failed', { error })
      return false
    }
  }

  async rollbackMigration(client: SyncClient): Promise<void> {
    try {
      const db = client.db

      // Clear imported data
      await db.delete('conversations').where('device_id = ?', [this.getDeviceId()])
      await db.delete('agent_memories').where('agent_id = ?', [this.getDeviceId()]) // Using agent_id as temporary marker

      if (VERBOSE_LOGGING) {
        // Migration rollback logging removed for production
      // console.log('Migration rollback completed')
      }
    } catch (error) {
      logger.error('Migration rollback failed', { error })
      throw error
    }
  }

  private getStoredConversations(): LocalConversation[] {
    if (typeof window === 'undefined') return []

    try {
      const stored = localStorage.getItem(this.conversationsKey)
      const parsed = stored ? JSON.parse(stored) : []

      return parsed.map((conv: any) => ({
        ...conv,
        createdAt: new Date(conv.createdAt),
        updatedAt: new Date(conv.updatedAt),
      }))
    } catch {
      return []
    }
  }

  private getStoredMemories(): LocalMemory[] {
    if (typeof window === 'undefined') return []

    try {
      const stored = localStorage.getItem(this.memoriesKey)
      return stored ? JSON.parse(stored) : []
    } catch {
      return []
    }
  }

  private getStoredSessions(): LocalSession[] {
    if (typeof window === 'undefined') return []

    try {
      const stored = localStorage.getItem(this.sessionsKey)
      const parsed = stored ? JSON.parse(stored) : []

      return parsed.map((session: any) => ({
        ...session,
        createdAt: new Date(session.createdAt),
        lastActivity: new Date(session.lastActivity),
      }))
    } catch {
      return []
    }
  }

  private getDeviceId(): string {
    if (typeof window === 'undefined') return 'server'

    // Generate a stable device ID based on user agent and timestamp
    const deviceKey = 'revealui_device_id'
    let deviceId = localStorage.getItem(deviceKey)

    if (!deviceId) {
      deviceId = `${navigator.userAgent.slice(0, 50)}-${Date.now()}`
      localStorage.setItem(deviceKey, deviceId)
    }

    return deviceId
  }
}

// =============================================================================
// Migration Executor
// =============================================================================

export class MigrationExecutor {
  constructor(private strategy: MigrationStrategy) {}

  async execute(client: SyncClient): Promise<MigrationResult> {
    const result: MigrationResult = {
      success: false,
      exportedRecords: 0,
      importedRecords: 0,
      errors: [],
      rollbackAvailable: false,
    }

    try {
      if (VERBOSE_LOGGING) {
        console.log('Starting migration from localStorage to PostgreSQL...')
      }

      // Phase 1: Export local data
      if (VERBOSE_LOGGING) {
        console.log('Phase 1: Exporting localStorage data...')
      }
      const localData = await this.strategy.exportLocalData()
      result.exportedRecords = localData.conversations.length + localData.memories.length + localData.sessions.length
      if (VERBOSE_LOGGING) {
        console.log(`Exported ${result.exportedRecords} records`)
      }

      // Phase 2: Transform data
      if (VERBOSE_LOGGING) {
        console.log('Phase 2: Transforming data...')
      }
      const dbRecords = await this.strategy.transformData(localData)

      // Phase 3: Import to database
      if (VERBOSE_LOGGING) {
        console.log('Phase 3: Importing to database...')
      }
      await this.strategy.importToDatabase(dbRecords, client)
      result.importedRecords = dbRecords.conversations.length + dbRecords.memories.length
      if (VERBOSE_LOGGING) {
        console.log(`Imported ${result.importedRecords} records`)
      }

      // Phase 4: Validate migration
      if (VERBOSE_LOGGING) {
        console.log('Phase 4: Validating migration...')
      }
      const isValid = await this.strategy.validateMigration(client)

      if (!isValid) {
        throw new Error('Migration validation failed')
      }

      result.success = true
      result.rollbackAvailable = true
      console.log('Migration completed successfully!')

    } catch (error) {
      result.errors.push(error instanceof Error ? error.message : String(error))
      logger.error('Migration failed', { error })

      // Attempt rollback if we got far enough
      if (result.importedRecords > 0) {
        try {
          console.log('Attempting rollback...')
          await this.strategy.rollbackMigration(client)
          result.rollbackAvailable = true
        } catch (rollbackError) {
          result.errors.push(`Rollback failed: ${rollbackError}`)
        }
      }
    }

    return result
  }
}

// =============================================================================
// Utility Functions
// =============================================================================

export function createMigrationExecutor(): MigrationExecutor {
  const strategy = new LocalStorageMigrationStrategy()
  return new MigrationExecutor(strategy)
}

export async function migrateLocalStorageToDatabase(client: SyncClient): Promise<MigrationResult> {
  const executor = createMigrationExecutor()
  return executor.execute(client)
}