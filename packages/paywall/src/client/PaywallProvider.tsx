'use client';

import { createContext, use, useEffect, useState } from 'react';
import type { Paywall } from '../core/paywall.js';
import type { FeatureFlags } from '../core/types.js';

/** Why tier resolution failed (GAP-454 class: never invent free on failure). */
export type PaywallResolveError = 'auth-required' | 'unavailable' | null;

/** The value exposed by the paywall context. */
export interface PaywallContextValue {
  /** The current tier (e.g. 'free', 'pro'). */
  tier: string;
  /** Boolean map of feature flags for the current tier. `null` while loading or on error. */
  features: FeatureFlags<string> | null;
  /** True while the initial tier resolution is in flight. */
  isLoading: boolean;
  /**
   * Set when resolveTier failed. Consumers must not treat `tier` as a verified
   * plan while this is non-null (default tier may still be the SSR placeholder).
   */
  resolveError: PaywallResolveError;
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
   * Throw an Error with `kind: 'auth-required' | 'unavailable'` (or name
   * `LicenseResolveFailure` / message containing those tokens) so the provider
   * does not invent a free tier on failure.
   *
   * @example
   * ```ts
   * resolveTier={async () => {
   *   const res = await fetch('/api/billing/subscription', { credentials: 'include' });
   *   if (res.status === 401) throw Object.assign(new Error('auth'), { kind: 'auth-required' });
   *   if (!res.ok) throw Object.assign(new Error('unavailable'), { kind: 'unavailable' });
   *   const data = await res.json();
   *   return data.tier;
   * }}
   * ```
   */
  resolveTier: () => Promise<string>;
  children: React.ReactNode;
}

function classifyResolveError(err: unknown): Exclude<PaywallResolveError, null> {
  if (err && typeof err === 'object') {
    const kind = (err as { kind?: string }).kind;
    if (kind === 'auth-required' || kind === 'unavailable') return kind;
    const name = (err as { name?: string }).name;
    if (name === 'LicenseResolveFailure') {
      const k = (err as { kind?: string }).kind;
      if (k === 'auth-required' || k === 'unavailable') return k;
    }
    const message = String((err as { message?: string }).message ?? '');
    if (message.includes('auth-required') || message.includes('401')) return 'auth-required';
  }
  return 'unavailable';
}

/**
 * React context provider that resolves the current tier and computes
 * feature flags from a paywall instance.
 *
 * Wrap your app (or a subtree) with this provider, then use `usePaywall()`
 * in any child component to read `{ tier, features, isLoading, resolveError }`.
 */
export function PaywallProvider({ paywall, resolveTier, children }: PaywallProviderProps) {
  const [tier, setTier] = useState<string>(paywall.defaultTier);
  const [features, setFeatures] = useState<FeatureFlags<string> | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [resolveError, setResolveError] = useState<PaywallResolveError>(null);

  async function fetchTier() {
    try {
      setIsLoading(true);
      setResolveError(null);
      const resolved = await resolveTier();
      setTier(resolved);
      setFeatures(paywall.getFeaturesForTier(resolved));
      setResolveError(null);
    } catch (err) {
      // GAP-454: do NOT invent free on failure. Keep SSR placeholder tier but
      // mark features null and surface resolveError for consumers.
      const classified = classifyResolveError(err);
      setResolveError(classified);
      setFeatures(null);
    } finally {
      setIsLoading(false);
    }
  }

  // biome-ignore lint/correctness/useExhaustiveDependencies: intentional  -  fetch once on mount
  useEffect(() => {
    void fetchTier();
  }, []);

  return (
    <PaywallContext
      value={{ tier, features, isLoading, resolveError, refetch: fetchTier, paywall }}
    >
      {children}
    </PaywallContext>
  );
}

/**
 * Hook to read the current paywall state.
 *
 * Must be used within a `<PaywallProvider>`.
 *
 * @returns `{ tier, features, isLoading, resolveError, refetch, paywall }`
 *
 * @example
 * ```tsx
 * function SettingsPage() {
 *   const { tier, features, isLoading, resolveError } = usePaywall();
 *   if (isLoading) return <Spinner />;
 *   if (resolveError) return <UnavailableOrReauth />;
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
