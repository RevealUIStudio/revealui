/**
 * ElectricSQL React Hooks
 *
 * React hooks for real-time data synchronization using ElectricSQL.
 * Provides live queries, conflict resolution, and sync status management.
 */

import { useLiveQuery } from '@electric-sql/react'
import { useCallback, useEffect, useState } from 'react'
import type { SyncClient } from '../client/index.js'
import { createConversationsShape, createAgentMemoriesShape } from '../shapes.js'
import type { ConversationMessage, MemoryItem } from '@revealui/contracts/agents'

// =============================================================================
// Live Query Hooks
// =============================================================================

/**
 * Hook for live conversation queries
 */
export function useLiveConversations(userId: string, agentId?: string) {
  const shape = createConversationsShape({ userId, agentId })

  const { data: conversations, isLoading, error } = useLiveQuery(
    // Note: This would use the actual Electric database query
    // For now, returning mock data structure
    { conversations: [], isLoading: true, error: null }
  )

  return {
    conversations: conversations || [],
    isLoading,
    error,
  }
}

/**
 * Hook for live memory queries
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
    // Note: This would use the actual Electric database query
    { memories: [], isLoading: true, error: null }
  )

  // Filter by importance if specified
  const filteredMemories = memories?.filter((memory: any) => {
    if (minImportance !== undefined) {
      const importance = (memory.metadata as any)?.importance || 0
      return importance >= minImportance
    }
    return true
  }).slice(0, limit) || []

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
  const shape = createConversationsShape({
    userId,
    where: "status = 'active'"
  })

  const { data: conversations, isLoading, error } = useLiveQuery(
    { conversations: [], isLoading: true, error: null }
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
      // This would query the actual sync status from ElectricSQL
      // For now, returning mock status
      setStatus({
        isConnected: client.isConnected(),
        lastSyncTimestamp: new Date(),
        pendingChanges: 0,
        conflicts: 0,
        devices: [
          {
            deviceId: 'current-device',
            deviceName: navigator.userAgent.slice(0, 50),
            lastSeen: new Date(),
            isActive: true,
            syncStatus: 'synced',
          },
        ],
      })
    }

    updateStatus()
    const interval = setInterval(updateStatus, 5000) // Update every 5 seconds

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
    // This would query for conflicts from ElectricSQL
    // For now, returning empty array
    setConflicts([])
  }, [])

  const resolveConflict = useCallback(async (
    conflictId: string,
    resolution: 'local' | 'remote' | 'merge'
  ) => {
    setIsResolving(true)
    try {
      // This would resolve the conflict in ElectricSQL
      setConflicts(prev => prev.filter(c => c.id !== conflictId))
    } finally {
      setIsResolving(false)
    }
  }, [])

  useEffect(() => {
    detectConflicts()
    const interval = setInterval(detectConflicts, 10000) // Check every 10 seconds

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
// Multi-Device Sync Hooks
// =============================================================================

/**
 * Hook for device management
 */
export function useDeviceSync(client: SyncClient) {
  const [devices, setDevices] = useState<DeviceStatus[]>([])

  const registerDevice = useCallback(async (deviceName: string) => {
    // This would register the device with ElectricSQL
    const deviceId = crypto.randomUUID()
    const newDevice: DeviceStatus = {
      deviceId,
      deviceName,
      lastSeen: new Date(),
      isActive: true,
      syncStatus: 'synced',
    }
    setDevices(prev => [...prev, newDevice])
    return deviceId
  }, [])

  const syncDevice = useCallback(async (deviceId: string) => {
    // This would trigger sync for specific device
    setDevices(prev =>
      prev.map(device =>
        device.deviceId === deviceId
          ? { ...device, syncStatus: 'syncing' as const }
          : device
      )
    )

    // Simulate sync completion
    setTimeout(() => {
      setDevices(prev =>
        prev.map(device =>
          device.deviceId === deviceId
            ? { ...device, syncStatus: 'synced' as const, lastSeen: new Date() }
            : device
        )
      )
    }, 2000)
  }, [])

  return {
    devices,
    registerDevice,
    syncDevice,
  }
}

// =============================================================================
// Real-Time Collaboration Hooks
// =============================================================================

/**
 * Hook for real-time conversation collaboration
 */
export function useRealtimeConversation(conversationId: string, client: SyncClient) {
  const [participants, setParticipants] = useState<string[]>([])
  const [isTyping, setIsTyping] = useState<Record<string, boolean>>({})

  const sendMessage = useCallback(async (message: ConversationMessage) => {
    // This would send message through ElectricSQL for real-time sync
    await client.collaboration.sendMessage(conversationId, message, 'current-user')
  }, [conversationId, client])

  const setTyping = useCallback((userId: string, typing: boolean) => {
    setIsTyping(prev => ({ ...prev, [userId]: typing }))
  }, [])

  return {
    participants,
    isTyping,
    sendMessage,
    setTyping,
  }
}

/**
 * Hook for optimistic updates with conflict resolution
 */
export function useOptimisticUpdate<T>(
  initialValue: T,
  updateFn: (value: T) => Promise<T>
) {
  const [value, setValue] = useState(initialValue)
  const [isUpdating, setIsUpdating] = useState(false)
  const [error, setError] = useState<Error | null>(null)

  const update = useCallback(async (newValue: T) => {
    setIsUpdating(true)
    setError(null)

    // Optimistic update
    setValue(newValue)

    try {
      const result = await updateFn(newValue)
      setValue(result) // Confirm with server response
    } catch (err) {
      // Revert on error
      setValue(initialValue)
      setError(err as Error)
    } finally {
      setIsUpdating(false)
    }
  }, [initialValue, updateFn])

  return {
    value,
    isUpdating,
    error,
    update,
  }
}