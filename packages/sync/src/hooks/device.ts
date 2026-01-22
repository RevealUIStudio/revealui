/**
 * Device Management React Hooks
 *
 * React hooks for multi-device synchronization and management.
 * Handles device registration, sync status, and network state.
 */

import { useCallback, useEffect, useState } from 'react'
import type { SyncClient } from '../client/index.js'
import { createDeviceManager, createNetworkMonitor, getCurrentDeviceInfo, type DeviceInfo, type DeviceSyncResult } from '../device-management.js'

// =============================================================================
// Device Registration Hook
// =============================================================================

export function useDeviceRegistration(client: SyncClient, userId: string) {
  const [deviceId, setDeviceId] = useState<string | null>(null)
  const [isRegistering, setIsRegistering] = useState(false)
  const [error, setError] = useState<Error | null>(null)

  const register = useCallback(async (deviceName?: string) => {
    setIsRegistering(true)
    setError(null)

    try {
      const deviceManager = createDeviceManager(client)
      const deviceInfo = getCurrentDeviceInfo(userId)

      if (deviceName) {
        deviceInfo.deviceName = deviceName
      }

      const registeredDeviceId = await deviceManager.registerDevice(deviceInfo)
      setDeviceId(registeredDeviceId)

      return registeredDeviceId
    } catch (err) {
      const error = err as Error
      setError(error)
      throw error
    } finally {
      setIsRegistering(false)
    }
  }, [client, userId])

  return {
    deviceId,
    isRegistering,
    error,
    register,
  }
}

// =============================================================================
// Device Sync Hook
// =============================================================================

export function useDeviceSync(client: SyncClient, deviceId: string | null) {
  const [syncResult, setSyncResult] = useState<DeviceSyncResult | null>(null)
  const [isSyncing, setIsSyncing] = useState(false)
  const [error, setError] = useState<Error | null>(null)

  const sync = useCallback(async (options?: { forceFullSync?: boolean }) => {
    if (!deviceId) return

    setIsSyncing(true)
    setError(null)

    try {
      const deviceManager = createDeviceManager(client)
      const result = await deviceManager.syncDevice(deviceId, options || {})
      setSyncResult(result)

      return result
    } catch (err) {
      const error = err as Error
      setError(error)
      throw error
    } finally {
      setIsSyncing(false)
    }
  }, [client, deviceId])

  return {
    syncResult,
    isSyncing,
    error,
    sync,
  }
}

// =============================================================================
// Device List Hook
// =============================================================================

export function useDeviceList(client: SyncClient, userId: string) {
  const [devices, setDevices] = useState<DeviceInfo[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)

  const refresh = useCallback(async () => {
    setIsLoading(true)
    setError(null)

    try {
      const deviceManager = createDeviceManager(client)
      const deviceList = await deviceManager.listUserDevices(userId)
      setDevices(deviceList)
    } catch (err) {
      setError(err as Error)
    } finally {
      setIsLoading(false)
    }
  }, [client, userId])

  useEffect(() => {
    refresh()
  }, [refresh])

  return {
    devices,
    isLoading,
    error,
    refresh,
  }
}

// =============================================================================
// Network Status Hook
// =============================================================================

export function useNetworkStatus() {
  const [isOnline, setIsOnline] = useState(true)
  const [wasOffline, setWasOffline] = useState(false)

  useEffect(() => {
    const monitor = createNetworkMonitor()

    // Set initial status
    setIsOnline(monitor.getStatus())

    // Listen for changes
    const unsubscribe = monitor.onStatusChange((online) => {
      setIsOnline(online)
      if (!online) {
        setWasOffline(true)
      }
    })

    return unsubscribe
  }, [])

  return {
    isOnline,
    wasOffline,
    justCameOnline: isOnline && wasOffline,
  }
}

// =============================================================================
// Auto-Sync Hook
// =============================================================================

export function useAutoSync(
  client: SyncClient,
  deviceId: string | null,
  options: {
    enabled?: boolean
    interval?: number // in milliseconds
    onSyncComplete?: (result: DeviceSyncResult) => void
    onSyncError?: (error: Error) => void
  } = {}
) {
  const { enabled = true, interval = 30000, onSyncComplete, onSyncError } = options
  const [lastSync, setLastSync] = useState<Date | null>(null)

  useEffect(() => {
    if (!enabled || !deviceId) return

    const syncDevice = async () => {
      try {
        const deviceManager = createDeviceManager(client)
        const result = await deviceManager.syncDevice(deviceId)
        setLastSync(new Date())
        onSyncComplete?.(result)
      } catch (error) {
        onSyncError?.(error as Error)
      }
    }

    // Initial sync
    syncDevice()

    // Set up interval
    const intervalId = setInterval(syncDevice, interval)

    return () => clearInterval(intervalId)
  }, [client, deviceId, enabled, interval, onSyncComplete, onSyncError])

  return { lastSync }
}

// =============================================================================
// Device Context Hook
// =============================================================================

export interface DeviceContext {
  deviceId: string | null
  deviceInfo: DeviceInfo | null
  isRegistered: boolean
  isOnline: boolean
  lastSync: Date | null
  registerDevice: (name?: string) => Promise<string>
  syncDevice: () => Promise<void>
  unregisterDevice: () => Promise<void>
}

export function useDeviceContext(client: SyncClient, userId: string): DeviceContext {
  const [deviceId, setDeviceId] = useState<string | null>(null)
  const [deviceInfo, setDeviceInfo] = useState<DeviceInfo | null>(null)
  const [lastSync, setLastSync] = useState<Date | null>(null)

  const { isOnline } = useNetworkStatus()
  const { register, isRegistering } = useDeviceRegistration(client, userId)
  const { sync } = useDeviceSync(client, deviceId)

  const registerDevice = useCallback(async (name?: string) => {
    const registeredId = await register(name)
    setDeviceId(registeredId)
    return registeredId
  }, [register])

  const syncDevice = useCallback(async () => {
    if (deviceId) {
      await sync()
      setLastSync(new Date())
    }
  }, [deviceId, sync])

  const unregisterDevice = useCallback(async () => {
    if (deviceId) {
      const deviceManager = createDeviceManager(client)
      await deviceManager.unregisterDevice(deviceId)
      setDeviceId(null)
      setDeviceInfo(null)
    }
  }, [client, deviceId])

  // Load device info when deviceId changes
  useEffect(() => {
    if (deviceId) {
      const deviceManager = createDeviceManager(client)
      deviceManager.getDeviceInfo(deviceId).then(setDeviceInfo)
    } else {
      setDeviceInfo(null)
    }
  }, [client, deviceId])

  return {
    deviceId,
    deviceInfo,
    isRegistered: !!deviceId,
    isOnline,
    lastSync,
    registerDevice,
    syncDevice,
    unregisterDevice,
  }
}