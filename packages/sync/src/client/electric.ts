/**
 * ElectricSQL Client Wrapper
 *
 * Provides ElectricSQL integration for real-time sync and local-first storage.
 */

import { PGlite } from '@electric-sql/pglite'
import type { ShapeParams } from '../shapes.js'

export interface ElectricClientConfig {
  /** ElectricSQL service URL */
  url?: string
  /** Enable debug logging */
  debug?: boolean
  /** Connection timeout in milliseconds */
  timeout?: number
}

export interface ElectricClient {
  /** PGlite database instance */
  db: PGlite | null
  /** Connect to ElectricSQL */
  connect(): Promise<void>
  /** Disconnect from ElectricSQL */
  disconnect(): Promise<void>
  /** Check connection status */
  isConnected(): boolean
  /** Sync shapes for real-time updates */
  syncShapes(shapes: ShapeParams[]): Promise<void>
  /** Get database instance (throws if not connected) */
  getDb(): PGlite
}

/**
 * ElectricSQL client implementation using PGlite
 * Simplified version for initial integration
 */
export class ElectricClientImpl implements ElectricClient {
  private config: ElectricClientConfig
  private pgliteDb: PGlite | null = null
  private isConnectedState = false

  constructor(config: ElectricClientConfig = {}) {
    this.config = {
      url: 'http://localhost:3001',
      debug: false,
      timeout: 10000,
      ...config,
    }
  }

  async connect(): Promise<void> {
    if (this.isConnectedState) {
      return // Already connected
    }

    try {
      if (this.config.debug) {
        console.log('🔌 Connecting to PGlite...')
      }

      // Initialize PGlite database
      this.pgliteDb = new PGlite()

      // Initialize basic schema
      await this.pgliteDb.exec(`
        CREATE TABLE IF NOT EXISTS conversations (
          id TEXT PRIMARY KEY,
          user_id TEXT NOT NULL,
          agent_id TEXT NOT NULL,
          title TEXT,
          status TEXT DEFAULT 'active',
          device_id TEXT,
          last_synced_at TEXT,
          version INTEGER DEFAULT 1,
          created_at TEXT DEFAULT CURRENT_TIMESTAMP,
          updated_at TEXT DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS messages (
          id TEXT PRIMARY KEY,
          conversation_id TEXT NOT NULL REFERENCES conversations(id),
          role TEXT NOT NULL,
          content TEXT NOT NULL,
          timestamp TEXT DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS user_devices (
          id TEXT PRIMARY KEY,
          user_id TEXT NOT NULL,
          device_id TEXT NOT NULL UNIQUE,
          device_name TEXT,
          device_type TEXT,
          last_seen TEXT DEFAULT CURRENT_TIMESTAMP,
          is_active BOOLEAN DEFAULT true,
          created_at TEXT DEFAULT CURRENT_TIMESTAMP
        );
      `)

      this.isConnectedState = true

      if (this.config.debug) {
        console.log('✅ PGlite connected successfully')
      }
    } catch (error) {
      if (this.config.debug) {
        console.error('❌ Failed to connect PGlite:', error)
      }
      throw error
    }
  }

  async disconnect(): Promise<void> {
    if (!this.isConnectedState) {
      return
    }

    try {
      if (this.pgliteDb) {
        // Close PGlite connection
        await this.pgliteDb.close()
      }

      this.isConnectedState = false
      this.pgliteDb = null

      if (this.config.debug) {
        console.log('🔌 PGlite disconnected')
      }
    } catch (error) {
      if (this.config.debug) {
        console.error('❌ Error disconnecting PGlite:', error)
      }
      throw error
    }
  }

  isConnected(): boolean {
    return this.isConnectedState && this.pgliteDb !== null
  }

  get db(): PGlite | null {
    return this.pgliteDb
  }

  getDb(): PGlite {
    if (!this.pgliteDb) {
      throw new Error('PGlite client not connected. Call connect() first.')
    }
    return this.pgliteDb
  }

  async syncShapes(shapes: ShapeParams[]): Promise<void> {
    if (!this.isConnected()) {
      throw new Error('PGlite client not connected')
    }

    if (this.config.debug) {
      console.log(
        '🔄 Syncing shapes (placeholder):',
        shapes.map((s) => s.table),
      )
    }

    // TODO: Implement actual ElectricSQL shape syncing
    // For now, this is a placeholder
  }
}

export function createElectricClient(config: ElectricClientConfig = {}): ElectricClient {
  return new ElectricClientImpl(config)
}
