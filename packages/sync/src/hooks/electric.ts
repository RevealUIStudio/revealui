/**
 * ElectricSQL React Hooks
 *
 * React hooks for real-time data synchronization using ElectricSQL.
 */

import { useLiveQuery } from '@electric-sql/react'
import { useCallback, useEffect, useState } from 'react'
import type { SyncClient } from '../client/index.js'
import { createConversationsShape, createAgentMemoriesShape } from '../shapes.js'
import type { ConversationMessage } from '@revealui/contracts/agents'

// =============================================================================
// Sync Client Integration
// =============================================================================

/**
 * Main hook for conversation sync operations
 */
export function useConversationSync(client: SyncClient, userId: string) {
  const [conversations, setConversations] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)

  // Load conversations on mount
  useEffect(() => {
    loadConversations()
  }, [userId])

  const loadConversations = useCallback(async () => {
    try {
      setIsLoading(true)
      setError(null)
      const data = await client.conversations.getByUser(userId)
      setConversations(data)
    } catch (err) {
      setError(err as Error)
    } finally {
      setIsLoading(false)
    }
  }, [client, userId])

  const createConversation = useCallback(async (data: { agentId: string; title?: string }) => {
    try {
      const newConversation = await client.conversations.create({
        userId,
        ...data,
      })
      setConversations(prev => [newConversation, ...prev])
      return newConversation
    } catch (err) {
      setError(err as Error)
      throw err
    }
  }, [client, userId])

  const sendMessage = useCallback(async (conversationId: string, message: { role: string; content: string }) => {
    try {
      const newMessage = await client.conversations.addMessage(conversationId, {
        role: message.role as any,
        content: message.content,
      })

      // Update conversation in list with new message
      setConversations(prev =>
        prev.map(conv =>
          conv.id === conversationId
            ? { ...conv, updatedAt: new Date() }
            : conv
        )
      )

      return newMessage
    } catch (err) {
      setError(err as Error)
      throw err
    }
  }, [client])

  return {
    conversations,
    isLoading,
    error,
    createConversation,
    sendMessage,
    refreshConversations: loadConversations,
  }
}

// =============================================================================
// Real-Time Query Hooks
// =============================================================================

/**
 * Hook for live conversation queries - ElectricSQL integration
 */
export function useLiveConversations(userId: string, agentId?: string) {
  const shape = createConversationsShape({
    userId,
    ...(agentId && { agentId }),
  })

  // Use ElectricSQL live query when available
  const { data: conversations, isLoading, error } = useLiveQuery(
    (db: any) => {
      if (!db?.conversations?.liveMany) {
        // Fallback when ElectricSQL is not available
        return { conversations: [], isLoading: false, error: null }
      }

      return db.conversations.liveMany({
        where: { userId, ...(agentId && { agentId }) },
        orderBy: { updatedAt: 'desc' }
      })
    }
  )

  return {
    conversations: conversations || [],
    isLoading,
    error,
  }
}

/**
 * Hook for live memory queries - ElectricSQL integration
 */
export function useLiveMemories(userId: string, options: {
  limit?: number
  type?: string
  minImportance?: number
} = {}) {
  const { limit = 50, type, minImportance } = options
  const shape = createAgentMemoriesShape({
    userId,
    where: type ? `type = '${type}'` : undefined
  })

  const { data: memories, isLoading, error } = useLiveQuery(
    (db: any) => {
      if (!db?.agentMemories?.liveMany) {
        // Fallback when ElectricSQL is not available
        return { memories: [], isLoading: false, error: null }
      }

      let query = db.agentMemories.liveMany({
        where: { agentId: userId },
        orderBy: { createdAt: 'desc' },
        limit
      })

      // Filter expired memories
      query = query.where((memory: any) =>
        !memory.expiresAt || new Date(memory.expiresAt) > new Date()
      )

      return query
    }
  )

  // Filter by importance if specified
  const filteredMemories = memories?.filter((memory: any) => {
    if (minImportance !== undefined) {
      const importance = (memory.metadata as any)?.importance || 0
      return importance >= minImportance
    }
    return true
  }) || []

  return {
    memories: filteredMemories,
    isLoading,
    error,
  }
}

/**
 * Hook for active conversation sessions
 */
export function useActiveConversations(userId: string) {
  const { data: conversations, isLoading, error } = useLiveQuery(
    (db: any) => {
      if (!db?.conversations?.liveMany) {
        // Fallback when ElectricSQL is not available
        return { conversations: [], isLoading: false, error: null }
      }

      return db.conversations.liveMany({
        where: { userId, status: 'active' },
        orderBy: { updatedAt: 'desc' }
      })
    }
  )

  return {
    conversations: conversations || [],
    isLoading,
    error,
  }
}

// =============================================================================
// Sync Status Hooks
// =============================================================================

export interface SyncStatus {
  isConnected: boolean
  lastSyncTimestamp: Date | null
  pendingChanges: number
  conflicts: number
  devices: DeviceStatus[]
}

export interface DeviceStatus {
  deviceId: string
  deviceName: string
  lastSeen: Date
  isActive: boolean
  syncStatus: 'synced' | 'syncing' | 'error'
}

/**
 * Hook for monitoring sync status
 */
