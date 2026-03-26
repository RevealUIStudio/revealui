'use client';

import type { LicenseTierId } from '@revealui/contracts/pricing';
import type { FeatureFlags } from '@revealui/core/features';
import { createContext, use, useCallback, useEffect, useState } from 'react';

interface LicenseContextValue {
  tier: LicenseTierId;
  features: FeatureFlags | null;
  isLoading: boolean;
  refetch: () => Promise<void>;
}

const LicenseContext = createContext<LicenseContextValue>({
  tier: 'free',
  features: null,
  isLoading: true,
  // biome-ignore lint/suspicious/noEmptyBlockStatements: intentional no-op default for context consumers that don't need refetch
  refetch: async () => {},
});

export function LicenseProvider({ children }: { children: React.ReactNode }) {
  const [tier, setTier] = useState<LicenseTierId>('free');
  const [features, setFeatures] = useState<FeatureFlags | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const fetchLicense = useCallback(async () => {
    // Skip if API URL is not configured — prevents CORS errors in local dev
    // and avoids calling the production API from self-hosted instances.
    const apiUrl = process.env.NEXT_PUBLIC_API_URL?.trim();
    if (!apiUrl) {
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);

      // Resolve the current tier from subscription (defaults to 'free' on failure)
      let resolvedTier: LicenseTierId = 'free';
      try {
        const subRes = await fetch(`${apiUrl}/api/billing/subscription`, {
          credentials: 'include',
        });
        if (subRes.ok) {
          const data = (await subRes.json()) as { tier: LicenseTierId };
          resolvedTier = data.tier;
        }
      } catch {
        // Subscription check failed (CORS, network, 401) — stay on free tier
      }

      setTier(resolvedTier);

      // Always fetch feature flags so the gate can evaluate correctly
      const featRes = await fetch(`${apiUrl}/api/license/features`);
      if (featRes.ok) {
        const featData = (await featRes.json()) as Record<string, FeatureFlags>;
        setFeatures(featData[resolvedTier] ?? null);
      }
    } catch {
      // Silently fall back to free tier
    } finally {
      setIsLoading(false);
    }
  }, []);

  // biome-ignore lint/correctness/useExhaustiveDependencies: intentional — fetch once on mount, not when tier changes
  useEffect(() => {
    void fetchLicense();
  }, []);

  return (
    <LicenseContext.Provider value={{ tier, features, isLoading, refetch: fetchLicense }}>
      {children}
    </LicenseContext.Provider>
  );
}

export function useLicense(): LicenseContextValue {
  return use(LicenseContext);
}
