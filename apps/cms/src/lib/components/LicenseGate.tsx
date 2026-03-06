'use client'

import type { FeatureFlags } from '@revealui/core/features'
import type React from 'react'
import { useLicense } from '@/lib/providers/LicenseProvider'
import { UpgradePrompt } from './UpgradePrompt'

interface LicenseGateProps {
  /** Feature flag that must be enabled to show children */
  feature: keyof FeatureFlags
  children: React.ReactNode
}

/**
 * Client-side license gate. Renders children when the feature is enabled,
 * otherwise shows an UpgradePrompt. Shows a spinner while the license is loading.
 *
 * Note: this is a UX layer only — API-level enforcement happens in the API middleware.
 */
export function LicenseGate({ feature, children }: LicenseGateProps) {
  const { features, isLoading } = useLicense()

  if (isLoading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <div className="h-5 w-5 animate-spin rounded-full border-2 border-zinc-300 border-t-zinc-700 dark:border-zinc-600 dark:border-t-zinc-200" />
      </div>
    )
  }

  const enabled = features?.[feature] ?? false

  if (!enabled) {
    return (
      <div className="p-6">
        <UpgradePrompt feature={feature} />
      </div>
    )
  }

  return <>{children}</>
}
