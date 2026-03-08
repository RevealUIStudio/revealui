'use client'

import type { LicenseTierId } from '@revealui/contracts/pricing'
import type { FeatureFlags } from '@revealui/core/features'
import { createContext, useCallback, useContext, useEffect, useState } from 'react'

interface LicenseContextValue {
  tier: LicenseTierId
  features: FeatureFlags | null
  isLoading: boolean
  refetch: () => Promise<void>
}

const LicenseContext = createContext<LicenseContextValue>({
  tier: 'free',
  features: null,
  isLoading: true,
  // biome-ignore lint/suspicious/noEmptyBlockStatements: intentional no-op default for context consumers that don't need refetch
  refetch: async () => {},
})

export function LicenseProvider({ children }: { children: React.ReactNode }) {
  const [tier, setTier] = useState<LicenseTierId>('free')
  const [features, setFeatures] = useState<FeatureFlags | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  const fetchLicense = useCallback(async () => {
    try {
      setIsLoading(true)

      const apiUrl = (process.env.NEXT_PUBLIC_API_URL || 'https://api.revealui.com').trim()

      // Fetch subscription status
      const subRes = await fetch(`${apiUrl}/api/billing/subscription`, { credentials: 'include' })
      if (subRes.ok) {
        const data = (await subRes.json()) as { tier: LicenseTierId }
        setTier(data.tier)

        // Fetch feature flags using the freshly-resolved tier (not stale state)
        const featRes = await fetch(`${apiUrl}/api/license/features`)
        if (featRes.ok) {
          const featData = (await featRes.json()) as Record<string, FeatureFlags>
          setFeatures(featData[data.tier] ?? null)
        }
      }
    } catch {
      // Silently fall back to free tier
    } finally {
      setIsLoading(false)
    }
  }, [])

  // biome-ignore lint/correctness/useExhaustiveDependencies: intentional — fetch once on mount, not when tier changes
  useEffect(() => {
    void fetchLicense()
  }, [])

  return (
    <LicenseContext.Provider value={{ tier, features, isLoading, refetch: fetchLicense }}>
      {children}
    </LicenseContext.Provider>
  )
}

export function useLicense(): LicenseContextValue {
  return useContext(LicenseContext)
}
