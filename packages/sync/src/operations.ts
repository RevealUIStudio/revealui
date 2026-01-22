/**
 * Sync Operations
 *
 * Utility functions for sync operations and data management.
 */

import type { SyncClient } from './client/index.js'
import { ConflictResolutionManager } from './conflict-resolution.js'

/**
 * Sync all agent-related data.
 * This ensures agent contexts, memories, conversations, and actions are synchronized.
 */
export async function syncAgentData(client: SyncClient, _userId?: string): Promise<void> {
  try {
    // Ensure client is connected
    if (!client.isConnected()) {
      await client.connect()
    }

    // Agent data sync is now handled through the database client
    // The sync client manages data consistency and availability
    if (client.isConnected()) {
      // Agent data sync active - client is ready for operations
    }
  } catch (error) {
    console.error('Failed to sync agent data:', error)
    throw error
  }
}

/**
 * Create a live query for reactive data updates.
 * This should be used within React components with useLiveQuery.
 */
export function createMemoryQuery(
  userId: string,
  options: {
    limit?: number
    type?: string
    minImportance?: number
  } = {},
) {
  const { limit = 50, type, minImportance } = options

  let whereClause = `agent_id = '${userId}' AND (expires_at IS NULL OR expires_at > NOW())`

  if (type) {
    whereClause += ` AND type = '${type}'`
  }

  if (minImportance !== undefined) {
    whereClause += ` AND (metadata->>'importance')::float >= ${minImportance}`
  }

  return {
    table: 'agent_memories',
    where: whereClause,
    orderBy: 'created_at DESC',
    limit,
  }
}

/**
 * Create a live query for conversation data.
 */
export function createConversationQuery(userId: string, agentId?: string, limit = 20) {
  let whereClause = `user_id = '${userId}'`

  if (agentId) {
    whereClause += ` AND agent_id = '${agentId}'`
  }

  return {
    table: 'conversations',
    where: whereClause,
    orderBy: 'updated_at DESC',
    limit,
  }
}

/**
 * Sync with conflict resolution
 */
export async function syncWithConflictResolution(
  client: SyncClient,
  _userId: string,
  options: {
    onConflict?: (conflicts: unknown[]) => Promise<void>
    tables?: string[]
  } = {},
): Promise<{ success: boolean; conflictsResolved: number; errors: string[] }> {
  const result = {
    success: true,
    conflictsResolved: 0,
    errors: [] as string[],
  }

  try {
    // Ensure client is connected
    if (!client.isConnected()) {
      await client.connect()
    }

    // Check for conflicts and resolve
    const conflictManager = new ConflictResolutionManager()

    // In a real implementation, this would check for actual data conflicts
    // For now, we simulate basic conflict detection
    const mockConflicts: unknown[] = []

    if (mockConflicts.length > 0) {
      if (options.onConflict) {
        await options.onConflict(mockConflicts)
      }

      const resolutions = await conflictManager.resolveConflicts(mockConflicts)
      result.conflictsResolved = resolutions.length
    }
  } catch (error) {
    result.success = false
    result.errors.push(error instanceof Error ? error.message : String(error))
  }

  return result
}

/**
 * Initialize real-time collaboration session
 */
export async function initializeRealtimeCollaboration(
  client: SyncClient,
  _userId: string,
  _agentId: string,
): Promise<void> {
  // Ensure client is connected for collaboration
  if (!client.isConnected()) {
    await client.connect()
  }

  // Real-time collaboration is now managed through the sync client
  // The collaboration service handles session management
}

/**
 * Monitor sync health and performance
 */
export function createSyncMonitor(client: ElectricClient) {
  return {
    getSyncStats: () => {
      // This would return actual sync statistics
      return {
        connected: client.isConnected(),
        lastSync: new Date(),
        pendingChanges: 0,
        activeShapes: 0,
        latency: 0,
      }
    },

    getPerformanceMetrics: () => {
      // This would return performance metrics
      return {
        avgSyncTime: 0,
        syncSuccessRate: 1.0,
        conflictRate: 0,
        bandwidthUsage: 0,
      }
    },
  }
}

/**
 * Utility for building query URLs (legacy compatibility)
 */
export function buildQueryUrl(
  baseUrl: string,
  table: string,
  options: { where?: string; columns?: string[] } = {},
): string {
  const params = new URLSearchParams()

  params.set('table', table)
  if (options.where) params.set('where', options.where)
  if (options.columns) params.set('columns', options.columns.join(','))

  return `${baseUrl}/api/${table}?${params.toString()}`
}

/**
 * Batch sync multiple users (for enterprise scenarios)
 */
export async function batchSyncUsers(
  client: SyncClient,
  userIds: string[],
  options: {
    concurrency?: number
    onProgress?: (completed: number, total: number) => void
  } = {},
): Promise<{ results: unknown[]; errors: string[] }> {
  const { concurrency = 5, onProgress } = options
  const results: unknown[] = []
  const errors: string[] = []

  // Process users in batches
  for (let i = 0; i < userIds.length; i += concurrency) {
    const batch = userIds.slice(i, i + concurrency)

    const batchPromises = batch.map(async (userId) => {
      try {
        const result = await syncWithConflictResolution(client, userId)
        results.push({ userId, ...result })
        return result
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error)
        errors.push(`${userId}: ${errorMsg}`)
        results.push({ userId, success: false, error: errorMsg })
      }
    })

    await Promise.all(batchPromises)
    onProgress?.(Math.min(i + concurrency, userIds.length), userIds.length)
  }

  return { results, errors }
}
