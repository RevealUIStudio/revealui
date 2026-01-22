/**
 * ElectricSQL Client Wrapper
 *
 * Provides ElectricSQL integration for real-time sync and local-first storage.
 * Wraps the Electric client with proper typing and error handling.
 */

import { ElectricDatabase, electrify } from 'electric-sql/pglite'
import { schema } from '@revealui/db'
import type { Database } from '@revealui/db'

export interface ElectricClientConfig {
  /** Database URL for ElectricSQL */
  url?: string
  /** Enable debug logging */
  debug?: boolean
  /** Connection timeout in milliseconds */
  timeout?: number
}

export interface ElectricClient {
  /** Electric database instance */
  db: ElectricDatabase<typeof schema>
  /** Connect to ElectricSQL */
  connect(): Promise<void>
  /** Disconnect from ElectricSQL */
  disconnect(): Promise<void>
  /** Check connection status */
  isConnected(): boolean
  /** Sync shapes for real-time updates */
  syncShapes(shapes: any[]): Promise<void>
}

/**
 * ElectricClient implementation
 */
export class ElectricClientImpl implements ElectricClient {
  private config: ElectricClientConfig
  private electricDb: ElectricDatabase<typeof schema> | null = null
  private isConnectedState = false

  constructor(config: ElectricClientConfig = {}) {
    this.config = config
  }

  async connect(): Promise<void> {
    if (this.isConnectedState) {
      return // Already connected
    }

    try {
      if (this.config.debug) {
        console.log('Initializing ElectricSQL client...')
      }

      // Create Electric database instance
      // Note: This will be configured for your specific ElectricSQL setup
      const db = new ElectricDatabase({
        url: this.config.url || 'your-electric-url',
        schema,
      })

      // Electrify the database for real-time sync
      this.electricDb = await electrify(db)

      this.isConnectedState = true

      if (this.config.debug) {
        console.log('ElectricSQL client connected successfully')
      }
    } catch (error) {
      if (this.config.debug) {
        console.error('Failed to connect ElectricSQL client:', error)
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
      this.electricDb = null

      if (this.config.debug) {
        console.log('ElectricSQL client disconnected')
      }
    } catch (error) {
      if (this.config.debug) {
        console.error('Error disconnecting ElectricSQL client:', error)
      }
      throw error
    }
  }

  isConnected(): boolean {
    return this.isConnectedState
  }

  get db(): ElectricDatabase<typeof schema> {
    if (!this.electricDb) {
      throw new Error('ElectricSQL client not connected. Call connect() first.')
    }
    return this.electricDb
  }

  async syncShapes(shapes: any[]): Promise<void> {
    if (!this.isConnected()) {
      throw new Error('ElectricSQL client not connected')
    }

    // ElectricSQL handles shape sync automatically when shapes are defined
    // This method can be used for additional sync management if needed
    if (this.config.debug) {
      console.log('Syncing shapes:', shapes.map(s => s.table))
    }
  }
}

export function createElectricClient(config: ElectricClientConfig = {}): ElectricClient {
  return new ElectricClientImpl(config)
}