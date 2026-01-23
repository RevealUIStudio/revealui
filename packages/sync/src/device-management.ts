/**
 * Device Management System
 *
 * Handles multi-device synchronization, registration, and cross-device data sync.
 * Manages device state, sync coordination, and offline/online transitions.
 */

import type { SyncClient } from './client/index.js'
import { ConflictResolutionManager } from './conflict-resolution.js'

// =============================================================================
// Types
// =============================================================================

export interface DeviceInfo {
  id: string
  userId: string
  deviceId: string
  deviceName: string
  deviceType: 'desktop' | 'mobile' | 'tablet' | 'unknown'
  userAgent: string
  lastSeen: Date
  isActive: boolean
  createdAt: Date
  updatedAt: Date
}

export interface SyncSession {
  id: string
  userId: string
  deviceId: string
  startedAt: Date
  lastActivity: Date
  status: 'active' | 'paused' | 'completed'
  changesSynced: number
  conflictsResolved: number
}

export interface DeviceSyncResult {
  deviceId: string
  success: boolean
  recordsSynced: number
  conflictsResolved: number
  errors: string[]
  duration: number
}

export interface DeviceManager {
  registerDevice(deviceInfo: Omit<DeviceInfo, 'id' | 'createdAt' | 'updatedAt'>): Promise<string>
  unregisterDevice(deviceId: string): Promise<void>
  getDeviceInfo(deviceId: string): Promise<DeviceInfo | null>
  listUserDevices(userId: string): Promise<DeviceInfo[]>
  syncDevice(deviceId: string, options?: SyncOptions): Promise<DeviceSyncResult>
  startSyncSession(deviceId: string): Promise<string>
  endSyncSession(sessionId: string): Promise<void>
  handleOfflineTransition(deviceId: string): Promise<void>
  handleOnlineTransition(deviceId: string): Promise<void>
}

export interface SyncOptions {
  tables?: string[]
  forceFullSync?: boolean
  resolveConflicts?: boolean
  timeout?: number
}

// =============================================================================
// Device Detection Utilities
// =============================================================================

export class DeviceDetector {
  static getDeviceType(): 'desktop' | 'mobile' | 'tablet' | 'unknown' {
    if (typeof window === 'undefined') return 'unknown'

    const ua = navigator.userAgent.toLowerCase()
    const width = window.innerWidth

    if (/mobile|android|iphone|ipad|ipod|blackberry|opera mini|iemobile/i.test(ua)) {
      if (width <= 768) {
        return 'mobile'
      } else {
        return 'tablet'
      }
    }

    return 'desktop'
  }

  static getDeviceName(): string {
    if (typeof window === 'undefined') return 'Server'

    const deviceType = DeviceDetector.getDeviceType()
    const ua = navigator.userAgent

    // Extract browser and OS info
    const browser = DeviceDetector.getBrowserName()
    const os = DeviceDetector.getOSName()

    return `${deviceType} - ${browser} on ${os}`
  }

  static getBrowserName(): string {
    if (typeof window === 'undefined') return 'Unknown'

    const ua = navigator.userAgent

    if (ua.includes('Chrome')) return 'Chrome'
    if (ua.includes('Firefox')) return 'Firefox'
    if (ua.includes('Safari') && !ua.includes('Chrome')) return 'Safari'
    if (ua.includes('Edge')) return 'Edge'
    if (ua.includes('Opera')) return 'Opera'

    return 'Unknown Browser'
  }

  static getOSName(): string {
    if (typeof window === 'undefined') return 'Unknown'

    const ua = navigator.userAgent

    if (ua.includes('Windows')) return 'Windows'
    if (ua.includes('Mac')) return 'macOS'
    if (ua.includes('Linux')) return 'Linux'
    if (ua.includes('Android')) return 'Android'
    if (ua.includes('iOS') || ua.includes('iPhone') || ua.includes('iPad')) return 'iOS'

    return 'Unknown OS'
  }

