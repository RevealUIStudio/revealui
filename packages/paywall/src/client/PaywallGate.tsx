'use client';

import type React from 'react';
import { usePaywall } from './PaywallProvider.js';

/** Props for the PaywallGate component. */
export interface PaywallGateProps {
  /** The feature key that must be enabled to show children. */
  feature: string;
  /** Content to render when the feature is enabled. */
  children: React.ReactNode;
  /**
   * Content to render when the feature is NOT enabled.
   * Receives the feature name and required tier for building upgrade UIs.
   *
   * @default null (renders nothing when denied)
   *
   * @example
   * ```tsx
   * <PaywallGate
   *   feature="ai"
   *   fallback={<UpgradeCard feature="ai" />}
   * >
   *   <AIPanel />
   * </PaywallGate>
   * ```
   */
  fallback?: React.ReactNode;
  /**
   * Content to render while the license is loading.
   *
   * @default null (renders nothing while loading)
   */
  loading?: React.ReactNode;
}

/**
 * Declarative feature gate component.
 *
 * Renders `children` when the feature is enabled for the current tier,
 * `fallback` when denied, and `loading` while the tier is being resolved.
 *
 * This is a UX-only soft gate. Server-side middleware is the authoritative
 * enforcement layer.
 *
 * @example
 * ```tsx
 * <PaywallGate
 *   feature="ai"
 *   fallback={<p>Upgrade to Pro to unlock AI</p>}
 *   loading={<Spinner />}
 * >
 *   <AIPanel />
 * </PaywallGate>
 * ```
 */
export function PaywallGate({
  feature,
  children,
  fallback = null,
  loading = null,
}: PaywallGateProps) {
  const { features, isLoading } = usePaywall();

  if (isLoading) {
    return <>{loading}</>;
  }

  const enabled = features?.[feature] ?? false;

  if (!enabled) {
    return <>{fallback}</>;
  }

  return <>{children}</>;
}
