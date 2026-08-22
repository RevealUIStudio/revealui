'use client';

import type { LicenseTierId } from '@revealui/contracts/pricing';
import type { FeatureFlags } from '@revealui/core/features';
import { createPaywall } from '@revealui/paywall';
import { PaywallProvider, usePaywall } from '@revealui/paywall/client';
import { hasSessionCookie } from '@/lib/auth/has-session-cookie';
import { isPreAuthPublicPath, redirectToLogin } from '@/lib/auth/redirect-to-login';

/** Shared paywall instance for the admin. */
const paywall = createPaywall();

/**
 * Why tier resolution failed. Surfaces must never invent a FREE plan when this
 * is set (GAP-454): a 401 is re-auth, not free; a network/5xx is unknown.
 */
export type LicenseResolveError = 'auth-required' | 'unavailable' | null;

/** The value exposed by the license context (backwards-compatible shape). */
export interface LicenseContextValue {
  tier: LicenseTierId;
  features: FeatureFlags | null;
  isLoading: boolean;
  /**
   * Non-null when the tier fetch did not succeed. FreeTierBanner and other
   * money-adjacent UI must treat this as "do not claim free".
   */
  resolveError: LicenseResolveError;
  refetch: () => Promise<void>;
}

/**
 * Thrown from resolveSaasTier so PaywallProvider does not invent free.
 * The paywall provider maps this to resolveError + null features.
 */
export class LicenseResolveFailure extends Error {
  readonly kind: 'auth-required' | 'unavailable';

  constructor(kind: 'auth-required' | 'unavailable', message: string) {
    super(message);
    this.name = 'LicenseResolveFailure';
    this.kind = kind;
  }
}

export async function resolveSaasTier(): Promise<string> {
  // Login / MFA / signup have no full session yet. Do not probe subscription
  // (401 would bounce /mfa → /login — owner GAP-360 walk).
  if (typeof window !== 'undefined' && isPreAuthPublicPath(window.location.pathname)) {
    throw new LicenseResolveFailure('auth-required', 'pre-auth public path; skip license probe');
  }

  const apiUrl = process.env.NEXT_PUBLIC_API_URL?.trim();
  if (!apiUrl) {
    // No SaaS API configured  -  genuine free/local posture.
    return 'free';
  }

  let res: Response;
  try {
    res = await fetch(`${apiUrl}/api/billing/subscription`, {
      credentials: 'include',
    });
  } catch {
    throw new LicenseResolveFailure('unavailable', 'subscription fetch failed (network)');
  }

  if (res.status === 401) {
    // Cross-origin 401 is "API session unavailable", not "admin signed out",
    // when the browser still holds revealui-session. Bouncing to /login here
    // plus the proxy's old search-strip dumped owners onto `/`.
    if (hasSessionCookie()) {
      throw new LicenseResolveFailure(
        'unavailable',
        'subscription returned 401 with session cookie',
      );
    }
    // Dead session: send the operator to re-auth. Do not claim free.
    // redirectToLogin itself no-ops on /mfa etc. as a second belt.
    redirectToLogin();
    throw new LicenseResolveFailure('auth-required', 'subscription returned 401');
  }

  if (!res.ok) {
    throw new LicenseResolveFailure('unavailable', `subscription returned ${res.status}`);
  }

  const data = (await res.json()) as { tier: LicenseTierId };
  return data.tier;
}

interface LicenseProviderProps {
  children: React.ReactNode;
  isFleetMode?: boolean;
}

export function LicenseProvider({ children, isFleetMode = false }: LicenseProviderProps) {
  const resolveTier = isFleetMode ? () => Promise.resolve('enterprise') : resolveSaasTier;
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
  const { tier, features, isLoading, refetch, resolveError } = usePaywall();
  return {
    tier: tier as LicenseTierId,
    features: features as FeatureFlags | null,
    isLoading,
    resolveError: (resolveError as LicenseResolveError) ?? null,
    refetch,
  };
}
