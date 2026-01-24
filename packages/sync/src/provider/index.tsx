'use client'

import type { ReactNode } from 'react'

// ElectricProvider placeholder - useShape works with proxy API
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
