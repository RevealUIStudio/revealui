'use client';

import {
  ENTERPRISE_SALES_HREF,
  FEATURE_LABELS,
  getTiersFromCurrent,
  type LicenseTierId,
  type PricingResponse,
  SUBSCRIPTION_TIERS,
  TIER_LABELS,
  TIER_LIMITS,
} from '@revealui/contracts/pricing';
import { type FeatureFlags, getFeaturesForTier } from '@revealui/core/features';
import { PricingTable } from '@revealui/presentation/client';
import { useEffect, useState } from 'react';
import { TestModeBanner } from '@/components/TestModeBanner';
import { hasCommercialUpgradePath } from '@/lib/components/should-show-upgrade-nav';
import { useLicense } from '@/lib/providers/LicenseProvider';
import { apiFetch } from '@/lib/utils/csrf';
import { mergeLicenseSubscriptionPrices } from '@/lib/utils/license-subscription-prices';
import { safeStripeRedirect } from '@/lib/utils/safe-stripe-redirect';
import { subscriptionCheckoutBody } from '@/lib/utils/subscription-checkout';

function adminApiOrigin(): string {
  return (process.env.NEXT_PUBLIC_API_URL || 'https://api.revealui.com').trim();
}

export default function UpgradePage() {
  const { tier: currentTier } = useLicense();
  const [error, setError] = useState<string | null>(null);
  const [catalog, setCatalog] = useState<PricingResponse | null>(null);
  const tierId = (currentTier ?? 'free') as LicenseTierId;
  const canUpgrade = hasCommercialUpgradePath(tierId);
  const selectableTiers = canUpgrade ? getTiersFromCurrent(tierId) : [];
  const pricedTiers = mergeLicenseSubscriptionPrices(
    selectableTiers.length > 0 ? selectableTiers : SUBSCRIPTION_TIERS,
    catalog,
  );

  useEffect(() => {
    const apiUrl = adminApiOrigin();
    let cancelled = false;
    fetch(`${apiUrl}/api/pricing`)
      .then((res) => (res.ok ? (res.json() as Promise<PricingResponse>) : null))
      .then((data) => {
        if (!cancelled && data) setCatalog(data);
      })
      .catch(() => {
        // Fallbacks already render the licenses catalog prices.
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const handleSelectTier = async (nextTierId: string) => {
    if (nextTierId === 'enterprise') {
      window.location.assign(ENTERPRISE_SALES_HREF);
      return;
    }
    setError(null);
    try {
      const apiUrl = adminApiOrigin();

      // Verify session before initiating checkout  -  redirect to login if expired
      const meRes = await fetch('/api/auth/me', { credentials: 'include' });
      if (!meRes.ok) {
        window.location.href = '/login?redirect=/upgrade';
        return;
      }

      if (nextTierId !== 'pro' && nextTierId !== 'max') {
        window.location.href = `/account/billing?upgrade=${nextTierId}`;
        return;
      }
      const res = await apiFetch(`${apiUrl}/api/billing/checkout`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(subscriptionCheckoutBody(nextTierId)),
      });

      if (res.status === 401) {
        window.location.href = '/login?redirect=/upgrade';
        return;
      }

      const data = (await res.json()) as { url?: string; error?: string };
      if (data.url) {
        safeStripeRedirect(data.url);
      } else {
        setError(data.error || 'Failed to start checkout. Please try again.');
      }
    } catch {
      window.location.href = `/account/billing?upgrade=${nextTierId}`;
    }
  };

  return (
    <div className="mx-auto max-w-7xl px-6 py-12 lg:px-8">
      <div className="text-center mb-12">
        <h1 className="text-3xl font-bold tracking-tight text-zinc-900 dark:text-white sm:text-4xl">
          {canUpgrade ? 'Choose Your Plan' : 'Your Plan'}
        </h1>
        <p className="mt-4 text-lg text-zinc-600 dark:text-zinc-400">
          {canUpgrade
            ? 'Upgrade to unlock more features, higher limits, and priority support.'
            : `You are on ${TIER_LABELS[tierId]}. There is no higher commercial plan to upgrade into.`}
        </p>
      </div>

      <div className="mx-auto max-w-2xl mb-8">
        <TestModeBanner />
      </div>

      {error && (
        <div className="mx-auto max-w-2xl mb-8 rounded-md bg-red-50 p-4 text-sm text-red-700 dark:bg-red-900/20 dark:text-red-400">
          {error}
        </div>
      )}

      {canUpgrade ? (
        <PricingTable
          tiers={pricedTiers}
          currentTier={currentTier}
          onSelectTier={(id: string) => void handleSelectTier(id)}
        />
      ) : (
        <div className="mx-auto max-w-2xl rounded-lg border border-border bg-card p-6 text-center text-sm text-muted-foreground">
          Manage invoices and payment methods from{' '}
          <a href="/account/billing" className="font-medium text-primary hover:underline">
            account billing
          </a>
          .
        </div>
      )}

      {/* Feature comparison matrix */}
      <div className="mt-16">
        <h2 className="text-2xl font-bold text-zinc-900 dark:text-white text-center mb-8">
          Feature Comparison
        </h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b dark:border-zinc-800">
                <th className="py-3 px-4 text-left font-medium text-zinc-500">Feature</th>
                {SUBSCRIPTION_TIERS.map((t) => (
                  <th
                    key={t.id}
                    className={`py-3 px-4 text-center font-medium ${
                      t.id === currentTier ? 'text-success' : 'text-zinc-900 dark:text-white'
                    }`}
                  >
                    {t.name}
                    {t.id === currentTier && (
                      <span className="block text-xs text-success">Current</span>
                    )}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {/* Limits */}
              <tr className="border-b dark:border-zinc-800">
                <td className="py-3 px-4 font-medium text-zinc-700 dark:text-zinc-300">Sites</td>
                {SUBSCRIPTION_TIERS.map((t) => {
                  const limits = TIER_LIMITS[t.id];
                  return (
                    <td
                      key={t.id}
                      className="py-3 px-4 text-center text-zinc-600 dark:text-zinc-400"
                    >
                      {limits.sites === null ? 'Unlimited' : limits.sites}
                    </td>
                  );
                })}
              </tr>
              <tr className="border-b dark:border-zinc-800">
                <td className="py-3 px-4 font-medium text-zinc-700 dark:text-zinc-300">Users</td>
                {SUBSCRIPTION_TIERS.map((t) => {
                  const limits = TIER_LIMITS[t.id];
                  return (
                    <td
                      key={t.id}
                      className="py-3 px-4 text-center text-zinc-600 dark:text-zinc-400"
                    >
                      {limits.users === null ? 'Unlimited' : limits.users}
                    </td>
                  );
                })}
              </tr>
              <tr className="border-b dark:border-zinc-800">
                <td className="py-3 px-4 font-medium text-zinc-700 dark:text-zinc-300">
                  Agent Tasks/mo
                </td>
                {SUBSCRIPTION_TIERS.map((t) => {
                  const limits = TIER_LIMITS[t.id];
                  return (
                    <td
                      key={t.id}
                      className="py-3 px-4 text-center text-zinc-600 dark:text-zinc-400"
                    >
                      {t.id === 'free'
                        ? 'Not included'
                        : limits.agentTasks === null
                          ? 'Unlimited'
                          : limits.agentTasks.toLocaleString()}
                    </td>
                  );
                })}
              </tr>
              <tr className="border-b dark:border-zinc-800">
                <td className="py-3 px-4 font-medium text-zinc-700 dark:text-zinc-300">
                  API Requests/min
                </td>
                {SUBSCRIPTION_TIERS.map((t) => {
                  const limits = TIER_LIMITS[t.id];
                  return (
                    <td
                      key={t.id}
                      className="py-3 px-4 text-center text-zinc-600 dark:text-zinc-400"
                    >
                      {limits.apiRequestsPerMinute.toLocaleString()}
                    </td>
                  );
                })}
              </tr>

              {/* Feature flags */}
              {(Object.entries(FEATURE_LABELS) as [keyof FeatureFlags, string][]).map(
                ([key, label]) => (
                  <tr key={key} className="border-b dark:border-zinc-800">
                    <td className="py-3 px-4 font-medium text-zinc-700 dark:text-zinc-300">
                      {label}
                    </td>
                    {SUBSCRIPTION_TIERS.map((t) => {
                      const enabled = getFeaturesForTier(t.id)[key];
                      return (
                        <td key={t.id} className="py-3 px-4 text-center">
                          {enabled ? (
                            <span className="text-success" role="img" aria-label="Included">
                              &#10003;
                            </span>
                          ) : (
                            <span
                              className="text-zinc-300 dark:text-zinc-700"
                              role="img"
                              aria-label="Not included"
                            >
                              -
                            </span>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ),
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
