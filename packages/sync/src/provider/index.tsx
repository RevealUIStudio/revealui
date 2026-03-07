'use client'

import { createContext, type ReactNode, useContext, useMemo } from 'react'

interface ElectricContextValue {
  serviceUrl: string | null
  proxyBaseUrl: string
  debug: boolean
}

const ElectricContext = createContext<ElectricContextValue>({
  serviceUrl: null,
  proxyBaseUrl: '',
  debug: false,
})

/**
 * Provides ElectricSQL configuration to child hooks (`useConversations`, `useCollabDocument`).
 *
 * Currently a passthrough context — children render normally. When ElectricSQL
 * integration is completed, this provider will establish a shared sync connection.
 */
export function ElectricProvider(props: {
  children: ReactNode
  serviceUrl?: string
  proxyBaseUrl?: string
  debug?: boolean
}): ReactNode {
  const value = useMemo(
    () => ({
      serviceUrl: props.serviceUrl ?? null,
      proxyBaseUrl: props.proxyBaseUrl ?? '',
      debug: props.debug ?? false,
    }),
    [props.serviceUrl, props.proxyBaseUrl, props.debug],
  )

  return <ElectricContext value={value}>{props.children}</ElectricContext>
}

/**
 * Access the ElectricSQL configuration provided by `ElectricProvider`.
 * Returns `{ serviceUrl: null, debug: false }` if no provider is present.
 */
export function useElectricConfig(): ElectricContextValue {
  return useContext(ElectricContext)
}
