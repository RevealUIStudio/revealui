/**
 * ElectricSQL Client
 *
 * Client for connecting to ElectricSQL service and managing
 * real-time data synchronization.
 */

import type { CollaborationService } from '../collaboration/index.js'
import { CollaborationServiceImpl } from '../collaboration/index.js'
import type { MemoryService } from '../memory/index.js'
import { MemoryServiceImpl } from '../memory/index.js'

export interface ElectricClientConfig {
  serviceUrl: string
  databaseUrl?: string
  token?: string
  debug?: boolean
}

export interface ElectricClient {
  connect(): Promise<void>
  disconnect(): Promise<void>
  isConnected(): boolean
  subscribe(callbacks: SubscriptionCallbacks): () => void
  memory: MemoryService
  collaboration: CollaborationService
}

export interface SubscriptionCallbacks {
  onMemoryUpdate?: (memory: any) => void
  onCollaborationUpdate?: (operation: any) => void
  onSessionUpdate?: (session: any) => void
  onError?: (error: Error) => void
}

export function createElectricClient(config: ElectricClientConfig): ElectricClient {
  return new ElectricSQLClient(config)
}

class ElectricSQLClient implements ElectricClient {
  private config: ElectricClientConfig
  private isConnectedState = false
  private memoryService: MemoryService
  private collaborationService: CollaborationService

  constructor(config: ElectricClientConfig) {
    this.config = config

    // Initialize services with config
    this.memoryService = new MemoryServiceImpl(config)
    this.collaborationService = new CollaborationServiceImpl(config)
  }

  async connect(): Promise<void> {
    try {
      // ElectricSQL connection would be established here
      // For now, just set connected state
      this.isConnectedState = true

      if (this.config.debug) {
        console.log('ElectricSQL client connected')
      }
    } catch (error) {
      console.error('ElectricSQL connection failed:', error)
      throw error
    }
  }

  async disconnect(): Promise<void> {
    // ElectricSQL disconnect would happen here
    // For now, just update connection state
    this.isConnectedState = false
  }

  isConnected(): boolean {
    return this.isConnectedState
  }

  subscribe(callbacks: SubscriptionCallbacks): () => void {
    // Set up real-time subscriptions with ElectricSQL
    // This is a simplified implementation

    // Return unsubscribe function
    return () => {
      // Clean up ElectricSQL subscriptions
    }
  }

  get memory(): MemoryService {
    return this.memoryService
  }

  get collaboration(): CollaborationService {
    return this.collaborationService
  }
}

export type { CollaborationService } from '../collaboration/index.js'
// Re-export interfaces
export type { MemoryService } from '../memory/index.js'
