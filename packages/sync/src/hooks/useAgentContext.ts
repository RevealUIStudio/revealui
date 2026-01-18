/**
 * useAgentContext Hook
 *
 * Manages agent context state with ElectricSQL real-time sync.
 * Provides persistent context across sessions.
 */

'use client'

import { useState, useEffect, useCallback } from 'react'
import { useElectric } from '../provider/index.js'
import type { ElectricClient } from '../client/index.js'

interface AgentContext {
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

export function useAgentContext(options: UseAgentContextOptions) {
  const { client, isConnected } = useElectric()
  const { agentId, userId, sessionId, autoSave = true, debounceMs = 1000 } = options

  const [context, setContext] = useState<AgentContext | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false)

  // Load initial context
  useEffect(() => {
    if (!client || !isConnected) return

    const loadContext = async () => {
      try {
        setIsLoading(true)
        setError(null)

        // Load context from ElectricSQL
        const contextData = await loadAgentContext(client, agentId, userId, sessionId)

        if (contextData) {
          setContext(contextData)
        } else {
          // Create initial context
          const initialContext: AgentContext = {
            id: crypto.randomUUID(),
            agentId,
            userId,
            sessionId,
            context: {},
            lastUpdated: new Date(),
            version: 1,
          }
          setContext(initialContext)
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load context')
      } finally {
        setIsLoading(false)
      }
    }

    loadContext()
  }, [client, isConnected, agentId, userId, sessionId])

  // Auto-save with debouncing
  useEffect(() => {
    if (!autoSave || !hasUnsavedChanges || !context) return

    const timeoutId = setTimeout(() => {
      saveContext()
    }, debounceMs)

    return () => clearTimeout(timeoutId)
  }, [context, hasUnsavedChanges, autoSave, debounceMs])

  const updateContext = useCallback((updates: Record<string, unknown>) => {
    setContext(prev => {
      if (!prev) return prev

      return {
        ...prev,
        context: { ...prev.context, ...updates },
        lastUpdated: new Date(),
        version: prev.version + 1,
      }
    })
    setHasUnsavedChanges(true)
  }, [])

  const saveContext = useCallback(async () => {
    if (!client || !context) return

    try {
      await saveAgentContext(client, context)
      setHasUnsavedChanges(false)
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save context')
    }
  }, [client, context])

  const resetContext = useCallback(() => {
    setContext(prev => {
      if (!prev) return prev

      return {
        ...prev,
        context: {},
        lastUpdated: new Date(),
        version: prev.version + 1,
      }
    })
    setHasUnsavedChanges(true)
  }, [])

  const clearContext = useCallback(async () => {
    if (!client || !context) return

    try {
      await clearAgentContext(client, context.id)
      setContext(null)
      setHasUnsavedChanges(false)
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to clear context')
    }
  }, [client, context])

  return {
    context,
    isLoading,
    error,
    hasUnsavedChanges,
    updateContext,
    saveContext,
    resetContext,
    clearContext,
    isConnected,
  }
}

// Helper functions for ElectricSQL operations
async function loadAgentContext(
  client: ElectricClient,
  agentId: string,
  userId: string,
  sessionId?: string
): Promise<AgentContext | null> {
  // This would query the agent_contexts table in ElectricSQL
  // For now, return mock data
  return {
    id: crypto.randomUUID(),
    agentId,
    userId,
    sessionId,
    context: {},
    lastUpdated: new Date(),
    version: 1,
  }
}

async function saveAgentContext(client: ElectricClient, context: AgentContext): Promise<void> {
  // This would save to the agent_contexts table in ElectricSQL
  // Implementation would go here
}

async function clearAgentContext(client: ElectricClient, contextId: string): Promise<void> {
  // This would delete from the agent_contexts table in ElectricSQL
  // Implementation would go here
}