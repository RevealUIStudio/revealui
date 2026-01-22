/**
 * useAgentMemory Hook
 *
 * React hook for agent memory management using database storage.
 * Provides reactive memory data with foundation for real-time sync.
 */

'use client'

import { useCallback, useEffect, useState } from 'react'
import { useSync } from '../provider/index.js'
import type { MemoryItem, MemoryType } from '@revealui/contracts/agents'

interface StoredMemory extends MemoryItem {
  id: string
  createdAt: Date
  updatedAt: Date
}

interface UseAgentMemoryOptions {
  agentId: string
  userId: string
  limit?: number
  /** Minimum importance score (0-1) */
  minImportance?: number
  /** Filter by memory type */
  type?: MemoryType
}

interface UseAgentMemoryReturn {
  /** Current memories (reactive) */
  memories: StoredMemory[]
  /** Loading state */
  isLoading: boolean
  /** Error state */
  error: string | null
  /** Connection status */
  isConnected: boolean
  /** Add new memory */
  addMemory: (content: string, context?: Record<string, unknown>, importance?: number, type?: MemoryType) => Promise<StoredMemory>
  /** Update existing memory */
  updateMemory: (id: string, updates: Partial<Pick<StoredMemory, 'content' | 'importance' | 'metadata'>>) => Promise<StoredMemory | null>
  /** Delete memory */
  deleteMemory: (id: string) => Promise<boolean>
  /** Search memories */
  searchMemories: (query: string, options?: { limit?: number; minImportance?: number }) => Promise<StoredMemory[]>
  /** Get memory statistics */
  getMemoryStats: () => Promise<{ total: number; averageImportance: number; recentCount: number }>
  /** Clear all memories */
  clearMemories: () => Promise<void>
  /** Refresh memories from server */
  refresh: () => Promise<void>
}

export function useAgentMemory(options: UseAgentMemoryOptions): UseAgentMemoryReturn {
  const { agentId, userId, limit = 50, minImportance, type } = options
  const { client, isConnected } = useSync()

  const [memories, setMemories] = useState<StoredMemory[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Load memories on mount and when dependencies change
  const loadMemories = useCallback(async () => {
    if (!client || !isConnected) return

    try {
      setIsLoading(true)
      setError(null)

      const context = {
        ...(type && { type }),
        ...(minImportance !== undefined && { minImportance }),
      }

      const memoryList = await client.memory.retrieve(userId, Object.keys(context).length > 0 ? context : undefined, limit)
      setMemories(memoryList)
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load memories'
      setError(errorMessage)
    } finally {
      setIsLoading(false)
    }
  }, [client, isConnected, userId, limit, minImportance, type])

  useEffect(() => {
    loadMemories()
  }, [loadMemories])

  // Memory operations
  const addMemory = useCallback(async (
    content: string,
    context: Record<string, unknown> = {},
    importance = 0.5,
    memoryType: MemoryType = 'fact'
  ): Promise<StoredMemory> => {
    if (!client) {
      throw new Error('Sync client not available')
    }

    const newMemory = await client.memory.store({
      userId,
      agentId,
      content,
      type: memoryType,
      context,
      importance,
      metadata: {
        agentId,
        context,
      },
    })

    // Update local state
    setMemories(prev => [newMemory, ...prev].slice(0, limit))

    return newMemory
  }, [client, userId, agentId, limit])

  const updateMemory = useCallback(async (
    id: string,
    updates: Partial<Pick<StoredMemory, 'content' | 'importance' | 'metadata'>>
  ): Promise<StoredMemory | null> => {
    if (!client) {
      throw new Error('Sync client not available')
    }

    const updatedMemory = await client.memory.update(id, updates)

    if (updatedMemory) {
      setMemories(prev =>
        prev.map(memory => memory.id === id ? updatedMemory : memory)
      )
    }

    return updatedMemory
  }, [client])

  const deleteMemory = useCallback(async (id: string): Promise<boolean> => {
    if (!client) {
      throw new Error('Sync client not available')
    }

    const deleted = await client.memory.delete(id)

    if (deleted) {
      setMemories(prev => prev.filter(memory => memory.id !== id))
    }

    return deleted
  }, [client])

  const searchMemories = useCallback(async (
    query: string,
    options: { limit?: number; minImportance?: number } = {}
  ): Promise<StoredMemory[]> => {
    if (!client) {
      throw new Error('Sync client not available')
    }

    return await client.memory.findSimilar(userId, query, options.limit)
  }, [client, userId])

  const getMemoryStats = useCallback(async () => {
    if (!client) {
      throw new Error('Sync client not available')
    }

    const stats = await client.memory.getStats(userId)
    return {
      total: stats.totalMemories,
      averageImportance: stats.averageImportance,
      recentCount: stats.recentCount,
    }
  }, [client, userId])

  const clearMemories = useCallback(async (): Promise<void> => {
    // For now, this would need to be implemented in the service
    // We'll clear local state as a placeholder
    setMemories([])
  }, [])

  const refresh = useCallback(async () => {
    await loadMemories()
  }, [loadMemories])

  return {
    memories,
    isLoading,
    error,
    isConnected,
    addMemory,
    updateMemory,
    deleteMemory,
    searchMemories,
    getMemoryStats,
    clearMemories,
    refresh,
  }
}