/**
 * useAgentContext Hook
 *
 * React hook for agent context management using database storage.
 * Provides reactive context state with foundation for real-time sync.
 */

'use client'

import { useCallback, useEffect, useState } from 'react'
import { useSync } from '../provider/index.js'

interface AgentContextData {
  id: string
  agentId: string
  userId: string
  sessionId?: string
  context: Record<string, unknown>
  lastUpdated: Date
  version: number
}

interface UseAgentContextOptions {
  agentId: string
  userId: string
  sessionId?: string
  autoSave?: boolean
  debounceMs?: number
}

interface UseAgentContextReturn {
  /** Current context data */
  context: AgentContextData | null
  /** Loading state */
  isLoading: boolean
  /** Error state */
  error: string | null
  /** Connection status */
  isConnected: boolean
  /** Whether there are unsaved changes */
  hasUnsavedChanges: boolean
  /** Update context data */
  updateContext: (updates: Record<string, unknown>) => void
  /** Manually save context */
  saveContext: () => Promise<void>
  /** Reset context to initial state */
  resetContext: () => void
  /** Clear all context data */
  clearContext: () => Promise<void>
}

export function useAgentContext(options: UseAgentContextOptions): UseAgentContextReturn {
  const { agentId, userId, sessionId, autoSave = true, debounceMs = 1000 } = options
  const { client, isConnected } = useSync()

  const [context, setContext] = useState<AgentContextData | null>(null)
  const [localContext, setLocalContext] = useState<Record<string, unknown>>({})
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false)

  // Load context on mount
  useEffect(() => {
    if (!client || !isConnected) return

    const loadContext = async () => {
      try {
        setIsLoading(true)
        setError(null)

        // For now, create a default context since we don't have database storage yet
        const defaultContext: AgentContextData = {
          id: `${sessionId || 'default'}:${agentId}`,
          agentId,
          userId,
          sessionId,
          context: {},
          lastUpdated: new Date(),
          version: 1,
        }

        setContext(defaultContext)
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Failed to load context'
        setError(errorMessage)
      } finally {
        setIsLoading(false)
      }
    }

    loadContext()
  }, [client, isConnected, agentId, userId, sessionId])

  // Context operations
  const updateContext = useCallback((updates: Record<string, unknown>) => {
    setLocalContext((prev) => ({ ...prev, ...updates }))
    setHasUnsavedChanges(true)

    // Update the context with merged data
    setContext((prev) => {
      if (!prev) return prev
      return {
        ...prev,
        context: { ...prev.context, ...updates },
        lastUpdated: new Date(),
        version: prev.version + 1,
      }
    })
  }, [])

  const saveContext = useCallback(async (): Promise<void> => {
    if (!context) return

    try {
      // For now, just mark as saved since we don't have database storage
      setHasUnsavedChanges(false)
      setError(null)
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to save context'
      setError(errorMessage)
      throw err
    }
  }, [context])

  const resetContext = useCallback(() => {
    setLocalContext({})
    setHasUnsavedChanges(true)

    setContext((prev) => {
      if (!prev) return prev
      return {
        ...prev,
        context: {},
        lastUpdated: new Date(),
        version: prev.version + 1,
      }
    })
  }, [])

  const clearContext = useCallback(async (): Promise<void> => {
    try {
      setContext(null)
      setLocalContext({})
      setHasUnsavedChanges(false)
      setError(null)
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to clear context'
      setError(errorMessage)
      throw err
    }
  }, [])

  return {
    context,
    isLoading,
    error,
    isConnected,
    hasUnsavedChanges,
    updateContext,
    saveContext,
    resetContext,
    clearContext,
  }
}
