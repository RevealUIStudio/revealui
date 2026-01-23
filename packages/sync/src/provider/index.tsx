/**
 * SyncProvider
 *
 * React context provider for sync client.
 * Provides database access and sync services for real-time features.
 */

'use client'

import { createContext, type ReactNode, useContext, useEffect, useState } from 'react'
import type { SyncClient } from '../client/index.js'
import { createSyncClient } from '../client/index.js'

interface SyncProviderProps {
  children: ReactNode
  /** Database type to use */
  databaseType?: 'rest' | 'vector'
  /** Enable debug logging */
  debug?: boolean
  /** Auto-connect on mount */
  autoConnect?: boolean
}

interface SyncContextValue {
  client: SyncClient | null
  isConnected: boolean
  error: string | null
  connect: () => Promise<void>
  disconnect: () => Promise<void>
}

const SyncContext = createContext<SyncContextValue>({
  client: null,
  isConnected: false,
  error: null,
  connect: async () => {},
  disconnect: async () => {},
})

export function SyncProvider({
  children,
  databaseType = 'rest',
  debug = process.env.NODE_ENV === 'development',
  autoConnect = true,
}: SyncProviderProps) {
  const [client] = useState(() =>
    createSyncClient({
      databaseType,
      debug,
    }),
  )
  const [isConnected, setIsConnected] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isInitialized, setIsInitialized] = useState(false)

  const connect = async () => {
    if (isConnected) return

    try {
      setError(null)
      await client.connect()
      setIsConnected(true)

      if (debug) {
        // Debug logging for development
        // Connection success logging removed for production
        // console.log('Sync client connected successfully')
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to connect to database'
      setError(errorMessage)
      setIsConnected(false)
      throw err
    }
  }

  const disconnect = async () => {
    if (!isConnected) return

    try {
      await client.disconnect()
      setIsConnected(false)
      setError(null)

      if (debug) {
        // Disconnect logging removed for production
        // console.log('Sync client disconnected')
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to disconnect from database'
      setError(errorMessage)
      // Disconnect error logging removed for production
      // console.error('Sync disconnect error:', err)
      // Don't throw - ensure state is updated
      setIsConnected(false)
    }
  }

  useEffect(() => {
    if (autoConnect && !isInitialized) {
      setIsInitialized(true)
      connect().catch((err) => {
        // Auto-connect failure logging removed for production
        // console.error('Auto-connect failed:', err)
      })
    }

    // Cleanup on unmount
    return () => {
      if (isConnected) {
        // Disconnect error handling removed for production
        // disconnect().catch(console.error)
      }
    }
  }, [autoConnect, connect, disconnect, isConnected, isInitialized])

  const contextValue: SyncContextValue = {
    client,
    isConnected,
    error,
    connect,
    disconnect,
  }

  return <SyncContext.Provider value={contextValue}>{children}</SyncContext.Provider>
}

export function useSync(): SyncContextValue {
  const context = useContext(SyncContext)
  if (!context) {
    throw new Error('useSync must be used within a SyncProvider')
  }
  return context
}

// Legacy alias for backward compatibility
export const ElectricProvider = SyncProvider
export const useElectric = useSync
