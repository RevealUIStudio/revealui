/**
 * useAgentMemory Hook (New System - HTTP-based)
 *
 * React hook for accessing agent memories in real-time.
 * Provides cross-tab/session sync via ElectricSQL shapes.
 *
 * Uses ElectricSQL useShape hook to automatically sync memories across tabs and sessions.
 */

import { useShape } from '@electric-sql/react'
import { buildShapeUrl } from '../client'
import { useElectric } from '../provider'
import type { AgentMemory } from '../schema'
import { createAgentMemory, deleteAgentMemory, updateAgentMemory } from '../utils/revealui-api'

// =============================================================================
// Hook Types
// =============================================================================

export interface UseAgentMemoryOptions {
  /** Site ID to filter by */
  siteId?: string
  /** Memory type to filter by */
  type?: string
  /** Only show verified memories */
  verified?: boolean
  /** Limit number of results */
  limit?: number
  /** Enable real-time updates */
  enabled?: boolean
}

export interface UseAgentMemoryResult {
  /** List of memories */
  memories: AgentMemory[]
  /** Loading state */
  isLoading: boolean
  /** Error state */
  error: Error | null
  /** Add new memory */
  addMemory: (memory: Omit<AgentMemory, 'id' | 'created_at'>) => Promise<void>
  /** Update memory */
  updateMemory: (id: string, updates: Partial<AgentMemory>) => Promise<void>
  /** Delete memory */
  deleteMemory: (id: string) => Promise<void>
  /** Refresh memories */
  refresh: () => Promise<void>
}

// =============================================================================
// Hook Implementation
// =============================================================================

/**
 * Hook for accessing agent memories in real-time.
 *
 * @param agentId - Agent ID to get memories for
 * @param options - Additional options
 * @returns Memory data and update functions
 *
 * @example
 * ```typescript
 * const { memories, addMemory } = useAgentMemory('agent-123')
 *
 * // Add memory
 * await addMemory({
 *   agent_id: 'agent-123',
 *   content: 'User prefers dark mode',
 *   type: 'preference'
 * })
 * ```
 */
