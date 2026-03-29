'use client';

import {
  FEATURE_LABELS,
  type LicenseTierId,
  SUBSCRIPTION_TIERS,
  TIER_LIMITS,
} from '@revealui/contracts/pricing';
import type { FeatureFlags } from '@revealui/core/features';
import { PricingTable } from '@revealui/presentation/client';
import { useLicense } from '@/lib/providers/LicenseProvider';
import { safeStripeRedirect } from '@/lib/utils/safe-stripe-redirect';

export default function UpgradePage() {
  const { tier: currentTier } = useLicense();

  const handleSelectTier = async (tierId: string) => {
    try {
      const apiUrl = (process.env.NEXT_PUBLIC_API_URL || 'https://api.revealui.com').trim();

      // Verify session before initiating checkout — redirect to login if expired
      const meRes = await fetch('/api/auth/me', { credentials: 'include' });
      if (!meRes.ok) {
        window.location.href = '/login?redirect=/admin/upgrade';
        return;
      }

      const res = await fetch(`${apiUrl}/api/billing/checkout`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          priceId:
            tierId === 'pro'
              ? process.env.NEXT_PUBLIC_STRIPE_PRO_PRICE_ID
              : tierId === 'max'
                ? process.env.NEXT_PUBLIC_STRIPE_MAX_PRICE_ID
                : process.env.NEXT_PUBLIC_STRIPE_ENTERPRISE_PRICE_ID,
          tier: tierId,
        }),
      });

      if (res.status === 401) {
        window.location.href = '/login?redirect=/admin/upgrade';
        return;
      }

      const data = (await res.json()) as { url?: string };
      if (data.url) {
        safeStripeRedirect(data.url);
      }
    } catch {
      window.location.href = `/account/billing?upgrade=${tierId}`;
    }
  };

  return (
    <div className="mx-auto max-w-7xl px-6 py-12 lg:px-8">
      <div className="text-center mb-12">
        <h1 className="text-3xl font-bold tracking-tight text-zinc-900 dark:text-white sm:text-4xl">
          Choose Your Plan
        </h1>
        <p className="mt-4 text-lg text-zinc-600 dark:text-zinc-400">
          Upgrade to unlock more features, higher limits, and priority support.
        </p>
      </div>

      <PricingTable
        tiers={SUBSCRIPTION_TIERS}
        currentTier={currentTier}
        onSelectTier={(id: string) => void handleSelectTier(id)}
      />

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
                      t.id === currentTier ? 'text-emerald-600' : 'text-zinc-900 dark:text-white'
                    }`}
                  >
                    {t.name}
                    {t.id === currentTier && (
                      <span className="block text-xs text-emerald-500">Current</span>
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
                      {limits.agentTasks === null
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
                      const enabled = isFeatureInTier(key, t.id);
                      return (
                        <td key={t.id} className="py-3 px-4 text-center">
                          {enabled ? (
                            <span className="text-emerald-600" role="img" aria-label="Included">
                              &#10003;
                            </span>
                          ) : (
                            <span
                              className="text-zinc-300 dark:text-zinc-700"
                              role="img"
                              aria-label="Not included"
                            >
                              &mdash;
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

/** Simple tier rank check — mirrors @revealui/core/features logic */
function isFeatureInTier(feature: keyof FeatureFlags, tier: LicenseTierId): boolean {
  const tierRank: Record<LicenseTierId, number> = {
    free: 0,
    pro: 1,
    max: 2,
    enterprise: 3,
  };
  const featureMinTier: Record<keyof FeatureFlags, LicenseTierId> = {
    aiLocal: 'free',
    ai: 'pro',
    aiSampling: 'free',
    mcp: 'pro',
    payments: 'pro',
    advancedSync: 'pro',
    dashboard: 'pro',
    customDomain: 'pro',
    analytics: 'pro',
    aiMemory: 'max',
    byokServerSide: 'max',
    aiMultiProvider: 'max',
    auditLog: 'max',
    multiTenant: 'enterprise',
    whiteLabel: 'enterprise',
    sso: 'enterprise',
  };
  return tierRank[tier] >= tierRank[featureMinTier[feature]];
}
