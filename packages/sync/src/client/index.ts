/**
 * Sync Client
 *
 * Client for managing real-time sync and local-first storage.
 * Uses localStorage for immediate functionality with foundation for database integration.
 */

import type { Database } from '@revealui/db'
import { getClient } from '@revealui/db/client'
import { logger } from '@revealui/core'
import type { MemoryService } from '../memory/index.js'
import { MemoryServiceImpl } from '../memory/index.js'
import type { CollaborationService } from '../collaboration/index.js'
import { CollaborationServiceImpl } from '../collaboration/index.js'

export interface SyncClientConfig {
  /** Database type to use */
  databaseType?: 'rest' | 'vector'
  /** Enable debug logging */
  debug?: boolean
}

export interface SyncClient {
  /** Database instance */
  db: Database
  /** Memory service for agent memory operations */
  memory: MemoryService
  /** Collaboration service for real-time sessions */
  collaboration: CollaborationService
  /** Connect to database */
  connect(): Promise<void>
  /** Disconnect from database */
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
  private memoryService: MemoryService
  private collaborationService: CollaborationService

  constructor(config: SyncClientConfig) {
    this.config = config

    // Initialize services with lazy client getters
    this.memoryService = new MemoryServiceImpl(() => this)
    this.collaborationService = new CollaborationServiceImpl(() => this)
  }

  async connect(): Promise<void> {
    if (this.isConnectedState) {
      return // Already connected
    }

    try {
      if (this.config.debug) {
        // Initializing sync client...
      }

      // Initialize database connection
      this.database = getClient(this.config.databaseType || 'rest')

      this.isConnectedState = true

      if (this.config.debug) {
        // Sync client connected successfully
      }
    } catch (error) {
      if (this.config.debug) {
        logger.error('Failed to connect sync client', { error })
      }
      throw error
    }
  }

  async disconnect(): Promise<void> {
    if (!this.isConnectedState) {
      return
    }

    try {
      this.isConnectedState = false

      if (this.config.debug) {
        // Sync client disconnected
      }
    } catch (error) {
      if (this.config.debug) {
        logger.error('Error disconnecting sync client', { error })
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


  get memory(): MemoryService {
    return this.memoryService
  }

  get collaboration(): CollaborationService {
    return this.collaborationService
  }
}

export type { CollaborationService } from '../collaboration/index.js'
export type { MemoryService } from '../memory/index.js'