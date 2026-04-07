'use client';

import { createContext, use, useEffect, useState } from 'react';
import type { Paywall } from '../core/paywall.js';
import type { FeatureFlags } from '../core/types.js';

/** The value exposed by the paywall context. */
export interface PaywallContextValue {
  /** The current tier (e.g. 'free', 'pro'). */
  tier: string;
  /** Boolean map of feature flags for the current tier. `null` while loading. */
  features: FeatureFlags<string> | null;
  /** True while the initial tier resolution is in flight. */
  isLoading: boolean;
  /** Re-fetch the tier (e.g. after a subscription change). */
  refetch: () => Promise<void>;
  /** The paywall instance for direct access. */
  paywall: Paywall;
}

const PaywallContext = createContext<PaywallContextValue | null>(null);

/** Props for the PaywallProvider component. */
export interface PaywallProviderProps {
  /** A paywall instance from `createPaywall()`. */
  paywall: Paywall;
  /**
   * Async function that resolves the current user's tier.
   * Called once on mount and again on `refetch()`.
   *
   * @example
   * ```ts
   * resolveTier={async () => {
   *   const res = await fetch('/api/billing/subscription', { credentials: 'include' });
   *   if (!res.ok) return 'free';
   *   const data = await res.json();
   *   return data.tier;
   * }}
   * ```
   */
  resolveTier: () => Promise<string>;
  children: React.ReactNode;
}

/**
 * React context provider that resolves the current tier and computes
 * feature flags from a paywall instance.
 *
 * Wrap your app (or a subtree) with this provider, then use `usePaywall()`
 * in any child component to read `{ tier, features, isLoading }`.
 */
export function PaywallProvider({ paywall, resolveTier, children }: PaywallProviderProps) {
  const [tier, setTier] = useState<string>(paywall.defaultTier);
  const [features, setFeatures] = useState<FeatureFlags<string> | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  async function fetchTier() {
    try {
      setIsLoading(true);
      const resolved = await resolveTier();
      setTier(resolved);
      setFeatures(paywall.getFeaturesForTier(resolved));
    } catch {
      // Fall back to default (free) tier on any error
      setTier(paywall.defaultTier);
      setFeatures(paywall.getFeaturesForTier(paywall.defaultTier));
    } finally {
      setIsLoading(false);
    }
  }

  // biome-ignore lint/correctness/useExhaustiveDependencies: intentional — fetch once on mount
  useEffect(() => {
    void fetchTier();
  }, []);

  return (
    <PaywallContext value={{ tier, features, isLoading, refetch: fetchTier, paywall }}>
      {children}
    </PaywallContext>
  );
}

/**
 * Hook to read the current paywall state.
 *
 * Must be used within a `<PaywallProvider>`.
 *
 * @returns `{ tier, features, isLoading, refetch, paywall }`
 *
 * @example
 * ```tsx
 * function SettingsPage() {
 *   const { tier, features, isLoading } = usePaywall();
 *   if (isLoading) return <Spinner />;
 *   if (!features?.ai) return <UpgradePrompt />;
 *   return <AISettings />;
 * }
 * ```
 */
export function usePaywall(): PaywallContextValue {
  const ctx = use(PaywallContext);
  if (!ctx) {
    throw new Error('usePaywall must be used within a <PaywallProvider>');
  }
  return ctx;
}
