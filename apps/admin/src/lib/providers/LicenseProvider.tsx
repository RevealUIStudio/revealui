'use client';

import type { LicenseTierId } from '@revealui/contracts/pricing';
import type { FeatureFlags } from '@revealui/core/features';
import { createPaywall } from '@revealui/paywall';
import { PaywallProvider, usePaywall } from '@revealui/paywall/client';

/** Shared paywall instance for the admin. */
const paywall = createPaywall();

/** The value exposed by the license context (backwards-compatible shape). */
export interface LicenseContextValue {
  tier: LicenseTierId;
  features: FeatureFlags | null;
  isLoading: boolean;
  refetch: () => Promise<void>;
}

async function resolveTier(): Promise<string> {
  // Skip if API URL is not configured — prevents CORS errors in local dev
  // and avoids calling the production API from self-hosted instances.
  const apiUrl = process.env.NEXT_PUBLIC_API_URL?.trim();
  if (!apiUrl) return 'free';

  try {
    const res = await fetch(`${apiUrl}/api/billing/subscription`, {
      credentials: 'include',
    });
    if (res.ok) {
      const data = (await res.json()) as { tier: LicenseTierId };
      return data.tier;
    }
  } catch {
    // Subscription check failed (CORS, network, 401) — stay on free tier
  }

  return 'free';
}

export function LicenseProvider({ children }: { children: React.ReactNode }) {
  return (
    <PaywallProvider paywall={paywall} resolveTier={resolveTier}>
      {children}
    </PaywallProvider>
  );
}

/**
 * Hook to read the current license state.
 *
 * Thin wrapper around `usePaywall()` that preserves the admin's
 * `LicenseContextValue` shape for backwards compatibility.
 */
export function useLicense(): LicenseContextValue {
  const { tier, features, isLoading, refetch } = usePaywall();
  return {
    tier: tier as LicenseTierId,
    features: features as FeatureFlags | null,
    isLoading,
    refetch,
  };
}
