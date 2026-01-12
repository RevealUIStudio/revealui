/**
 * useAgentContext Hook (New System - HTTP-based)
 *
 * React hook for accessing and updating agent context in real-time.
 * Provides cross-tab/session sync via ElectricSQL shapes.
 *
 * Uses ElectricSQL useShape hook to automatically sync data across tabs and sessions.
 */

import { useShape } from '@electric-sql/react'
import { buildShapeUrl } from '../client'
import { useElectric } from '../provider'
import type { AgentContext } from '../schema'
import { updateAgentContext } from '../utils/revealui-api'

// =============================================================================
// Hook Types
// =============================================================================

export interface UseAgentContextOptions {
  /** Session ID to filter by */
  sessionId?: string
  /** Enable real-time updates */
  enabled?: boolean
}

export interface UseAgentContextResult {
  /** Current agent context */
  context: AgentContext | null
  /** All contexts matching the filter */
  contexts: AgentContext[]
  /** Loading state */
  isLoading: boolean
  /** Error state */
  error: Error | null
  /** Update context function */
  updateContext: (updates: Partial<AgentContext>) => Promise<void>
  /** Refresh context */
  refresh: () => Promise<void>
}

// =============================================================================
// Hook Implementation
// =============================================================================

/**
 * Hook for accessing agent context in real-time.
 *
 * @param agentId - Agent ID to get context for
 * @param options - Additional options
 * @returns Context data and update functions
 *
 * @example
 * ```typescript
 * const { context, updateContext } = useAgentContext('agent-123')
 *
 * // Update context
 * await updateContext({
 *   context: { tokensUsed: 150, lastUsed: new Date() }
 * })
 * ```
 */
export function useAgentContext(
  agentId: string,
  options?: UseAgentContextOptions,
): UseAgentContextResult {
  const config = useElectric()
  const { sessionId, enabled = true } = options || {}

  // ✅ VERIFIED: Based on TypeScript definitions
  // URL should be base endpoint only, filtering in params object
  const shapeUrl = buildShapeUrl(config.serviceUrl)

  // Build WHERE clause and params for filtering
  // ✅ VERIFIED: Use SQL WHERE clause format, not query params
  let whereClause = 'agent_id = $1'
  const whereParams: Record<string, string> = { '1': agentId }

  if (sessionId) {
    whereClause += ' AND session_id = $2'
    whereParams['2'] = sessionId
  }

  // Use the new useShape hook with correct API structure
  const {
    isLoading,
    data,
    error: shapeError,
    isError,
  } = useShape({
    url: enabled ? shapeUrl : '',
    params: enabled
      ? {
          table: 'agent_contexts',
          where: whereClause,
          params: whereParams,
        }
      : undefined,
    headers: config.authToken
      ? {
          Authorization: () => `Bearer ${config.authToken}`,
        }
      : undefined,
  })

  // ✅ VERIFIED: useShape returns { data: T[] } where T extends Row
  // Type assertion still needed due to generic type constraints, but format is verified
  const contexts: AgentContext[] = Array.isArray(data) ? (data as unknown as AgentContext[]) : []

  // Find specific context
  const context =
    sessionId && contexts.length > 0
      ? contexts.find((c) => c.session_id === sessionId) || null
      : contexts[0] || null

  // ✅ VERIFIED: useShape returns error and isError fields
  // Transform error to Error type for consistent API
  const error =
    isError && shapeError
      ? shapeError instanceof Error
        ? shapeError
        : new Error(typeof shapeError === 'string' ? shapeError : JSON.stringify(shapeError))
      : null

  const updateContext = async (updates: Partial<AgentContext>) => {
    if (!enabled) {
      throw new Error('ElectricSQL is not enabled')
    }

    // ✅ Uses RevealUI CMS API instead of unverified ElectricSQL REST endpoint
    // Reads still use ElectricSQL shapes (verified), mutations use RevealUI API (proven)
    const targetSessionId = sessionId || context?.session_id || 'default'

    try {
      // Use RevealUI CMS API endpoint (verified and working)
      await updateAgentContext(
        targetSessionId,
        agentId,
        {
          // Map AgentContext updates to API format
          context: updates.context || updates,
        },
        config.authToken,
      )

      // Shape will automatically update via subscription when ElectricSQL syncs new data
    } catch (updateError) {
      const errorMessage = updateError instanceof Error ? updateError.message : String(updateError)
      throw new Error(`Failed to update agent context: ${errorMessage}`)
    }
  }

  const refresh = async () => {
    // ElectricSQL shapes automatically refresh via subscription
    // This is a no-op as shapes are reactive
    await Promise.resolve()
  }

  return {
    context,
    contexts,
    isLoading,
    error,
    updateContext,
    refresh,
  }
}