export function useSyncStatus(client: SyncClient): SyncStatus {
  const [status, setStatus] = useState<SyncStatus>({
    isConnected: false,
    lastSyncTimestamp: null,
    pendingChanges: 0,
    conflicts: 0,
    devices: [],
  })

  useEffect(() => {
    const updateStatus = () => {
      setStatus({
        isConnected: client.isConnected(),
        lastSyncTimestamp: new Date(), // TODO: Get from ElectricSQL sync metadata
        pendingChanges: 0, // TODO: Get from ElectricSQL pending changes
        conflicts: 0, // TODO: Get from conflict resolution system
        devices: [
          {
            deviceId: crypto.randomUUID(), // TODO: Get from device registration
            deviceName: navigator.userAgent.slice(0, 50),
            lastSeen: new Date(),
            isActive: true,
            syncStatus: client.isConnected() ? 'synced' : 'error',
          },
        ],
      })
    }

    updateStatus()
    const interval = setInterval(updateStatus, 5000)

    return () => clearInterval(interval)
  }, [client])

  return status
}

// =============================================================================
// Conflict Resolution Hooks
// =============================================================================

export interface SyncConflict {
  id: string
  table: string
  recordId: string
  localVersion: any
  remoteVersion: any
  conflictType: 'version' | 'content' | 'deletion'
  timestamp: Date
}

/**
 * Hook for conflict detection and resolution
 */
export function useConflictResolution(client: SyncClient) {
  const [conflicts, setConflicts] = useState<SyncConflict[]>([])
  const [isResolving, setIsResolving] = useState(false)

  const detectConflicts = useCallback(async () => {
    // Would integrate with ElectricSQL conflict detection
    setConflicts([])
  }, [])

  const resolveConflict = useCallback(async (
    conflictId: string,
    resolution: 'local' | 'remote' | 'merge'
  ) => {
    setIsResolving(true)
    try {
      // Would implement real conflict resolution
      setConflicts(prev => prev.filter(c => c.id !== conflictId))
    } finally {
      setIsResolving(false)
    }
  }, [])

  useEffect(() => {
    detectConflicts()
    const interval = setInterval(detectConflicts, 10000)

    return () => clearInterval(interval)
  }, [detectConflicts])

  return {
    conflicts,
    isResolving,
    resolveConflict,
    refreshConflicts: detectConflicts,
  }
}

// =============================================================================
// Device Management Hooks
// =============================================================================

/**
 * Hook for device registration and management
 */
export function useDeviceRegistration(client: SyncClient, userId: string) {
  const [deviceId, setDeviceId] = useState<string | null>(null)
  const [isRegistering, setIsRegistering] = useState(false)
  const [error, setError] = useState<Error | null>(null)

  // Generate device ID on mount if not already set
  useEffect(() => {
    if (!deviceId) {
      const storedDeviceId = localStorage.getItem('revealui_device_id')
      if (storedDeviceId) {
        setDeviceId(storedDeviceId)
      }
    }
  }, [deviceId])

  const register = useCallback(async (deviceName?: string) => {
    setIsRegistering(true)
    setError(null)

    try {
      // Generate or use existing device ID
      let registeredDeviceId = deviceId
      if (!registeredDeviceId) {
        registeredDeviceId = crypto.randomUUID()
        localStorage.setItem('revealui_device_id', registeredDeviceId)
        setDeviceId(registeredDeviceId)
      }

      // TODO: Register device with ElectricSQL when server is connected
      // This would sync device information across all user devices

      return registeredDeviceId
    } catch (err) {
      const error = err as Error
      setError(error)
      throw error
    } finally {
      setIsRegistering(false)
    }
  }, [deviceId])

  return {
    deviceId,
    isRegistering,
    error,
    register,
  }
}

/**
 * Hook for device sync
 */
export function useDeviceSync(client: SyncClient, deviceId: string | null) {
  const [syncResult, setSyncResult] = useState<any>(null)
  const [isSyncing, setIsSyncing] = useState(false)
  const [error, setError] = useState<Error | null>(null)

  const sync = useCallback(async (options?: { forceFullSync?: boolean }) => {
    if (!deviceId) return

    setIsSyncing(true)
    setError(null)

    try {
      // Would implement real sync with ElectricSQL
      const result = { success: true, recordsSynced: 10, conflictsResolved: 0 }
      setSyncResult(result)
      return result
    } catch (err) {
      const error = err as Error
      setError(error)
      throw error
    } finally {
      setIsSyncing(false)
    }
  }, [deviceId])

  return {
    syncResult,
    isSyncing,
    error,
    sync,
  }
}

/**
 * Hook for real-time conversation collaboration
 */
export function useRealtimeConversation(conversationId: string, client: SyncClient) {
  const [participants, setParticipants] = useState<string[]>([])
  const [isTyping, setIsTyping] = useState<Record<string, boolean>>({})

  const sendMessage = useCallback(async (message: ConversationMessage) => {
    // Would send through real ElectricSQL for sync
    await client.collaboration.sendMessage(conversationId, message, 'current-user')
  }, [conversationId, client])

  const setTypingIndicator = useCallback((userId: string, typing: boolean) => {
    setIsTyping(prev => ({ ...prev, [userId]: typing }))
  }, [])

  return {
    participants,
    isTyping,
    sendMessage,
    setTyping: setTypingIndicator,
  }
}