/**
 * useConversations Hook (New System - HTTP-based)
 *
 * React hook for accessing conversations in real-time.
 * Provides cross-tab/session sync via ElectricSQL shapes.
 *
 * Uses ElectricSQL useShape hook to automatically sync conversations across tabs and sessions.
 */

import { useShape } from '@electric-sql/react'
import { buildShapeUrl } from '../client'
import { useElectric } from '../provider'
import type { Conversation } from '../schema'
import {
  createConversation as apiCreateConversation,
  deleteConversation as apiDeleteConversation,
  updateConversation as apiUpdateConversation,
} from '../utils/revealui-api'

// =============================================================================
// Hook Types
// =============================================================================

export interface UseConversationsOptions {
  /** Agent ID to filter by */
  agentId?: string
  /** Conversation status to filter by */
  status?: string
  /** Limit number of results */
  limit?: number
  /** Enable real-time updates */
  enabled?: boolean
}

export interface UseConversationsResult {
  /** List of conversations */
  conversations: Conversation[]
  /** Loading state */
  isLoading: boolean
  /** Error state */
  error: Error | null
  /** Create new conversation */
  createConversation: (
    conversation: Omit<Conversation, 'id' | 'created_at' | 'updated_at'>,
  ) => Promise<Conversation>
  /** Update conversation */
  updateConversation: (id: string, updates: Partial<Conversation>) => Promise<void>
  /** Delete conversation */
  deleteConversation: (id: string) => Promise<void>
  /** Refresh conversations */
  refresh: () => Promise<void>
}

// =============================================================================
// Hook Implementation
// =============================================================================

/**
 * Hook for accessing conversations in real-time.
 *
 * @param userId - User ID to get conversations for
 * @param options - Additional options
 * @returns Conversation data and update functions
 *
 * @example
 * ```typescript
 * const { conversations, createConversation } = useConversations('user-123')
 *
 * // Create conversation
 * await createConversation({
 *   user_id: 'user-123',
 *   agent_id: 'agent-456',
 *   title: 'New Chat'
 * })
 * ```
 */
export function useConversations(
  userId: string,
  options?: UseConversationsOptions,
): UseConversationsResult {
  const config = useElectric()
  const { agentId, status, limit, enabled = true } = options || {}

  // ✅ VERIFIED: Based on TypeScript definitions
  // URL should be base endpoint only, filtering in params object
  const shapeUrl = buildShapeUrl(config.serviceUrl)

  // Build WHERE clause and params for filtering
  // ✅ VERIFIED: Use SQL WHERE clause format, not query params
  const whereConditions: string[] = ['user_id = $1']
  const whereParams: Record<string, string> = { '1': userId }
  let paramIndex = 2

  if (agentId) {
    whereConditions.push(`agent_id = $${paramIndex}`)
    whereParams[String(paramIndex)] = agentId
    paramIndex++
  }
  if (status) {
    whereConditions.push(`status = $${paramIndex}`)
    whereParams[String(paramIndex)] = status
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
    table: 'conversations',
    where: whereClause,
    params: whereParams,
    orderBy: 'updated_at DESC',
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
  const conversations: Conversation[] = Array.isArray(data)
    ? (data as unknown as Conversation[])
    : []

  // ✅ VERIFIED: useShape returns error and isError fields
  // Transform error to Error type for consistent API
  const error =
    isError && shapeError
      ? shapeError instanceof Error
        ? shapeError
        : new Error(typeof shapeError === 'string' ? shapeError : JSON.stringify(shapeError))
      : null

  const createConversation = async (
    conversation: Omit<Conversation, 'id' | 'created_at' | 'updated_at'>,
  ): Promise<Conversation> => {
    if (!enabled) {
      throw new Error('ElectricSQL is not enabled')
    }

    // ✅ Uses RevealUI CMS API instead of unverified ElectricSQL REST endpoint
    // ✅ Conversations collection created - auto-generates REST API endpoints
    const id = `conv_${Date.now()}_${Math.random().toString(36).substring(7)}`
    const now = new Date()

    try {
      const created = await apiCreateConversation(
        {
          ...conversation,
          id,
          created_at: now.toISOString(),
          updated_at: now.toISOString(),
        },
        config.authToken,
      )

      // Shape will automatically update via subscription when ElectricSQL syncs new data
      return created as Conversation
    } catch (createError) {
      const errorMessage = createError instanceof Error ? createError.message : String(createError)
      throw new Error(`Failed to create conversation: ${errorMessage}`)
    }
  }

  const updateConversation = async (id: string, updates: Partial<Conversation>) => {
    if (!enabled) {
      throw new Error('ElectricSQL is not enabled')
    }

    // ✅ Uses RevealUI CMS API instead of unverified ElectricSQL REST endpoint
    try {
      // RevealUI CMS uses PATCH, not PUT, and handles updated_at automatically
      await apiUpdateConversation(id, updates, config.authToken)

      // Shape will automatically update via subscription when ElectricSQL syncs new data
    } catch (updateError) {
      const errorMessage = updateError instanceof Error ? updateError.message : String(updateError)
      throw new Error(`Failed to update conversation: ${errorMessage}`)
    }
  }

  const deleteConversation = async (id: string) => {
    if (!enabled) {
      throw new Error('ElectricSQL is not enabled')
    }

    // ✅ Uses RevealUI CMS API instead of unverified ElectricSQL REST endpoint
    try {
      await apiDeleteConversation(id, config.authToken)

      // Shape will automatically update via subscription when ElectricSQL syncs new data
    } catch (deleteError) {
      const errorMessage = deleteError instanceof Error ? deleteError.message : String(deleteError)
      throw new Error(`Failed to delete conversation: ${errorMessage}`)
    }
  }

  const refresh = async () => {
    // ElectricSQL shapes automatically refresh via subscription
    // This is a no-op as shapes are reactive
    await Promise.resolve()
  }

  return {
    conversations,
    isLoading,
    error,
    createConversation,
    updateConversation,
    deleteConversation,
    refresh,
  }
}
