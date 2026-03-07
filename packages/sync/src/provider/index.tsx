'use client'

import type { ReactNode } from 'react'

/**
 * @experimental This provider is a passthrough — ElectricSQL integration is not yet implemented.
 * Children are rendered without any sync functionality.
 */
export function ElectricProvider(_props: {
  children: ReactNode
  serviceUrl?: string
  debug?: boolean
}): never {
  throw new Error(
    '@revealui/sync is not yet implemented. See https://revealui.com/roadmap for status.',
  )
}