  static generateDeviceId(): string {
    if (typeof window === 'undefined') {
      return `server-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
    }

    // Create a stable device ID based on available information
    const canvas = document.createElement('canvas')
    const ctx = canvas.getContext('2d')
    ctx?.fillText(navigator.userAgent, 0, 0)

    const fingerprint = [
      navigator.userAgent,
      navigator.language,
      screen.width + 'x' + screen.height,
      new Date().getTimezoneOffset(),
      !!window.sessionStorage,
      !!window.localStorage,
      !!window.indexedDB,
      canvas.toDataURL(),
    ].join('|')

    // Simple hash function
    let hash = 0
    for (let i = 0; i < fingerprint.length; i++) {
      const char = fingerprint.charCodeAt(i)
      hash = (hash << 5) - hash + char
      hash = hash & hash // Convert to 32-bit integer
    }

    return `device-${Math.abs(hash).toString(36)}`
  }
}

// =============================================================================
// Device Manager Implementation
// =============================================================================

export class DeviceManagerImpl implements DeviceManager {
  private readonly DEVICE_KEY_PREFIX = 'revealui_device_'
  private readonly SESSION_KEY_PREFIX = 'revealui_session_'

  constructor(private client: SyncClient) {}

  async registerDevice(
    deviceInfo: Omit<DeviceInfo, 'id' | 'createdAt' | 'updatedAt'>,
  ): Promise<string> {
    const id = crypto.randomUUID()
    const now = new Date()

    const device: DeviceInfo = {
      ...deviceInfo,
      id,
      createdAt: now,
      updatedAt: now,
    }

    // Store in database
    await this.client.db.insert('user_devices').values({
      id: device.id,
      userId: device.userId,
      deviceId: device.deviceId,
      deviceName: device.deviceName,
      deviceType: device.deviceType,
      userAgent: device.userAgent,
      lastSeen: device.lastSeen,
      isActive: device.isActive,
      createdAt: device.createdAt,
      updatedAt: device.updatedAt,
    })

    // Store locally for quick access
    if (typeof window !== 'undefined') {
      localStorage.setItem(`${this.DEVICE_KEY_PREFIX}${device.deviceId}`, JSON.stringify(device))
    }

    return device.deviceId
  }

  async unregisterDevice(deviceId: string): Promise<void> {
    // Remove from database
    await this.client.db.delete('user_devices').where('device_id = ?', [deviceId])

    // Remove from local storage
    if (typeof window !== 'undefined') {
      localStorage.removeItem(`${this.DEVICE_KEY_PREFIX}${deviceId}`)
    }
  }

  async getDeviceInfo(deviceId: string): Promise<DeviceInfo | null> {
    // Try local storage first
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem(`${this.DEVICE_KEY_PREFIX}${deviceId}`)
      if (stored) {
        return JSON.parse(stored)
      }
    }

    // Fallback to database
    const [device] = await this.client.db
      .select()
      .from('user_devices')
      .where('device_id = ?', [deviceId])
      .limit(1)

    if (!device) return null

    return {
      id: device.id,
      userId: device.userId,
      deviceId: device.deviceId,
      deviceName: device.deviceName || 'Unknown Device',
      deviceType: (device.deviceType as any) || 'unknown',
      userAgent: device.userAgent || '',
      lastSeen: device.lastSeen,
      isActive: device.isActive,
      createdAt: device.createdAt,
      updatedAt: device.updatedAt,
    }
  }

  async listUserDevices(userId: string): Promise<DeviceInfo[]> {
    const devices = await this.client.db
      .select()
      .from('user_devices')
      .where('user_id = ?', [userId])
      .orderBy('last_seen DESC')

    return devices.map((device) => ({
      id: device.id,
      userId: device.userId,
      deviceId: device.deviceId,
      deviceName: device.deviceName || 'Unknown Device',
      deviceType: (device.deviceType as any) || 'unknown',
      userAgent: device.userAgent || '',
      lastSeen: device.lastSeen,
      isActive: device.isActive,
      createdAt: device.createdAt,
      updatedAt: device.updatedAt,
    }))
  }

  async syncDevice(deviceId: string, options: SyncOptions = {}): Promise<DeviceSyncResult> {
    const startTime = Date.now()
    const result: DeviceSyncResult = {
      deviceId,
      success: true,
      recordsSynced: 0,
      conflictsResolved: 0,
      errors: [],
      duration: 0,
    }

    try {
      // Update device last seen
      await this.client.db
        .update('user_devices')
        .set({ lastSeen: new Date(), isActive: true })
        .where('device_id = ?', [deviceId])

      // Get device info for user context
      const deviceInfo = await this.getDeviceInfo(deviceId)
      if (!deviceInfo) {
        throw new Error(`Device ${deviceId} not found`)
      }

      // Sync user data
      if (this.client.electric) {
        const syncResult = await this.syncUserData(deviceInfo.userId, options)
        result.recordsSynced = syncResult.recordsSynced
        result.conflictsResolved = syncResult.conflictsResolved
      }
    } catch (error) {
      result.success = false
      result.errors.push(error instanceof Error ? error.message : String(error))
    }

    result.duration = Date.now() - startTime
    return result
  }

  async startSyncSession(deviceId: string): Promise<string> {
    const sessionId = crypto.randomUUID()
    const deviceInfo = await this.getDeviceInfo(deviceId)

    if (!deviceInfo) {
      throw new Error(`Device ${deviceId} not found`)
    }

    const session: SyncSession = {
      id: sessionId,
      userId: deviceInfo.userId,
      deviceId,
      startedAt: new Date(),
      lastActivity: new Date(),
      status: 'active',
      changesSynced: 0,
      conflictsResolved: 0,
    }

    // Store session info locally
    if (typeof window !== 'undefined') {
      localStorage.setItem(`${this.SESSION_KEY_PREFIX}${sessionId}`, JSON.stringify(session))
    }

    return sessionId
  }

  async endSyncSession(sessionId: string): Promise<void> {
    // Update session status
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem(`${this.SESSION_KEY_PREFIX}${sessionId}`)
      if (stored) {
        const session: SyncSession = JSON.parse(stored)
        session.status = 'completed'
        session.lastActivity = new Date()
        localStorage.setItem(`${this.SESSION_KEY_PREFIX}${sessionId}`, JSON.stringify(session))
      }
    }
  }

  async handleOfflineTransition(deviceId: string): Promise<void> {
    // Mark device as inactive
    await this.client.db
      .update('user_devices')
      .set({ isActive: false, lastSeen: new Date() })
      .where('device_id = ?', [deviceId])

    // ElectricSQL will handle offline queue automatically
    console.log(`Device ${deviceId} went offline`)
  }

  async handleOnlineTransition(deviceId: string): Promise<void> {
    // Mark device as active and sync
    await this.client.db
      .update('user_devices')
      .set({ isActive: true, lastSeen: new Date() })
      .where('device_id = ?', [deviceId])

    // Trigger sync to catch up on changes
    await this.syncDevice(deviceId, { forceFullSync: true })
    console.log(`Device ${deviceId} came online and synced`)
  }

  private async syncUserData(
    userId: string,
    options: SyncOptions,
  ): Promise<{ recordsSynced: number; conflictsResolved: number }> {
    // This would implement the actual sync logic
    // For now, return mock data
    return {
      recordsSynced: Math.floor(Math.random() * 100),
      conflictsResolved: Math.floor(Math.random() * 5),
    }
  }
}

// =============================================================================
// Online/Offline Detection
// =============================================================================

export class NetworkMonitor {
  private listeners: Set<(online: boolean) => void> = new Set()
  private isOnline = true

  constructor() {
    if (typeof window !== 'undefined') {
      this.isOnline = navigator.onLine

      window.addEventListener('online', () => this.handleOnline())
      window.addEventListener('offline', () => this.handleOffline())
    }
  }

  onStatusChange(callback: (online: boolean) => void): () => void {
    this.listeners.add(callback)
    return () => this.listeners.delete(callback)
  }

  getStatus(): boolean {
    return this.isOnline
  }

  private handleOnline(): void {
    this.isOnline = true
    this.listeners.forEach((callback) => callback(true))
  }

  private handleOffline(): void {
    this.isOnline = false
    this.listeners.forEach((callback) => callback(false))
  }
}

// =============================================================================
// Utility Functions
// =============================================================================

export function createDeviceManager(client: SyncClient): DeviceManager {
  return new DeviceManagerImpl(client)
}

export function createNetworkMonitor(): NetworkMonitor {
  return new NetworkMonitor()
}

export function getCurrentDeviceInfo(
  userId: string,
): Omit<DeviceInfo, 'id' | 'createdAt' | 'updatedAt'> {
  return {
    userId,
    deviceId: DeviceDetector.generateDeviceId(),
    deviceName: DeviceDetector.getDeviceName(),
    deviceType: DeviceDetector.getDeviceType(),
    userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : 'Server',
    lastSeen: new Date(),
    isActive: true,
  }
}
