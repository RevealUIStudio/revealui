'use client';

import { useSession } from '@revealui/auth/react';
import {
  type LicenseTierId,
  type PricingResponse,
  TIER_COLORS,
  TIER_LABELS,
} from '@revealui/contracts/pricing';
import {
  ButtonCVA as Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@revealui/presentation';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useCallback, useEffect, useRef, useState } from 'react';
import { safeStripeRedirect } from '@/lib/utils/safe-stripe-redirect';

interface SubscriptionData {
  tier: LicenseTierId;
  status: string;
  expiresAt: string | null;
  graceUntil?: string | null;
}

interface UsageData {
  used: number;
  quota: number;
  overage: number;
  cycleStart: string;
  resetAt: string;
}

export default function BillingPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-[60vh] items-center justify-center">
          <p className="text-zinc-500">Loading...</p>
        </div>
      }
    >
      <BillingContent />
    </Suspense>
  );
}

function BillingContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const success = searchParams.get('success');
  const perpetual = searchParams.get('perpetual');
  const upgrade = searchParams.get('upgrade');
  const { data: session, isLoading: sessionLoading } = useSession();
  const [subscription, setSubscription] = useState<SubscriptionData | null>(null);
  const [usage, setUsage] = useState<UsageData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [upgradeSuccess, setUpgradeSuccess] = useState(false);
  const [pricing, setPricing] = useState<PricingResponse | null>(null);

  const apiUrl = (process.env.NEXT_PUBLIC_API_URL || 'https://api.revealui.com').trim();

  const getPrice = (tierId: string): string => {
    const t = pricing?.subscriptions.find((s) => s.id === tierId);
    if (!t?.price) return '—';
    return `${t.price}${t.period ?? ''}`;
  };

  const fetchSubscription = useCallback(async () => {
    try {
      const [subRes, usageRes, pricingRes] = await Promise.all([
        fetch(`${apiUrl}/api/billing/subscription`, { credentials: 'include' }),
        fetch(`${apiUrl}/api/billing/usage`, { credentials: 'include' }),
        fetch(`${apiUrl}/api/pricing`),
      ]);
      if (subRes.ok) {
        const data = (await subRes.json()) as SubscriptionData;
        setSubscription(data);
      }
      if (usageRes.ok) {
        const data = (await usageRes.json()) as UsageData;
        setUsage(data);
      }
      if (pricingRes.ok) {
        const data = (await pricingRes.json()) as PricingResponse;
        setPricing(data);
      }
    } catch {
      setError('Failed to load subscription data');
    } finally {
      setIsLoading(false);
    }
  }, [apiUrl]);

  useEffect(() => {
    if (!sessionLoading && session) {
      void fetchSubscription();
    } else if (!(sessionLoading || session)) {
      router.push('/login');
    }
  }, [session, sessionLoading, fetchSubscription, router]);

  const handleCheckout = useCallback(async () => {
    setActionLoading(true);
    setError(null);
    try {
      const res = await fetch(`${apiUrl}/api/billing/checkout`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          ...(process.env.NEXT_PUBLIC_STRIPE_PRO_PRICE_ID && {
            priceId: process.env.NEXT_PUBLIC_STRIPE_PRO_PRICE_ID,
          }),
          tier: 'pro',
        }),
      });
      const data = (await res.json()) as { url?: string; error?: string };
      if (data.url) {
        safeStripeRedirect(data.url);
      } else {
        setError(data.error || 'Failed to start checkout');
      }
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setActionLoading(false);
    }
  }, [apiUrl]);

  // Poll subscription status with exponential backoff after upgrades.
  // Retries up to 3 times (1s → 2s → 4s) to allow webhook processing.
  const pollTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pollSubscription = useCallback(
    (attempt = 0) => {
      const maxAttempts = 3;
      if (attempt >= maxAttempts) return;
      const delay = 1000 * 2 ** attempt; // 1s, 2s, 4s
      pollTimerRef.current = setTimeout(() => {
        void fetchSubscription().then(() => pollSubscription(attempt + 1));
      }, delay);
    },
    [fetchSubscription],
  );

  useEffect(() => {
    return () => {
      if (pollTimerRef.current) clearTimeout(pollTimerRef.current);
    };
  }, []);

  // Auto-redirect to checkout on signup with ?upgrade=pro
  useEffect(() => {
    if (upgrade === 'pro' && subscription?.tier === 'free' && !actionLoading) {
      void handleCheckout();
    }
  }, [upgrade, subscription, actionLoading, handleCheckout]);

  const handleUpgradeToMax = async () => {
    setActionLoading(true);
    setError(null);
    try {
      const res = await fetch(`${apiUrl}/api/billing/upgrade`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          ...(process.env.NEXT_PUBLIC_STRIPE_MAX_PRICE_ID && {
            priceId: process.env.NEXT_PUBLIC_STRIPE_MAX_PRICE_ID,
          }),
          targetTier: 'max',
        }),
      });
      const data = (await res.json()) as { success?: boolean; error?: string };
      if (data.success) {
        setUpgradeSuccess(true);
        pollSubscription();
      } else {
        setError(data.error || 'Failed to upgrade subscription');
      }
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleUpgradeToEnterprise = async () => {
    setActionLoading(true);
    setError(null);
    try {
      const res = await fetch(`${apiUrl}/api/billing/upgrade`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          ...(process.env.NEXT_PUBLIC_STRIPE_ENTERPRISE_PRICE_ID && {
            priceId: process.env.NEXT_PUBLIC_STRIPE_ENTERPRISE_PRICE_ID,
          }),
          targetTier: 'enterprise',
        }),
      });
      const data = (await res.json()) as { success?: boolean; error?: string };
      if (data.success) {
        setUpgradeSuccess(true);
        pollSubscription();
      } else {
        setError(data.error || 'Failed to upgrade subscription');
      }
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleManageBilling = async () => {
    setActionLoading(true);
    setError(null);
    try {
      const res = await fetch(`${apiUrl}/api/billing/portal`, {
        method: 'POST',
        credentials: 'include',
      });
      const data = (await res.json()) as { url?: string; error?: string };
      if (data.url) {
        safeStripeRedirect(data.url);
      } else {
        setError(data.error || 'Failed to open billing portal');
      }
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setActionLoading(false);
    }
  };

  if (sessionLoading || isLoading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <p className="text-zinc-500">Loading...</p>
      </div>
    );
  }

  const tier = subscription?.tier || 'free';

  return (
    <div className="mx-auto max-w-2xl space-y-6 py-12">
      <h1 className="text-2xl font-bold">Billing</h1>

      {subscription?.status === 'trialing' && subscription.expiresAt && (
        <div className="rounded-md border border-blue-200 bg-blue-50 p-4 text-sm text-blue-800 dark:border-blue-800 dark:bg-blue-900/20 dark:text-blue-300">
          Your Pro trial ends on{' '}
          <strong>
            {new Date(subscription.expiresAt).toLocaleDateString('en-US', {
              month: 'long',
              day: 'numeric',
              year: 'numeric',
            })}
          </strong>
          . After that, you&apos;ll be charged {getPrice('pro')}. Cancel anytime before then.
        </div>
      )}

      {subscription?.status === 'active' &&
        subscription.expiresAt &&
        new Date(subscription.expiresAt) > new Date() && (
          <div className="rounded-md border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800 dark:border-amber-800 dark:bg-amber-900/20 dark:text-amber-300">
            Your subscription will end on{' '}
            <strong>
              {new Date(subscription.expiresAt).toLocaleDateString('en-US', {
                month: 'long',
                day: 'numeric',
                year: 'numeric',
              })}
            </strong>
            . You&apos;ll retain access to {TIER_LABELS[tier]} features until then.
            <button
              type="button"
              onClick={handleManageBilling}
              disabled={actionLoading}
              className="ml-2 font-medium underline hover:text-amber-900 disabled:cursor-not-allowed dark:hover:text-amber-200"
            >
              Resubscribe
            </button>
          </div>
        )}

      {subscription?.status === 'expired' && (
        <div className="rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-800 dark:border-red-800 dark:bg-red-900/20 dark:text-red-300">
          Your subscription has expired. Pro features are no longer available.
          <button
            type="button"
            onClick={handleCheckout}
            disabled={actionLoading}
            className="ml-2 font-medium underline hover:text-red-900 dark:hover:text-red-200"
          >
            Resubscribe
          </button>
        </div>
      )}

      {subscription?.status === 'revoked' && (
        <div className="rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-800 dark:border-red-800 dark:bg-red-900/20 dark:text-red-300">
          Your subscription has been revoked due to a billing issue. Please contact{' '}
          <a
            href="mailto:support@revealui.com"
            className="font-medium underline hover:text-red-900 dark:hover:text-red-200"
          >
            support@revealui.com
          </a>{' '}
          or{' '}
          <button
            type="button"
            onClick={handleManageBilling}
            disabled={actionLoading}
            className="font-medium underline hover:text-red-900 dark:hover:text-red-200"
          >
            update your payment method
          </button>
          .
        </div>
      )}

      {subscription?.graceUntil &&
        (subscription.status === 'past_due' || subscription.status === 'grace_period') && (
          <div className="rounded-md border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800 dark:border-amber-800 dark:bg-amber-900/20 dark:text-amber-300">
            Your payment is past due. You have access until{' '}
            <strong>
              {new Date(subscription.graceUntil).toLocaleDateString('en-US', {
                month: 'long',
                day: 'numeric',
                year: 'numeric',
              })}
            </strong>
            . Please update your payment method to avoid losing access.
            <button
              type="button"
              onClick={handleManageBilling}
              disabled={actionLoading}
              className="ml-2 font-medium underline hover:text-amber-900 dark:hover:text-amber-200"
            >
              Update payment
            </button>
          </div>
        )}

      {perpetual && (
        <div className="rounded-md bg-green-50 p-4 text-sm text-green-700 dark:bg-green-900/20 dark:text-green-400">
          Perpetual license activated! Your Pro features are permanently unlocked. Your license
          includes 1 year of support and updates.{' '}
          <Link href="/account/license" className="font-medium underline hover:no-underline">
            View your license key &rarr;
          </Link>
        </div>
      )}

      {success && !perpetual && (
        <div className="rounded-md bg-green-50 p-4 text-sm text-green-700 dark:bg-green-900/20 dark:text-green-400">
          Subscription activated! Your Pro features are now available.
        </div>
      )}

      {upgradeSuccess && (
        <div className="rounded-md bg-indigo-50 p-4 text-sm text-indigo-700 dark:bg-indigo-900/20 dark:text-indigo-400">
          Upgraded! Your plan will update within a few seconds.
        </div>
      )}

      {error && (
        <div className="rounded-md bg-red-50 p-3 text-sm text-red-700 dark:bg-red-900/20 dark:text-red-400">
          {error}
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Current Plan</CardTitle>
          <CardDescription>Your account and subscription details.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-sm text-zinc-500">Plan</span>
            <span className={`rounded-full px-3 py-1 text-sm font-medium ${TIER_COLORS[tier]}`}>
              {TIER_LABELS[tier]}
            </span>
          </div>

          <div className="flex items-center justify-between">
            <span className="text-sm text-zinc-500">Status</span>
            <span
              className={`text-sm font-medium capitalize ${
                subscription?.status === 'active' || subscription?.status === 'trialing'
                  ? 'text-green-600 dark:text-green-400'
                  : subscription?.status === 'past_due' || subscription?.status === 'grace_period'
                    ? 'text-amber-600 dark:text-amber-400'
                    : subscription?.status === 'expired' || subscription?.status === 'revoked'
                      ? 'text-red-600 dark:text-red-400'
                      : ''
              }`}
            >
              {subscription?.status === 'past_due'
                ? 'Past Due'
                : subscription?.status === 'grace_period'
                  ? 'Grace Period'
                  : subscription?.status || 'active'}
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

          <div className="border-t pt-4 dark:border-zinc-800">
            {tier === 'free' && (
              <div className="space-y-3">
                <p className="text-sm text-zinc-500">
                  Upgrade to Pro for AI agents, advanced sync, built-in payments, and more.
                </p>
                <Button onClick={handleCheckout} disabled={actionLoading} className="w-full">
                  {actionLoading
                    ? 'Redirecting to checkout...'
                    : `Upgrade to Pro — ${getPrice('pro')}`}
                </Button>
                <p className="text-center text-xs text-zinc-400">Includes a 7-day free trial</p>
              </div>
            )}

            {tier === 'pro' && (
              <div className="space-y-3">
                <p className="text-sm text-zinc-500">
                  Upgrade to Max for AI memory, BYOK server-side, multi-provider AI, and higher
                  limits (15 projects, 100 users).
                </p>
                <Button
                  onClick={handleUpgradeToMax}
                  disabled={actionLoading || upgradeSuccess}
                  className="w-full"
                >
                  {actionLoading
                    ? 'Upgrading...'
                    : upgradeSuccess
                      ? 'Upgraded to Max'
                      : `Upgrade to Max — ${getPrice('max')}`}
                </Button>
                <Button
                  onClick={handleManageBilling}
                  disabled={actionLoading}
                  variant="outline"
                  className="w-full"
                >
                  {actionLoading ? 'Opening portal...' : 'Manage Billing'}
                </Button>
                <button
                  type="button"
                  onClick={handleManageBilling}
                  disabled={actionLoading}
                  title="Cancels at the end of your current billing period. You keep access until then."
                  className="w-full text-sm text-zinc-400 underline hover:text-zinc-600 disabled:cursor-not-allowed dark:text-zinc-500 dark:hover:text-zinc-300"
                >
                  Cancel subscription
                </button>
              </div>
            )}

            {tier === 'max' && (
              <div className="space-y-3">
                <p className="text-sm text-zinc-500">
                  Upgrade to Forge for unlimited projects and users, SSO, white-label branding,
                  multi-tenant isolation, and self-hosted deployment.
                </p>
                <Button
                  onClick={handleUpgradeToEnterprise}
                  disabled={actionLoading || upgradeSuccess}
                  className="w-full"
                >
                  {actionLoading
                    ? 'Upgrading...'
                    : upgradeSuccess
                      ? 'Upgraded to Forge'
                      : `Upgrade to Forge — ${getPrice('enterprise')}`}
                </Button>
                <Button
                  onClick={handleManageBilling}
                  disabled={actionLoading}
                  variant="outline"
                  className="w-full"
                >
                  {actionLoading ? 'Opening portal...' : 'Manage Billing'}
                </Button>
                <button
                  type="button"
                  onClick={handleManageBilling}
                  disabled={actionLoading}
                  title="Cancels at the end of your current billing period. You keep access until then."
                  className="w-full text-sm text-zinc-400 underline hover:text-zinc-600 disabled:cursor-not-allowed dark:text-zinc-500 dark:hover:text-zinc-300"
                >
                  Cancel subscription
                </button>
              </div>
            )}

            {tier === 'enterprise' && (
              <div className="space-y-3">
                <Button
                  onClick={handleManageBilling}
                  disabled={actionLoading}
                  variant="outline"
                  className="w-full"
                >
                  {actionLoading ? 'Opening portal...' : 'Manage Billing'}
                </Button>
                <button
                  type="button"
                  onClick={handleManageBilling}
                  disabled={actionLoading}
                  title="Cancels at the end of your current billing period. You keep access until then."
                  className="w-full text-sm text-zinc-400 underline hover:text-zinc-600 disabled:cursor-not-allowed dark:text-zinc-500 dark:hover:text-zinc-300"
                >
                  Cancel subscription
                </button>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {usage && (
        <Card>
          <CardHeader>
            <CardTitle>Agent Task Usage</CardTitle>
            <CardDescription>
              {usage.quota === -1
                ? 'Unlimited agent tasks (Forge tier).'
                : `${usage.quota.toLocaleString()} tasks included per month. Resets ${new Date(usage.resetAt).toLocaleDateString('en-US', { month: 'long', day: 'numeric' })}.`}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-end justify-between text-sm">
              <span className="font-medium">{usage.used.toLocaleString()} used</span>
              <span className="text-zinc-500">
                {usage.quota === -1 ? 'Unlimited' : `of ${usage.quota.toLocaleString()}`}
              </span>
            </div>
            {usage.quota !== -1 && (
              <div className="h-2 w-full overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-800">
                <div
                  className={`h-full rounded-full transition-all ${
                    usage.used / usage.quota > 0.9
                      ? 'bg-red-500'
                      : usage.used / usage.quota > 0.7
                        ? 'bg-amber-500'
                        : 'bg-blue-500'
                  }`}
                  style={{ width: `${Math.min((usage.used / usage.quota) * 100, 100)}%` }}
                />
              </div>
            )}
            {usage.overage > 0 && (
              <p className="text-xs text-amber-600 dark:text-amber-400">
                {usage.overage.toLocaleString()} tasks over quota this cycle.
              </p>
            )}
          </CardContent>
        </Card>
      )}

      {tier === 'free' && (
        <Card>
          <CardHeader>
            <CardTitle>What&apos;s Included in Pro</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2 text-sm text-zinc-600 dark:text-zinc-400">
              <li>Up to 5 projects and 25 users</li>
              <li>AI agent system (1 provider, BYOK client-side)</li>
              <li>MCP server integration</li>
              <li>Built-in Stripe payment processing</li>
              <li>Full real-time sync with conflict resolution</li>
              <li>Monitoring dashboard</li>
              <li>Custom domain mapping</li>
              <li>Analytics and conversion tracking</li>
              <li>10,000 agent tasks/month</li>
              <li>300 API requests/minute</li>
              <li>Email support (48-hour SLA)</li>
            </ul>
          </CardContent>
        </Card>
      )}

      {tier === 'pro' && (
        <Card>
          <CardHeader>
            <CardTitle>What&apos;s Included in Max</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2 text-sm text-zinc-600 dark:text-zinc-400">
              <li>Up to 15 projects and 100 users</li>
              <li>AI with 2 providers, BYOK server-side</li>
              <li>AI memory (working + episodic + vector)</li>
              <li>Audit log for all license + tier events</li>
              <li>50,000 agent tasks/month</li>
              <li>600 API requests/minute</li>
              <li>Priority support (24-hour SLA)</li>
            </ul>
          </CardContent>
        </Card>
      )}

      {tier === 'max' && (
        <Card>
          <CardHeader>
            <CardTitle>What&apos;s Included in Forge</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2 text-sm text-zinc-600 dark:text-zinc-400">
              <li>Unlimited projects and users</li>
              <li>All AI providers (Anthropic, OpenAI, Groq, Ollama)</li>
              <li>Full AI memory (semantic + procedural + episodic)</li>
              <li>SSO/SAML authentication</li>
              <li>White-label branding removal</li>
              <li>Multi-tenant isolation</li>
              <li>Domain-locked license enforcement</li>
              <li>Self-hosted deployment rights</li>
              <li>Unlimited agent tasks</li>
              <li>1,000 API requests/minute</li>
              <li>Priority support (4-hour SLA)</li>
              <li>Custom SLA and DPA available</li>
            </ul>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
