/**
 * useAgentMemory Hook
 *
 * Manages agent memory with ElectricSQL real-time sync.
 * Provides persistent memory storage and retrieval.
 */

'use client'

import { useState, useEffect, useCallback } from 'react'
import { useElectric } from '../provider/index.js'
import type { ElectricClient } from '../client/index.js'
import type { MemoryItem } from '@revealui/contracts/agents'

interface UseAgentMemoryOptions {
  agentId: string
  userId: string
  limit?: number
  autoSync?: boolean
}

export function useAgentMemory(options: UseAgentMemoryOptions) {
  const { client, isConnected } = useElectric()
  const { agentId, userId, limit = 50, autoSync = true } = options

  const [memories, setMemories] = useState<MemoryItem[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Load memories on mount
  useEffect(() => {
    if (!client || !isConnected) return

    const loadMemories = async () => {
      try {
        setIsLoading(true)
        setError(null)

        const memoryItems = await loadAgentMemories(client, agentId, userId, limit)
        setMemories(memoryItems)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load memories')
      } finally {
        setIsLoading(false)
      }
    }

    loadMemories()
  }, [client, isConnected, agentId, userId, limit])

  // Set up real-time sync
  useEffect(() => {
    if (!client || !autoSync) return

    const unsubscribe = client.subscribe({
      onMemoryUpdate: (memory) => {
        if (memory.agentId === agentId && memory.userId === userId) {
          setMemories(prev => {
            const existing = prev.find(m => m.id === memory.id)
            if (existing) {
              // Update existing
              return prev.map(m => m.id === memory.id ? memory : m)
            } else {
              // Add new
              return [memory, ...prev].slice(0, limit)
            }
          })
        }
      },
    })

    return unsubscribe
  }, [client, autoSync, agentId, userId, limit])

  const addMemory = useCallback(async (
    content: string,
    context: Record<string, unknown> = {},
    importance = 0.5
  ): Promise<MemoryItem> => {
    if (!client) {
      throw new Error('ElectricSQL client not available')
    }

    const memory: Omit<MemoryItem, 'id' | 'createdAt'> = {
      userId,
      agentId,
      content,
      context,
      importance,
    }

    try {
      const savedMemory = await client.memory.store(memory)

      // Update local state
      setMemories(prev => [savedMemory, ...prev].slice(0, limit))

      return savedMemory
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to add memory'
      setError(errorMessage)
      throw new Error(errorMessage)
    }
  }, [client, userId, agentId, limit])

  const updateMemory = useCallback(async (
    memoryId: string,
    updates: Partial<Pick<MemoryItem, 'content' | 'context' | 'importance'>>
  ): Promise<MemoryItem | null> => {
    if (!client) {
      throw new Error('ElectricSQL client not available')
    }

    try {
      const updatedMemory = await client.memory.update(memoryId, updates)

      if (updatedMemory) {
        setMemories(prev =>
          prev.map(m => m.id === memoryId ? updatedMemory : m)
        )
      }

      return updatedMemory
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to update memory'
      setError(errorMessage)
      throw new Error(errorMessage)
    }
  }, [client])

  const deleteMemory = useCallback(async (memoryId: string): Promise<boolean> => {
    if (!client) {
      throw new Error('ElectricSQL client not available')
    }

    try {
      const deleted = await client.memory.delete(memoryId)

      if (deleted) {
        setMemories(prev => prev.filter(m => m.id !== memoryId))
      }

      return deleted
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to delete memory'
      setError(errorMessage)
      throw new Error(errorMessage)
    }
  }, [client])

  const searchMemories = useCallback(async (
    query: string,
    options: { limit?: number; minImportance?: number } = {}
  ): Promise<MemoryItem[]> => {
    if (!client) {
      throw new Error('ElectricSQL client not available')
    }

    try {
      const results = await client.memory.findSimilar(userId, query, options.limit || 10)

      // Filter by importance if specified
      if (options.minImportance !== undefined) {
        return results.filter(m => m.importance >= options.minImportance!)
      }

      return results
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to search memories'
      setError(errorMessage)
      throw new Error(errorMessage)
    }
  }, [client, userId])

  const clearMemories = useCallback(async (): Promise<void> => {
    if (!client) {
      throw new Error('ElectricSQL client not available')
    }

    try {
      // This would need to be implemented in the ElectricClient
      // For now, we'll clear local state
      setMemories([])
      setError(null)
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to clear memories'
      setError(errorMessage)
      throw new Error(errorMessage)
    }
  }, [client])

  const getMemoryStats = useCallback(async () => {
    if (!client) return null

    try {
      return await client.memory.getStats(userId)
    } catch (err) {
      console.warn('Failed to get memory stats:', err)
      return null
    }
  }, [client, userId])

  return {
    memories,
    isLoading,
    error,
    addMemory,
    updateMemory,
    deleteMemory,
    searchMemories,
    clearMemories,
    getMemoryStats,
    isConnected,
  }
}

// Helper functions for ElectricSQL operations
async function loadAgentMemories(
  client: ElectricClient,
  agentId: string,
  userId: string,
  limit: number
): Promise<MemoryItem[]> {
  // This would query the memory_items table in ElectricSQL
  // For now, return empty array
  return []
}