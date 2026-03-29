'use client';

import { useSession } from '@revealui/auth/react';
import {
  FEATURE_LABELS,
  type LicenseTierId,
  type PricingResponse,
  TIER_COLORS,
  TIER_LABELS,
  TIER_LIMITS,
} from '@revealui/contracts/pricing';
import type { FeatureFlags } from '@revealui/core/features';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@revealui/presentation/server';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { safeStripeRedirect } from '@/lib/utils/safe-stripe-redirect';

interface SubscriptionData {
  tier: LicenseTierId;
  status: string;
  expiresAt: string | null;
  licenseKey: string | null;
}

const PERPETUAL_PLANS = [
  {
    label: 'Pro Perpetual',
    tier: 'pro' as const,
    priceIdEnv: process.env.NEXT_PUBLIC_STRIPE_PERPETUAL_PRO_PRICE_ID,
    description: 'Pro features forever. Includes 1 year of support.',
  },
  {
    label: 'Max Perpetual',
    tier: 'max' as const,
    priceIdEnv: process.env.NEXT_PUBLIC_STRIPE_PERPETUAL_MAX_PRICE_ID,
    description: 'Max features forever. Includes 1 year of support.',
  },
] as const;

export default function LicensePage() {
  const router = useRouter();
  const { data: session, isLoading: sessionLoading } = useSession();
  const [subscription, setSubscription] = useState<SubscriptionData | null>(null);
  const [features, setFeatures] = useState<Record<string, FeatureFlags> | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [perpetualLoading, setPerpetualLoading] = useState<string | null>(null);
  const [pricing, setPricing] = useState<PricingResponse | null>(null);
  const [githubUsername, setGithubUsername] = useState('');
  const [copied, setCopied] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      const apiUrl = (process.env.NEXT_PUBLIC_API_URL || 'https://api.revealui.com').trim();

      const [subRes, featRes, pricingRes] = await Promise.all([
        fetch(`${apiUrl}/api/billing/subscription`, { credentials: 'include' }),
        fetch(`${apiUrl}/api/license/features`),
        fetch(`${apiUrl}/api/pricing`),
      ]);

      if (subRes.ok) {
        const data = (await subRes.json()) as SubscriptionData;
        setSubscription(data);
      }

      if (featRes.ok) {
        const data = (await featRes.json()) as Record<string, FeatureFlags>;
        setFeatures(data);
      }

      if (pricingRes.ok) {
        const data = (await pricingRes.json()) as PricingResponse;
        setPricing(data);
      }
    } catch {
      setError('Failed to load license data');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!sessionLoading && session) {
      void fetchData();
    } else if (!(sessionLoading || session)) {
      router.push('/login');
    }
  }, [session, sessionLoading, fetchData, router]);

  if (sessionLoading || isLoading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <p className="text-zinc-500">Loading...</p>
      </div>
    );
  }

  const handlePerpetualCheckout = async (plan: (typeof PERPETUAL_PLANS)[number]) => {
    setPerpetualLoading(plan.tier);
    setError(null);
    try {
      const apiUrl = (process.env.NEXT_PUBLIC_API_URL || 'https://api.revealui.com').trim();
      const res = await fetch(`${apiUrl}/api/billing/checkout-perpetual`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          ...(plan.priceIdEnv && { priceId: plan.priceIdEnv }),
          tier: plan.tier,
          ...(githubUsername.trim() && { githubUsername: githubUsername.trim() }),
        }),
      });
      const data = (await res.json()) as { url?: string; error?: string };
      if (data.url) {
        safeStripeRedirect(data.url);
      } else {
        setError(data.error || 'Failed to start checkout. Please try again.');
      }
    } catch {
      setError('Failed to start checkout. Please try again.');
    } finally {
      setPerpetualLoading(null);
    }
  };

  const tier = subscription?.tier ?? 'free';
  const limits = TIER_LIMITS[tier];
  const tierFeatures = features?.[tier];
  const canUpgrade = tier === 'free' || tier === 'pro';

  return (
    <div className="mx-auto max-w-2xl space-y-6 py-12">
      <h1 className="text-2xl font-bold">License & Plan</h1>

      {error && (
        <div className="rounded-md bg-red-50 p-3 text-sm text-red-700 dark:bg-red-900/20 dark:text-red-400">
          {error}
        </div>
      )}

      {/* Current plan */}
      <Card>
        <CardHeader>
          <CardTitle>Current Plan</CardTitle>
          <CardDescription>Your active license and subscription status.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm text-zinc-500">Plan</span>
            <span className={`rounded-full px-3 py-1 text-sm font-medium ${TIER_COLORS[tier]}`}>
              {TIER_LABELS[tier]}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-zinc-500">Status</span>
            <span className="text-sm font-medium capitalize">
              {subscription?.status ?? 'active'}
            </span>
          </div>
          {subscription?.expiresAt && (
            <div className="flex items-center justify-between">
              <span className="text-sm text-zinc-500">Expires</span>
              <span className="text-sm">
                {new Date(subscription.expiresAt).toLocaleDateString()}
              </span>
            </div>
          )}
          {canUpgrade && (
            <div className="border-t pt-3 dark:border-zinc-800">
              <Link
                href="/account/billing"
                className="text-sm font-medium text-blue-600 hover:underline dark:text-blue-400"
              >
                {tier === 'free' ? 'Upgrade to Pro →' : 'Upgrade to Enterprise →'}
              </Link>
            </div>
          )}
        </CardContent>
      </Card>

      {/* License key */}
      {subscription?.licenseKey && (
        <Card>
          <CardHeader>
            <CardTitle>License Key</CardTitle>
            <CardDescription>
              Use this key to activate RevealUI Pro features in your self-hosted deployments.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="relative">
              <pre className="overflow-x-auto rounded-lg bg-zinc-100 p-3 text-xs font-mono text-zinc-800 dark:bg-zinc-900 dark:text-zinc-300">
                {subscription.licenseKey}
              </pre>
              <button
                type="button"
                onClick={() => {
                  void navigator.clipboard.writeText(subscription.licenseKey!);
                  setCopied(true);
                  setTimeout(() => setCopied(false), 2000);
                }}
                className="absolute right-2 top-2 rounded-md bg-white px-2 py-1 text-xs font-medium text-zinc-600 shadow-sm hover:bg-zinc-50 dark:bg-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-700"
              >
                {copied ? 'Copied!' : 'Copy'}
              </button>
            </div>
            <div className="rounded-lg border p-3 dark:border-zinc-800">
              <p className="text-xs font-medium text-zinc-500 uppercase tracking-wide mb-2">
                Activation
              </p>
              <div className="space-y-1.5 text-sm text-zinc-600 dark:text-zinc-400">
                <p>
                  Add to your project&apos;s{' '}
                  <code className="rounded bg-zinc-100 px-1 py-0.5 text-xs dark:bg-zinc-900">
                    .env
                  </code>{' '}
                  file:
                </p>
                <pre className="overflow-x-auto rounded-lg bg-zinc-100 p-2 text-xs font-mono dark:bg-zinc-900">
                  REVEALUI_LICENSE_KEY=your-key-here
                </pre>
                <p className="text-xs text-zinc-400 mt-2">
                  Or pass it programmatically via{' '}
                  <code className="rounded bg-zinc-100 px-1 py-0.5 dark:bg-zinc-900">
                    initializeLicense(key)
                  </code>{' '}
                  at startup.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Resource limits */}
      <Card>
        <CardHeader>
          <CardTitle>Resource Limits</CardTitle>
          <CardDescription>Usage limits for your current plan.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm text-zinc-500">Sites</span>
            <span className="text-sm font-medium">
              {limits.sites === null ? 'Unlimited' : limits.sites}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-zinc-500">Users per site</span>
            <span className="text-sm font-medium">
              {limits.users === null ? 'Unlimited' : limits.users}
            </span>
          </div>
        </CardContent>
      </Card>

      {/* Perpetual license */}
      {canUpgrade && (
        <Card>
          <CardHeader>
            <CardTitle>Perpetual License</CardTitle>
            <CardDescription>
              Own your license forever. One-time payment — no subscription required. Includes 1 year
              of support with optional annual renewals.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-3 rounded-lg border p-3 dark:border-zinc-800">
              <p className="text-xs font-medium text-zinc-500 uppercase tracking-wide">
                Optional — for package access
              </p>
              <div className="space-y-2">
                <label className="flex flex-col gap-1">
                  <span className="text-sm font-medium">GitHub username</span>
                  <input
                    type="text"
                    placeholder="your-github-handle"
                    value={githubUsername}
                    onChange={(e) => setGithubUsername(e.target.value)}
                    className="rounded-md border px-3 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-900"
                  />
                  <span className="text-xs text-zinc-500">
                    Added to the revealui-pro GitHub team for private package access.
                  </span>
                </label>
              </div>
            </div>
            {PERPETUAL_PLANS.map((plan) => (
              <div
                key={plan.tier}
                className="flex items-center justify-between rounded-lg border p-3 dark:border-zinc-800"
              >
                <div>
                  <p className="text-sm font-medium">{plan.label}</p>
                  <p className="text-xs text-zinc-500">{plan.description}</p>
                </div>
                <button
                  type="button"
                  disabled={perpetualLoading === plan.tier}
                  onClick={() => void handlePerpetualCheckout(plan)}
                  className="shrink-0 ml-4 rounded-md bg-zinc-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-zinc-700 disabled:opacity-50 dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-200"
                >
                  {perpetualLoading === plan.tier
                    ? 'Redirecting…'
                    : `Buy ${pricing?.perpetual.find((t) => t.name === plan.label)?.price ?? '—'}`}
                </button>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Feature access matrix */}
      <Card>
        <CardHeader>
          <CardTitle>Feature Access</CardTitle>
          <CardDescription>Features enabled on your current plan.</CardDescription>
        </CardHeader>
        <CardContent>
          <ul className="space-y-2">
            {(Object.entries(FEATURE_LABELS) as [keyof FeatureFlags, string][]).map(
              ([key, label]) => {
                const enabled = tierFeatures?.[key] ?? false;
                return (
                  <li key={key} className="flex items-center gap-3 text-sm">
                    {enabled ? (
                      <CheckIcon className="text-green-500" />
                    ) : (
                      <XIcon className="text-zinc-300 dark:text-zinc-600" />
                    )}
                    <span className={enabled ? '' : 'text-zinc-400'}>{label}</span>
                  </li>
                );
              },
            )}
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}

function CheckIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={`shrink-0 ${className ?? ''}`}
      aria-hidden="true"
    >
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

function XIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={`shrink-0 ${className ?? ''}`}
      aria-hidden="true"
    >
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  );
}
