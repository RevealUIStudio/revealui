'use client';

import type { FeatureFlags } from '@revealui/core/features';
import type React from 'react';
import { useLicense } from '@/lib/providers/LicenseProvider';
import { UpgradePrompt } from '../../components/UpgradePrompt';

interface LicenseGateProps {
  /** Feature flag that must be enabled to show children */
  feature: keyof FeatureFlags;
  children: React.ReactNode;
  /** 'inline' shows UpgradePrompt below; 'dialog' blurs children with upgrade overlay */
  mode?: 'inline' | 'dialog';
}

/**
 * Client-side license gate. Renders children when the feature is enabled,
 * otherwise shows an UpgradePrompt. Shows a spinner while the license is loading.
 *
 * `mode='dialog'`: renders children behind a blurred overlay with the upgrade
 * prompt on top — lets users preview the locked feature.
 *
 * Note: this is a UX layer only — API-level enforcement happens in the API middleware.
 */
export function LicenseGate({ feature, children, mode = 'inline' }: LicenseGateProps) {
  const { features, isLoading } = useLicense();

  if (isLoading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <div
          className="h-5 w-5 animate-spin rounded-full border-2 border-zinc-300 border-t-zinc-700 dark:border-zinc-600 dark:border-t-zinc-200"
          aria-hidden="true"
        />
      </div>
    );
  }

  const enabled = features?.[feature] ?? false;

  if (!enabled) {
    if (mode === 'dialog') {
      return (
        <div className="relative">
          <div className="pointer-events-none select-none blur-sm" aria-hidden="true">
            {children}
          </div>
          <div className="absolute inset-0 flex items-start justify-center pt-12 bg-white/60 dark:bg-zinc-950/60">
            <div className="max-w-lg w-full">
              <UpgradePrompt feature={feature} />
            </div>
          </div>
        </div>
      );
    }

    return (
      <div className="p-6">
        <UpgradePrompt feature={feature} />
      </div>
    );
  }

  return <>{children}</>;
}
