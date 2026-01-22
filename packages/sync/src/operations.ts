/**
 * ElectricSQL Operations
 *
 * Utility functions for ElectricSQL sync operations and shape management.
 */

import type { ElectricClient } from './client/index.js'
import type { ShapeParams } from '@electric-sql/react'
import { createAllAgentShapes, createMultiDeviceShapes, createRealtimeCollaborationShapes } from './shapes.js'
import { ConflictResolutionManager, detectAllConflicts } from './conflict-resolution.js'

/**
 * Sync all agent-related data using ElectricSQL shapes.
 * This sets up real-time sync for agent contexts, memories, conversations, and actions.
 */
export async function syncAgentData(client: ElectricClient, userId?: string): Promise<void> {
  try {
    // Create shapes for all agent data
    const shapes = createAllAgentShapes(userId ? { userId } : {})

    // ElectricSQL handles shape sync automatically through the electrify() process
    // The shapes define what data gets synced, but the actual sync is managed
    // by the ElectricSQL client when it connects

    if (client.isConnected()) {
      console.log('Agent data sync active for shapes:', shapes.map(s => s.table))
    } else {
      console.warn('ElectricSQL client not connected - agent data sync deferred')
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
export function createMemoryQuery(userId: string, options: {
  limit?: number
  type?: string
  minImportance?: number
} = {}) {
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
  client: ElectricClient,
  userId: string,
  options: {
    onConflict?: (conflicts: any[]) => Promise<void>
    tables?: string[]
  } = {}
): Promise<{ success: boolean; conflictsResolved: number; errors: string[] }> {
  const result = {
    success: true,
    conflictsResolved: 0,
    errors: [] as string[],
  }

  try {
    // Create shapes for sync
    const shapes = options.tables
      ? createMultiDeviceShapes(userId)
      : createAllAgentShapes({ userId })

    // Sync shapes
    await client.syncShapes(shapes)

    // Check for conflicts and resolve
    const conflictManager = new ConflictResolutionManager()

    // This would typically query for pending conflicts
    // For now, we'll simulate conflict detection
    const mockConflicts = []

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
  client: ElectricClient,
  userId: string,
  agentId: string
): Promise<void> {
  const shapes = createRealtimeCollaborationShapes(userId, agentId)
  await client.syncShapes(shapes)
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
 * Utility to get the ElectricSQL shape URL for a given shape.
 */
export function getShapeUrl(baseUrl: string, shape: ShapeParams): string {
  const params = new URLSearchParams()

  params.set('table', shape.table)
  if (shape.where) params.set('where', shape.where)
  if (shape.columns) params.set('columns', shape.columns.join(','))

  return `${baseUrl}/v1/shape?${params.toString()}`
}

/**
 * Batch sync multiple users (for enterprise scenarios)
 */
export async function batchSyncUsers(
  client: ElectricClient,
  userIds: string[],
  options: {
    concurrency?: number
    onProgress?: (completed: number, total: number) => void
  } = {}
): Promise<{ results: any[]; errors: string[] }> {
  const { concurrency = 5, onProgress } = options
  const results: any[] = []
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