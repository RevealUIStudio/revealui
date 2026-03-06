'use client'

import type { ReactNode } from 'react'

/**
 * @experimental This provider is a passthrough — ElectricSQL integration is not yet implemented.
 * Children are rendered without any sync functionality.
 */
export function ElectricProvider({
  children,
}: {
  children: ReactNode
  serviceUrl?: string
  debug?: boolean
}) {
  // For now, just pass through children
  // useShape hooks work directly with proxy API endpoints
  return <>{children}</>
}
