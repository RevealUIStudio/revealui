/**
 * useWorkingMemory Hook
 *
 * React hook for managing working memory in client components.
 */

import { useCallback, useEffect, useState } from 'react'

// =============================================================================
// Types
// =============================================================================

export interface UseWorkingMemoryOptions {
  autoSync?: boolean
  syncInterval?: number // milliseconds
}

export interface UseWorkingMemoryReturn {
  context: Record<string, unknown>
  setContext: (context: Record<string, unknown>) => Promise<void>
  updateContext: (updates: Partial<Record<string, unknown>>) => Promise<void>
  getContextValue: (key: string) => unknown
  setContextValue: (key: string, value: unknown) => Promise<void>
  sessionState: {
    status: 'active' | 'paused' | 'completed'
    focus?: {
      siteId?: string
      pageId?: string
      blockId?: string
      selection?: string[]
    }
    currentTask?: {
      id: string
      description: string
      status: 'pending' | 'running' | 'completed' | 'failed'
      progress?: number
    }
  }
  updateSessionState: (state: Partial<UseWorkingMemoryReturn['sessionState']>) => Promise<void>
  activeAgents: Array<{
    id: string
    name: string
    description: string
    model: string
    systemPrompt: string
    tools: unknown[]
    capabilities: string[]
    temperature: number
    maxTokens: number
  }>
  addAgent: (agent: UseWorkingMemoryReturn['activeAgents'][0]) => Promise<void>
  removeAgent: (agentId: string) => Promise<void>
  isLoading: boolean
  error: Error | null
  sync: () => Promise<void>
}

// =============================================================================
// Hook
// =============================================================================

/**
 * React hook for working memory management.
 *
 * @param sessionId - Session identifier
 * @param options - Hook options
 * @returns Working memory state and operations
 */
export function useWorkingMemory(
  sessionId: string,
  options: UseWorkingMemoryOptions = {},
): UseWorkingMemoryReturn {
  const { autoSync = false, syncInterval = 5000 } = options

  const [context, setContextState] = useState<Record<string, unknown>>({})
  const [sessionState, setSessionStateState] = useState<UseWorkingMemoryReturn['sessionState']>({
    status: 'active',
  })
  const [activeAgents, setActiveAgents] = useState<UseWorkingMemoryReturn['activeAgents']>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)

  // Load initial state
  useEffect(() => {
    let mounted = true

    async function load() {
      try {
        setIsLoading(true)
        setError(null)

        const response = await fetch(`/api/memory/working/${sessionId}`)
        if (!response.ok) {
          throw new Error(`Failed to load working memory: ${response.statusText}`)
        }

        const data = await response.json()
        if (!mounted) return

        setContextState(data.context || {})
        setSessionStateState(data.sessionState || { status: 'active' })
        setActiveAgents(data.activeAgents || [])
      } catch (err) {
        if (!mounted) return
        setError(err instanceof Error ? err : new Error('Unknown error'))
      } finally {
        if (mounted) {
          setIsLoading(false)
        }
      }
    }

    load()

    return () => {
      mounted = false
    }
  }, [sessionId])

  // Sync function
  const sync = useCallback(async () => {
    try {
      const response = await fetch(`/api/memory/working/${sessionId}`)
      if (!response.ok) {
        throw new Error(`Failed to sync working memory: ${response.statusText}`)
      }

      const data = await response.json()
      setContextState(data.context || {})
      setSessionStateState(data.sessionState || { status: 'active' })
      setActiveAgents(data.activeAgents || [])
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Unknown error'))
    }
  }, [sessionId])

  // Auto-sync
  useEffect(() => {
    if (!autoSync) return

    const interval = setInterval(() => {
      sync()
    }, syncInterval)

    return () => clearInterval(interval)
  }, [autoSync, syncInterval, sync])

  // Set context
  const setContext = useCallback(
    async (newContext: Record<string, unknown>) => {
      try {
        setError(null)
        const response = await fetch(`/api/memory/working/${sessionId}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ context: newContext }),
        })

        if (!response.ok) {
          throw new Error(`Failed to update context: ${response.statusText}`)
        }

        const data = await response.json()
        setContextState(data.context || {})
      } catch (err) {
        setError(err instanceof Error ? err : new Error('Unknown error'))
        throw err
      }
    },
    [sessionId],
  )

  // Update context
  const updateContext = useCallback(
    async (updates: Partial<Record<string, unknown>>) => {
      const newContext = { ...context, ...updates }
      await setContext(newContext)
    },
    [context, setContext],
  )

  // Get context value
  const getContextValue = useCallback(
    (key: string): unknown => {
      return context[key]
    },
    [context],
  )

  // Set context value
  const setContextValue = useCallback(
    async (key: string, value: unknown) => {
      await updateContext({ [key]: value })
    },
    [updateContext],
  )

  // Update session state
  const updateSessionState = useCallback(
    async (state: Partial<UseWorkingMemoryReturn['sessionState']>) => {
      try {
        setError(null)
        const response = await fetch(`/api/memory/working/${sessionId}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sessionState: state }),
        })

        if (!response.ok) {
          throw new Error(`Failed to update session state: ${response.statusText}`)
        }

        const data = await response.json()
        setSessionStateState(data.sessionState || { status: 'active' })
      } catch (err) {
        setError(err instanceof Error ? err : new Error('Unknown error'))
        throw err
      }
    },
    [sessionId],
  )

  // Add agent
  const addAgent = useCallback(
    async (agent: UseWorkingMemoryReturn['activeAgents'][0]) => {
      try {
        setError(null)
        const newAgents = [...activeAgents, agent]
        const response = await fetch(`/api/memory/working/${sessionId}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ activeAgents: newAgents }),
        })

        if (!response.ok) {
          throw new Error(`Failed to add agent: ${response.statusText}`)
        }

        const data = await response.json()
        setActiveAgents(data.activeAgents || [])
      } catch (err) {
        setError(err instanceof Error ? err : new Error('Unknown error'))
        throw err
      }
    },
    [sessionId, activeAgents],
  )

  // Remove agent
  const removeAgent = useCallback(
    async (agentId: string) => {
      try {
        setError(null)
        const newAgents = activeAgents.filter((agent) => agent.id !== agentId)
        const response = await fetch(`/api/memory/working/${sessionId}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ activeAgents: newAgents }),
        })

        if (!response.ok) {
          throw new Error(`Failed to remove agent: ${response.statusText}`)
        }

        const data = await response.json()
        setActiveAgents(data.activeAgents || [])
      } catch (err) {
        setError(err instanceof Error ? err : new Error('Unknown error'))
        throw err
      }
    },
    [sessionId, activeAgents],
  )

  return {
    context,
    setContext,
    updateContext,
    getContextValue,
    setContextValue,
    sessionState,
    updateSessionState,
    activeAgents,
    addAgent,
    removeAgent,
    isLoading,
    error,
    sync,
  }
}
