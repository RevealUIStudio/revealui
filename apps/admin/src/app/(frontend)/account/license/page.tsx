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
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  IconCheck,
  IconClose,
  Input,
} from '@revealui/presentation';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { type ChangeEvent, useCallback, useEffect, useState } from 'react';
import { apiFetch } from '@/lib/utils/csrf';
import { safeStripeRedirect } from '@/lib/utils/safe-stripe-redirect';

interface SubscriptionData {
  tier: LicenseTierId;
  status: string;
  expiresAt: string | null;
  licenseKey: string | null;
  perpetual: boolean;
  supportExpiresAt: string | null;
}

// Labels must match PERPETUAL_TIERS[*].name in @revealui/contracts/pricing —
// the price lookup below (`pricing?.perpetual.find((t) => t.name === plan.label)`)
// keys off that exact name.
const PERPETUAL_PLANS = [
  {
    label: 'Pro Perpetual',
    tier: 'pro' as const,
    priceIdEnv: process.env.NEXT_PUBLIC_STRIPE_PRO_PERPETUAL_PRICE_ID,
    description: 'Pro features forever. Includes 1 year of support.',
  },
  {
    label: 'Agency Perpetual',
    tier: 'max' as const,
    priceIdEnv: process.env.NEXT_PUBLIC_STRIPE_MAX_PERPETUAL_PRICE_ID,
    // GAP-448: Agency Founding Kit / Fleet perpetual — canon 10 client sites on the JWT.
    description: 'Max features forever, up to 10 client deployments. Includes 1 year of support.',
  },
  {
    label: 'Enterprise Perpetual',
    tier: 'enterprise' as const,
    priceIdEnv: process.env.NEXT_PUBLIC_STRIPE_ENTERPRISE_PERPETUAL_PRICE_ID,
    description: 'Enterprise features forever. Includes 1 year of support.',
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
  const [renewalLoading, setRenewalLoading] = useState(false);
  const [pricing, setPricing] = useState<PricingResponse | null>(null);
  const [githubUsername, setGithubUsername] = useState('');
  const [copied, setCopied] = useState(false);
  const [pubCopied, setPubCopied] = useState(false);
  // Vendor Ed25519 public key (PEM). The daemon needs it to verify a license;
  // without it a valid Pro license silently runs Free. Public material.
  const [publicKey, setPublicKey] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    try {
      const apiUrl = (process.env.NEXT_PUBLIC_API_URL || 'https://api.revealui.com').trim();

      const [subRes, featRes, pricingRes, pubKeyRes] = await Promise.all([
        fetch(`${apiUrl}/api/billing/subscription`, { credentials: 'include' }),
        fetch(`${apiUrl}/api/license/features`),
        fetch(`${apiUrl}/api/pricing`),
        fetch(`${apiUrl}/api/license/public-key`),
      ]);

      if (subRes.ok) {
        const data = (await subRes.json()) as SubscriptionData;
        setSubscription(data);
      }

      if (pubKeyRes.ok) {
        const data = (await pubKeyRes.json()) as { publicKey: string | null };
        setPublicKey(data.publicKey);
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
        <p className="text-zinc-600">Loading...</p>
      </div>
    );
  }

  const handlePerpetualCheckout = async (plan: (typeof PERPETUAL_PLANS)[number]) => {
    setPerpetualLoading(plan.tier);
    setError(null);
    try {
      const apiUrl = (process.env.NEXT_PUBLIC_API_URL || 'https://api.revealui.com').trim();
      const res = await apiFetch(`${apiUrl}/api/billing/checkout-perpetual`, {
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

  const handleSupportRenewal = async () => {
    setRenewalLoading(true);
    setError(null);
    try {
      const apiUrl = (process.env.NEXT_PUBLIC_API_URL || 'https://api.revealui.com').trim();
      const res = await apiFetch(`${apiUrl}/api/billing/checkout-support-renewal`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'content-type': 'application/json' },
      });
      const data = (await res.json()) as { url?: string; error?: string };
      if (data.url) {
        safeStripeRedirect(data.url);
      } else {
        setError(data.error || 'Failed to start renewal checkout. Please try again.');
      }
    } catch {
      setError('Failed to start renewal checkout. Please try again.');
    } finally {
      setRenewalLoading(false);
    }
  };

  const apiBase = (process.env.NEXT_PUBLIC_API_URL || 'https://api.revealui.com').trim();
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
            <span className="text-sm text-zinc-600">Plan</span>
            <span className={`rounded-full px-3 py-1 text-sm font-medium ${TIER_COLORS[tier]}`}>
              {TIER_LABELS[tier]}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-zinc-600">Status</span>
            <span className="text-sm font-medium capitalize">
              {subscription?.status ?? 'active'}
            </span>
          </div>
          {subscription?.expiresAt && (
            <div className="flex items-center justify-between">
              <span className="text-sm text-zinc-600">Expires</span>
              <span className="text-sm">
                {new Date(subscription.expiresAt).toLocaleDateString()}
              </span>
            </div>
          )}
          {subscription?.perpetual && (
            <div className="flex items-center justify-between">
              <span className="text-sm text-zinc-600">License Type</span>
              <span className="text-sm font-medium text-success">Perpetual</span>
            </div>
          )}
          {subscription?.perpetual && subscription.supportExpiresAt && (
            <div className="flex items-center justify-between">
              <span className="text-sm text-zinc-600">Support Expires</span>
              <span
                className={`text-sm font-medium ${
                  new Date(subscription.supportExpiresAt) < new Date()
                    ? 'text-red-600 dark:text-red-400'
                    : 'text-zinc-700 dark:text-zinc-300'
                }`}
              >
                {new Date(subscription.supportExpiresAt).toLocaleDateString()}
                {new Date(subscription.supportExpiresAt) < new Date() ? ' (expired)' : ''}
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
              <Button
                type="button"
                size="sm"
                variant="neutral"
                appearance="outline"
                onClick={() => {
                  void navigator.clipboard.writeText(subscription.licenseKey ?? '');
                  setCopied(true);
                  setTimeout(() => setCopied(false), 2000);
                }}
                className="absolute right-2 top-2 h-auto px-2 py-1 text-xs shadow-sm"
              >
                {copied ? 'Copied!' : 'Copy'}
              </Button>
            </div>
            <div className="rounded-lg border p-3 dark:border-zinc-800">
              <p className="text-xs font-medium text-zinc-600 uppercase tracking-wide mb-2">
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
                <p className="mt-3">
                  The same key activates the RevDev daemon — one purchase, one license, both
                  products. Set it as{' '}
                  <code className="rounded bg-zinc-100 px-1 py-0.5 text-xs dark:bg-zinc-900">
                    REVEALUI_LICENSE_KEY
                  </code>
                  :
                </p>
                <pre className="overflow-x-auto rounded-lg bg-zinc-100 p-2 text-xs font-mono dark:bg-zinc-900">
                  REVEALUI_LICENSE_KEY=your-key-here
                </pre>
              </div>
            </div>
            <div className="rounded-lg border p-3 dark:border-zinc-800">
              <p className="text-xs font-medium text-zinc-600 uppercase tracking-wide mb-2">
                Automatic key renewal
              </p>
              <div className="space-y-1.5 text-sm text-zinc-600 dark:text-zinc-400">
                <p>
                  Your subscription key is re-issued on your billing cycle. A running instance can
                  pull its current key at any time from the refresh endpoint, so a renewed key
                  reaches your deployment without a manual copy. Run this from the instance that
                  holds the key:
                </p>
                <pre className="overflow-x-auto rounded-lg bg-zinc-100 p-2 text-xs font-mono dark:bg-zinc-900">
                  {`curl -X POST ${apiBase}/api/license/refresh \\
  -H 'content-type: application/json' \\
  -d "{\\"licenseKey\\":\\"$REVEALUI_LICENSE_KEY\\"}"`}
                </pre>
                <p className="text-xs text-zinc-400 mt-2">
                  The endpoint returns your current key and never issues a new one. If your key is
                  older than the renewal window, copy the key above from this page instead.
                </p>
              </div>
            </div>
            {publicKey && (
              <div className="rounded-lg border p-3 dark:border-zinc-800">
                <p className="text-xs font-medium text-zinc-600 uppercase tracking-wide mb-2">
                  Daemon public key
                </p>
                <div className="space-y-1.5 text-sm text-zinc-600 dark:text-zinc-400">
                  <p>
                    The RevDev daemon can also verify your license against the vendor public key.
                    Set it as{' '}
                    <code className="rounded bg-zinc-100 px-1 py-0.5 text-xs dark:bg-zinc-900">
                      REVDEV_LICENSE_PUBLIC_KEY
                    </code>
                    :
                  </p>
                  <div className="relative">
                    <pre className="overflow-x-auto rounded-lg bg-zinc-100 p-3 text-xs font-mono text-zinc-800 dark:bg-zinc-900 dark:text-zinc-300">
                      {publicKey}
                    </pre>
                    <Button
                      type="button"
                      size="sm"
                      variant="neutral"
                      appearance="outline"
                      onClick={() => {
                        void navigator.clipboard.writeText(publicKey);
                        setPubCopied(true);
                        setTimeout(() => setPubCopied(false), 2000);
                      }}
                      className="absolute right-2 top-2 h-auto px-2 py-1 text-xs shadow-sm"
                    >
                      {pubCopied ? 'Copied!' : 'Copy'}
                    </Button>
                  </div>
                  <p className="text-xs text-zinc-400 mt-2">
                    Newer daemon builds bake this key in, so this step is only needed for older
                    builds or after a key rotation.
                  </p>
                </div>
              </div>
            )}
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
            <span className="text-sm text-zinc-600">Sites</span>
            <span className="text-sm font-medium">
              {limits.sites === null ? 'Unlimited' : limits.sites}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-zinc-600">Users per site</span>
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
              Own your license forever. One-time payment - no subscription required. Includes 1 year
              of support with optional annual renewals.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-3 rounded-lg border p-3 dark:border-zinc-800">
              <p className="text-xs font-medium text-zinc-600 uppercase tracking-wide">
                Optional - for package access
              </p>
              <div className="space-y-2">
                <div className="flex flex-col gap-1">
                  <label htmlFor="github-username" className="text-sm font-medium">
                    GitHub username
                  </label>
                  <Input
                    id="github-username"
                    type="text"
                    placeholder="your-github-handle"
                    value={githubUsername}
                    onChange={(
                      e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>,
                    ) => setGithubUsername(e.target.value)}
                  />
                  <span className="text-xs text-zinc-600">
                    Added to the revealui-pro GitHub team for private package access.
                  </span>
                </div>
              </div>
            </div>
            {PERPETUAL_PLANS.map((plan) => (
              <div
                key={plan.tier}
                className="flex items-center justify-between rounded-lg border p-3 dark:border-zinc-800"
              >
                <div>
                  <p className="text-sm font-medium">{plan.label}</p>
                  <p className="text-xs text-zinc-600">{plan.description}</p>
                </div>
                <Button
                  type="button"
                  variant="neutral"
                  size="sm"
                  disabled={perpetualLoading === plan.tier}
                  onClick={() => void handlePerpetualCheckout(plan)}
                  className="ml-4 shrink-0 bg-zinc-900 text-white hover:bg-zinc-700 dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-200"
                >
                  {perpetualLoading === plan.tier
                    ? 'Redirecting…'
                    : `Buy ${pricing?.perpetual.find((t) => t.name === plan.label)?.price ?? '—'}`}
                </Button>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Support renewal for perpetual license holders */}
      {subscription?.perpetual && (
        <Card>
          <CardHeader>
            <CardTitle>Support Renewal</CardTitle>
            <CardDescription>
              Your perpetual license never expires. Renew annual support for continued updates,
              priority assistance, and access to new features.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {subscription.supportExpiresAt && (
              <div className="flex items-center justify-between">
                <span className="text-sm text-zinc-600">Support status</span>
                <span
                  className={`rounded-full px-3 py-1 text-xs font-medium ${
                    new Date(subscription.supportExpiresAt) < new Date()
                      ? 'bg-red-100 text-red-700 dark:bg-red-900/20 dark:text-red-400'
                      : 'bg-success/15 text-success'
                  }`}
                >
                  {new Date(subscription.supportExpiresAt) < new Date() ? 'Expired' : 'Active'}
                </span>
              </div>
            )}
            <Button
              type="button"
              variant="neutral"
              disabled={renewalLoading}
              onClick={() => void handleSupportRenewal()}
              className="w-full bg-zinc-900 text-white hover:bg-zinc-700 dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-200"
            >
              {renewalLoading ? 'Redirecting…' : 'Renew Support  -  1 Year'}
            </Button>
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
                      <IconCheck size="sm" className="text-green-500" />
                    ) : (
                      <IconClose size="sm" className="text-zinc-300 dark:text-zinc-600" />
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
