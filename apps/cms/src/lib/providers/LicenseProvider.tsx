'use client'

import type { FeatureFlags } from '@revealui/core/features'
import { createContext, useCallback, useContext, useEffect, useState } from 'react'

interface LicenseContextValue {
  tier: 'free' | 'pro' | 'enterprise'
  features: FeatureFlags | null
  isLoading: boolean
  refetch: () => Promise<void>
}

const LicenseContext = createContext<LicenseContextValue>({
  tier: 'free',
  features: null,
  isLoading: true,
  refetch: async () => {},
})

export function LicenseProvider({ children }: { children: React.ReactNode }) {
  const [tier, setTier] = useState<'free' | 'pro' | 'enterprise'>('free')
  const [features, setFeatures] = useState<FeatureFlags | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  const fetchLicense = useCallback(async () => {
    try {
      setIsLoading(true)

      // Fetch subscription status
      const subRes = await fetch('/api/billing/subscription', { credentials: 'include' })
      if (subRes.ok) {
        const data = (await subRes.json()) as { tier: 'free' | 'pro' | 'enterprise' }
        setTier(data.tier)
      }

      // Fetch feature flags for this tier
      const featRes = await fetch('/api/license/features')
      if (featRes.ok) {
        const data = (await featRes.json()) as Record<string, FeatureFlags>
        const currentTier = tier
        setFeatures(data[currentTier] ?? null)
      }
    } catch {
      // Silently fall back to free tier
    } finally {
      setIsLoading(false)
    }
  }, [tier])

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
