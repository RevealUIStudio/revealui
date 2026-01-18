/**
 * ElectricProvider
 *
 * React context provider for ElectricSQL client.
 * Provides real-time sync capabilities to React components.
 */

'use client'

import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react'
import { createElectricClient } from '../client/index.js'
import type { ElectricClient } from '../client/index.js'

interface ElectricProviderProps {
  children: ReactNode
  serviceUrl?: string
  debug?: boolean
}

interface ElectricContextValue {
  client: ElectricClient | null
  isConnected: boolean
  error: string | null
}

const ElectricContext = createContext<ElectricContextValue>({
  client: null,
  isConnected: false,
  error: null,
})

export function ElectricProvider({
  children,
  serviceUrl,
  debug = false
}: ElectricProviderProps) {
  const [client, setClient] = useState<ElectricClient | null>(null)
  const [isConnected, setIsConnected] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const initClient = async () => {
      try {
        const electricClient = createElectricClient({
          serviceUrl: serviceUrl || process.env.NEXT_PUBLIC_ELECTRIC_URL || 'http://localhost:5133',
          debug,
        })

        await electricClient.connect()
        setClient(electricClient)
        setIsConnected(true)
        setError(null)

        if (debug) {
          console.log('ElectricSQL client connected')
        }
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Failed to connect to ElectricSQL'
        setError(errorMessage)
        setIsConnected(false)

        if (debug) {
          console.error('ElectricSQL connection failed:', err)
        }
      }
    }

    initClient()

    return () => {
      if (client) {
        client.disconnect().catch(console.error)
      }
    }
  }, [serviceUrl, debug])

  const contextValue: ElectricContextValue = {
    client,
    isConnected,
    error,
  }

  return (
    <ElectricContext.Provider value={contextValue}>
      {children}
    </ElectricContext.Provider>
  )
}

export function useElectric(): ElectricContextValue {
  const context = useContext(ElectricContext)
  return context
}