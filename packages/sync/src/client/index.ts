/**
 * Sync Client
 *
 * Client for managing real-time sync and local-first storage.
 * Uses localStorage for immediate functionality with foundation for database integration.
 */

import type { DatabaseClient as Database } from '@revealui/db'
import { getClient } from '@revealui/db/client'
import type { MemoryService } from '../memory/index.js'
import { MemoryServiceImpl } from '../memory/index.js'
import type { CollaborationService } from '../collaboration/index.js'
import { CollaborationServiceImpl } from '../collaboration/index.js'
import type { ConversationOperations } from '../operations/conversations.js'
import { createConversationOperations } from '../operations/conversations.js'

export interface SyncClientConfig {
  /** Database type to use */
  databaseType?: 'rest' | 'vector'
  /** Enable ElectricSQL for real-time sync */
  enableElectric?: boolean
  /** ElectricSQL configuration */
  electricConfig?: import('./electric.js').ElectricClientConfig
  /** Enable debug logging */
  debug?: boolean
}

export interface SyncClient {
  /** Database instance (REST/Drizzle) */
  db: Database
  /** ElectricSQL instance (for real-time sync) */
  electric?: import('./electric.js').ElectricClient
  /** Memory service for agent memory operations */
  memory: MemoryService
  /** Collaboration service for real-time sessions */
  collaboration: CollaborationService
  /** Conversation operations for CRUD and sync */
  conversations: ConversationOperations
  /** Connect to sync services */
  connect(): Promise<void>
  /** Disconnect from sync services */
  disconnect(): Promise<void>
  /** Check connection status */
  isConnected(): boolean
}

export function createSyncClient(config: SyncClientConfig = {}): SyncClient {
  return new SyncClientImpl(config)
}

class SyncClientImpl implements SyncClient {
  private config: SyncClientConfig
  private isConnectedState = false
  private database: Database | null = null
  private electricClient: import('./electric.js').ElectricClient | null = null
  private memoryService: MemoryService
  private collaborationService: CollaborationService
  private conversationOperations: ConversationOperations

  constructor(config: SyncClientConfig) {
    this.config = config

    // Initialize services with lazy client getters
    this.memoryService = new MemoryServiceImpl(() => this)
    this.collaborationService = new CollaborationServiceImpl(() => this)

    // Initialize conversation operations (lazy initialization)
    this.conversationOperations = null as ConversationOperations // Will be set in connect()

    // Initialize Electric client if enabled
    if (config.enableElectric !== false) { // Enable by default for sync
      const { createElectricClient } = require('./electric.js')
      this.electricClient = createElectricClient({
        url: process.env.ELECTRIC_SERVICE_URL || 'http://localhost:3001',
        debug: config.debug,
        ...config.electricConfig,
      })
    }
  }

  async connect(): Promise<void> {
    if (this.isConnectedState) {
      return // Already connected
    }

    try {
      if (this.config.debug) {
        console.log('Initializing sync client...')
      }

      // Initialize database connection
      const db = getClient(this.config.databaseType || 'rest')
      this.database = db

      // Initialize conversation operations
      this.conversationOperations = createConversationOperations(db)

      // Initialize ElectricSQL if enabled
      if (this.electricClient) {
        await this.electricClient.connect()
      }

      this.isConnectedState = true

      if (this.config.debug) {
        console.log('Sync client connected successfully')
      }
    } catch (error) {
      if (this.config.debug) {
        console.error('Failed to connect sync client:', error)
      }
      throw error
    }
  }

  async disconnect(): Promise<void> {
    if (!this.isConnectedState) {
      return
    }

    try {
      // Disconnect ElectricSQL first
      if (this.electricClient) {
        await this.electricClient.disconnect()
      }

      this.isConnectedState = false

      if (this.config.debug) {
        console.log('Sync client disconnected')
      }
    } catch (error) {
      if (this.config.debug) {
        console.error('Error disconnecting sync client:', error)
      }
      throw error
    }
  }

  isConnected(): boolean {
    return this.isConnectedState
  }

  get db(): Database {
    if (!this.database) {
      throw new Error('Sync client not connected. Call connect() first.')
    }
    return this.database
  }

  get electric(): import('./electric.js').ElectricClient | undefined {
    return this.electricClient || undefined
  }

  get memory(): MemoryService {
    return this.memoryService
  }

  get collaboration(): CollaborationService {
    return this.collaborationService
  }

  get conversations(): ConversationOperations {
    if (!this.conversationOperations) {
      throw new Error('Sync client not connected. Call connect() first.')
    }
    return this.conversationOperations
  }
}

export type { CollaborationService } from '../collaboration/index.js'
export type { MemoryService } from '../memory/index.js'