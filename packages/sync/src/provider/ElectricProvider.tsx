/**
 * ElectricProvider Component (New System - HTTP-based)
 *
 * React context provider for ElectricSQL client configuration.
 * Wraps the app and provides ElectricSQL configuration to all child components.
 *
 * Note: The new system uses HTTP-based shapes, so this provider just
 * supplies configuration. The actual data fetching is done via useShape hooks.
 */

'use client'

import type { ReactNode } from 'react'
import { createContext, useContext, useMemo } from 'react'
import {
  createElectricClientConfig,
  type ElectricClientConfig,
  getElectricServiceUrl,
} from '../client'

// =============================================================================
// Context
// =============================================================================

const ElectricContext = createContext<ElectricClientConfig | null>(null)

// =============================================================================
// Provider Props
// =============================================================================

export interface ElectricProviderProps {
  /** Child components */
  children: ReactNode
  /** ElectricSQL service URL */
  serviceUrl?: string
  /** Authentication token */
  authToken?: string
  /** Debug mode */
  debug?: boolean
}

// =============================================================================
// Provider Component
// =============================================================================

/**
 * ElectricSQL provider component.
 * Provides ElectricSQL client configuration to all child components.
 *
 * @example
 * ```tsx
 * import { ElectricProvider } from '@revealui/sync/provider'
 *
 * function App() {
 *   return (
 *     <ElectricProvider serviceUrl="http://localhost:5133">
 *       <YourApp />
 *     </ElectricProvider>
 *   )
 * }
 * ```
 */
export function ElectricProvider({
  children,
  serviceUrl: providedServiceUrl,
  authToken,
  debug = false,
}: ElectricProviderProps) {
  // Get service URL from props or environment
  const serviceUrl = providedServiceUrl || getElectricServiceUrl()

  // Create client config
  const config = useMemo(() => {
    if (!serviceUrl) {
      if (debug) {
        console.warn(
          '[ElectricProvider] No service URL provided. ElectricSQL will not be available.',
        )
      }
      return null
    }

    try {
      return createElectricClientConfig({
        serviceUrl,
        authToken,
        debug,
      })
    } catch (error) {
      if (debug) {
        console.error('[ElectricProvider] Failed to create client config:', error)
      }
      return null
    }
  }, [serviceUrl, authToken, debug])

  return <ElectricContext.Provider value={config}>{children}</ElectricContext.Provider>
}

// =============================================================================
// useElectric Hook
// =============================================================================

/**
 * Hook to access ElectricSQL client configuration.
 *
 * @returns ElectricSQL client configuration
 *
 * @example
 * ```tsx
 * import { useElectric } from '@revealui/sync/provider'
 *
 * function MyComponent() {
 *   const config = useElectric()
 *   // Use config.serviceUrl, config.authToken, etc.
 * }
 * ```
 */
export function useElectric(): ElectricClientConfig {
  const config = useContext(ElectricContext)

  if (!config) {
    throw new Error(
      'useElectric must be used within an ElectricProvider. ' +
        'Make sure your app is wrapped with <ElectricProvider>. ' +
        'Also ensure ELECTRIC_SERVICE_URL or NEXT_PUBLIC_ELECTRIC_SERVICE_URL is set.',
    )
  }

  return config
}