export function useAgentMemory(
  agentId: string,
  options?: UseAgentMemoryOptions,
): UseAgentMemoryResult {
  const config = useElectric()
  const { siteId, type, verified, limit, enabled = true } = options || {}

  // ✅ VERIFIED: Based on TypeScript definitions
  // URL should be base endpoint only, filtering in params object
  const shapeUrl = buildShapeUrl(config.serviceUrl)

  // Build WHERE clause and params for filtering
  // ✅ VERIFIED: Use SQL WHERE clause format, not query params
  const whereConditions: string[] = ['agent_id = $1']
  const whereParams: Record<string, string> = { '1': agentId }
  let paramIndex = 2

  if (siteId) {
    whereConditions.push(`site_id = $${paramIndex}`)
    whereParams[String(paramIndex)] = siteId
    paramIndex++
  }
  if (type) {
    whereConditions.push(`type = $${paramIndex}`)
    whereParams[String(paramIndex)] = type
    paramIndex++
  }
  if (verified !== undefined) {
    whereConditions.push(`verified = $${paramIndex}`)
    whereParams[String(paramIndex)] = String(verified)
    paramIndex++
  }

  const whereClause = whereConditions.join(' AND ')
  const shapeParams: {
    table: string
    where: string
    params: Record<string, string>
    orderBy: string
    limit?: number
  } = {
    table: 'agent_memories',
    where: whereClause,
    params: whereParams,
    orderBy: 'created_at DESC',
  }

  // Add LIMIT if specified
  if (limit) {
    shapeParams.limit = limit
  }

  // Use the new useShape hook with correct API structure
  // Type assertion needed due to TypeScript strictness with intersection types
  const {
    isLoading,
    data,
    error: shapeError,
    isError,
  } = useShape({
    url: enabled ? shapeUrl : '',
    params: enabled ? (shapeParams as never) : undefined,
    headers: config.authToken
      ? {
          Authorization: () => `Bearer ${config.authToken}`,
        }
      : undefined,
  })

  // ✅ VERIFIED: useShape returns { data: T[] } where T extends Row
  // Type assertion still needed due to generic type constraints, but format is verified
  const memories: AgentMemory[] = Array.isArray(data) ? (data as unknown as AgentMemory[]) : []

  // ✅ VERIFIED: useShape returns error and isError fields
  // Transform error to Error type for consistent API
  const error =
    isError && shapeError
      ? shapeError instanceof Error
        ? shapeError
        : new Error(typeof shapeError === 'string' ? shapeError : JSON.stringify(shapeError))
      : null

  const addMemory = async (memory: Omit<AgentMemory, 'id' | 'created_at'>) => {
    if (!enabled) {
      throw new Error('ElectricSQL is not enabled')
    }

    // ✅ Uses RevealUI CMS API instead of unverified ElectricSQL REST endpoint
    const id = `memory_${Date.now()}_${Math.random().toString(36).substring(7)}`
    const now = new Date()

    try {
      // ⚠️ IMPORTANT: AgentId/UserId Mapping
      // The EpisodicMemory API uses `userId` in the route path to identify the memory collection.
      // In this system, we assume that `agentId === userId` (agents are users).
      // The `agentId` is also stored in `memory.metadata.custom.agentId` for filtering in ElectricSQL.
      //
      // If your system has a different relationship between agents and users, you must:
      // 1. Create a mapping function: `userId = mapAgentIdToUserId(agentId)`
      // 2. Or create agent-specific endpoints: `/api/memory/episodic/agent/:agentId`
      // 3. Update this code to use the proper mapping
      const userId = agentId

      // Ensure agentId is stored in metadata for ElectricSQL filtering
      const memoryWithAgentId = {
        ...memory,
        metadata: {
          ...(memory.metadata || {}),
          custom: {
            ...(memory.metadata?.custom || {}),
            agentId,
          },
        },
        id,
        created_at: now.toISOString(),
      }

      await createAgentMemory(userId, memoryWithAgentId, config.authToken)

      // Shape will automatically update via subscription when ElectricSQL syncs new data
    } catch (createError) {
      const errorMessage = createError instanceof Error ? createError.message : String(createError)
      throw new Error(`Failed to add memory: ${errorMessage}`)
    }
  }

  const updateMemory = async (id: string, updates: Partial<AgentMemory>) => {
    if (!enabled) {
      throw new Error('ElectricSQL is not enabled')
    }

    // ✅ Uses RevealUI CMS API instead of unverified ElectricSQL REST endpoint
    try {
      // ⚠️ IMPORTANT: AgentId/UserId Mapping (see addMemory for details)
      // Assumes agentId === userId. If different, create mapping function.
      const userId = agentId

      // Ensure agentId is preserved in metadata if metadata is being updated
      const updatesWithAgentId = updates.metadata
        ? {
            ...updates,
            metadata: {
              ...updates.metadata,
              custom: {
                ...(updates.metadata.custom || {}),
                agentId,
              },
            },
          }
        : updates

      await updateAgentMemory(userId, id, updatesWithAgentId, config.authToken)

      // Shape will automatically update via subscription when ElectricSQL syncs new data
    } catch (updateError) {
      const errorMessage = updateError instanceof Error ? updateError.message : String(updateError)
      throw new Error(`Failed to update memory: ${errorMessage}`)
    }
  }

  const deleteMemory = async (id: string) => {
    if (!enabled) {
      throw new Error('ElectricSQL is not enabled')
    }

    // ✅ Uses RevealUI CMS API instead of unverified ElectricSQL REST endpoint
    try {
      // ⚠️ IMPORTANT: AgentId/UserId Mapping (see addMemory for details)
      // Assumes agentId === userId. If different, create mapping function.
      const userId = agentId

      await deleteAgentMemory(userId, id, config.authToken)

      // Shape will automatically update via subscription when ElectricSQL syncs new data
    } catch (deleteError) {
      const errorMessage = deleteError instanceof Error ? deleteError.message : String(deleteError)
      throw new Error(`Failed to delete memory: ${errorMessage}`)
    }
  }

  const refresh = async () => {
    // ElectricSQL shapes automatically refresh via subscription
    // This is a no-op as shapes are reactive
    await Promise.resolve()
  }

  return {
    memories,
    isLoading,
    error,
    addMemory,
    updateMemory,
    deleteMemory,
    refresh,
  }
}
