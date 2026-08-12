'use client';

import { useSession } from '@revealui/auth/react';
import {
  type LicenseTierId,
  type PricingResponse,
  TIER_COLORS,
  TIER_LABELS,
} from '@revealui/contracts/pricing';
import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@revealui/presentation';
import { logger } from '@revealui/utils/logger';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useCallback, useEffect, useState } from 'react';
import { TestModeBanner } from '@/components/TestModeBanner';
import { hasCommercialUpgradePath } from '@/lib/components/should-show-upgrade-nav';
import { apiFetch } from '@/lib/utils/csrf';
import { safeStripeRedirect } from '@/lib/utils/safe-stripe-redirect';

// Bounded retry for the subscription fetch that gates auto-checkout. A short
// linear backoff spaces the attempts so a brief blip on the buyer's connection
// (or a cold API instance) resolves before we surrender to the manual fallback.
const MAX_SUBSCRIPTION_FETCH_ATTEMPTS = 3;
const SUBSCRIPTION_RETRY_BASE_DELAY_MS = 150;

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

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

interface SeatsData {
  active: number;
  max: number | null;
  tier: LicenseTierId;
}

export default function BillingPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-[60vh] items-center justify-center">
          <p className="text-zinc-600">Loading...</p>
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
  const credits = searchParams.get('credits');
  const renewal = searchParams.get('renewal');
  // ?upgrade=pro|max|enterprise deep link (marketing pricing cards via /signup?plan=).
  // Unknown values are ignored. GAP-302 Phase 1: enterprise uses the same
  // auto-checkout path as pro/max (server resolves catalog price).
  const upgradeParam = searchParams.get('upgrade');
  const upgrade: 'pro' | 'max' | 'enterprise' | null =
    upgradeParam === 'pro' || upgradeParam === 'max' || upgradeParam === 'enterprise'
      ? upgradeParam
      : null;
  const { data: session, isLoading: sessionLoading } = useSession();
  const [subscription, setSubscription] = useState<SubscriptionData | null>(null);
  const [usage, setUsage] = useState<UsageData | null>(null);
  const [seats, setSeats] = useState<SeatsData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pricing, setPricing] = useState<PricingResponse | null>(null);
  const [subscriptionLoadFailed, setSubscriptionLoadFailed] = useState(false);

  const apiUrl = (process.env.NEXT_PUBLIC_API_URL || 'https://api.revealui.com').trim();

  const getPrice = (tierId: string): string => {
    const t = pricing?.subscriptions.find((s) => s.id === tierId);
    if (!t?.price) return ' - ';
    return `${t.price}${t.period ?? ''}`;
  };

  const attemptFetchSubscription = useCallback(async (): Promise<boolean> => {
    try {
      const [subRes, usageRes, pricingRes, seatsRes] = await Promise.all([
        fetch(`${apiUrl}/api/billing/subscription`, { credentials: 'include' }),
        fetch(`${apiUrl}/api/billing/usage`, { credentials: 'include' }),
        fetch(`${apiUrl}/api/pricing`),
        fetch(`${apiUrl}/api/billing/seats`, { credentials: 'include' }),
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
      if (seatsRes.ok) {
        const data = (await seatsRes.json()) as SeatsData;
        setSeats(data);
      }
      return subRes.ok;
    } catch {
      return false;
    }
  }, [apiUrl]);

  /**
   * Fetches subscription data with a bounded retry (short linear backoff
   * between attempts). The auto-checkout effect below only fires once
   * `subscription` is populated, so a hard failure here must never be silent
   * - it logs the failure and leaves a trail (`subscriptionLoadFailed`) the UI
   * can act on, especially when the user arrived mid-purchase with an
   * `?upgrade=` param.
   */
  const fetchSubscription = useCallback(async () => {
    setError(null);
    setSubscriptionLoadFailed(false);

    let ok = false;
    for (let attempt = 1; attempt <= MAX_SUBSCRIPTION_FETCH_ATTEMPTS; attempt += 1) {
      ok = await attemptFetchSubscription();
      if (ok) break;
      if (attempt < MAX_SUBSCRIPTION_FETCH_ATTEMPTS) {
        await delay(SUBSCRIPTION_RETRY_BASE_DELAY_MS * attempt);
      }
    }

    if (!ok) {
      logger.error('Billing subscription fetch failed after retries', {
        attempts: MAX_SUBSCRIPTION_FETCH_ATTEMPTS,
        plan: upgrade,
      });
      setError('Failed to load subscription data');
      setSubscriptionLoadFailed(true);
    }
    setIsLoading(false);
  }, [attemptFetchSubscription, upgrade]);

  useEffect(() => {
    if (!sessionLoading && session) {
      void fetchSubscription();
    } else if (!(sessionLoading || session)) {
      router.push('/login');
    }
  }, [session, sessionLoading, fetchSubscription, router]);

  const handleCheckout = useCallback(
    async (target: 'pro' | 'max' | 'enterprise' = 'pro') => {
      setActionLoading(true);
      setError(null);
      try {
        const priceId =
          target === 'enterprise'
            ? process.env.NEXT_PUBLIC_STRIPE_ENTERPRISE_PRICE_ID
            : target === 'max'
              ? process.env.NEXT_PUBLIC_STRIPE_MAX_PRICE_ID
              : process.env.NEXT_PUBLIC_STRIPE_PRO_PRICE_ID;
        const res = await apiFetch(`${apiUrl}/api/billing/checkout`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({
            ...(priceId && { priceId }),
            tier: target,
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
    },
    [apiUrl],
  );

  // Auto-redirect to checkout on signup with ?upgrade=pro|max|enterprise, and for churned
  // users (expired/canceled) arriving with explicit upgrade intent. Never fires
  // for active or trialing subscribers.
  useEffect(() => {
    const canAutoCheckout =
      subscription?.tier === 'free' ||
      subscription?.status === 'expired' ||
      subscription?.status === 'canceled';
    if (upgrade && canAutoCheckout && !actionLoading) {
      void handleCheckout(upgrade);
    }
  }, [upgrade, subscription, actionLoading, handleCheckout]);

  const handleManageBilling = async () => {
    setActionLoading(true);
    setError(null);
    try {
      const res = await apiFetch(`${apiUrl}/api/billing/portal`, {
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
        <p className="text-zinc-600">Loading...</p>
      </div>
    );
  }

  const tier = subscription?.tier || 'free';
  const StatusLabels: Record<string, string> = {
    trialing: 'Free Trial',
    active: 'Active',
    past_due: 'Past Due',
    grace_period: 'Grace Period',
    expired: 'Expired',
    revoked: 'Revoked',
    canceled: 'Canceled',
  };
  const statusLabel = subscription?.status
    ? (StatusLabels[subscription.status] ?? subscription.status)
    : 'Active';
  return (
    <div className="mx-auto max-w-2xl space-y-6 py-12">
      <h1 className="text-2xl font-bold">Billing</h1>

      <TestModeBanner />

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
            <Button
              type="button"
              appearance="link"
              variant="neutral"
              size="sm"
              onClick={handleManageBilling}
              disabled={actionLoading}
              className="ml-2 h-auto p-0 font-medium text-inherit underline"
            >
              Resubscribe
            </Button>
          </div>
        )}

      {subscription?.status === 'expired' && (
        <div className="rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-800 dark:border-red-800 dark:bg-red-900/20 dark:text-red-300">
          Your subscription has expired. Pro features are no longer available.
          <Button
            type="button"
            appearance="link"
            variant="neutral"
            size="sm"
            onClick={() => void handleCheckout()}
            disabled={actionLoading}
            className="ml-2 h-auto p-0 font-medium text-inherit underline"
          >
            Resubscribe
          </Button>
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
          <Button
            type="button"
            appearance="link"
            variant="neutral"
            size="sm"
            onClick={handleManageBilling}
            disabled={actionLoading}
            className="inline h-auto p-0 font-medium text-inherit underline"
          >
            update your payment method
          </Button>
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
            <Button
              type="button"
              appearance="link"
              variant="neutral"
              size="sm"
              onClick={handleManageBilling}
              disabled={actionLoading}
              className="ml-2 h-auto p-0 font-medium text-inherit underline"
            >
              Update payment
            </Button>
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

      {renewal && (
        <div className="rounded-md bg-green-50 p-4 text-sm text-green-700 dark:bg-green-900/20 dark:text-green-400">
          Support contract renewed! Your perpetual license support has been extended by 1 year.{' '}
          <Link href="/account/license" className="font-medium underline hover:no-underline">
            View your license &rarr;
          </Link>
        </div>
      )}

      {credits && (
        <div className="rounded-md bg-green-50 p-4 text-sm text-green-700 dark:bg-green-900/20 dark:text-green-400">
          Credit bundle purchased! Your agent task credits have been added to your balance.
        </div>
      )}

      {success && !perpetual && !credits && (
        <div className="rounded-md bg-green-50 p-4 text-sm text-green-700 dark:bg-green-900/20 dark:text-green-400">
          Subscription activated! Your Pro features are now available.
        </div>
      )}

      {error && (
        <div className="rounded-md bg-red-50 p-3 text-sm text-red-700 dark:bg-red-900/20 dark:text-red-400">
          {error}
        </div>
      )}

      {subscriptionLoadFailed && upgrade && (
        <div className="rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-800 dark:border-red-800 dark:bg-red-900/20 dark:text-red-300">
          We could not load your subscription, so checkout did not start automatically.
          <Button
            type="button"
            appearance="link"
            variant="neutral"
            size="sm"
            onClick={() => void handleCheckout(upgrade)}
            disabled={actionLoading}
            className="ml-2 h-auto p-0 font-medium text-inherit underline"
          >
            Continue to checkout
          </Button>
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Current Plan</CardTitle>
          <CardDescription>Your account and subscription details.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Plan</span>
            <span className={`rounded-full px-3 py-1 text-sm font-medium ${TIER_COLORS[tier]}`}>
              {TIER_LABELS[tier]}
            </span>
          </div>

          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Status</span>
            <span
              className={`text-sm font-medium ${
                subscription?.status === 'active' || subscription?.status === 'trialing'
                  ? 'text-success'
                  : subscription?.status === 'past_due' || subscription?.status === 'grace_period'
                    ? 'text-warning'
                    : subscription?.status === 'expired' || subscription?.status === 'revoked'
                      ? 'text-destructive'
                      : ''
              }`}
            >
              {statusLabel}
            </span>
          </div>

          {subscription?.expiresAt && (
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Expires</span>
              <span className="text-sm">
                {new Date(subscription.expiresAt).toLocaleDateString()}
              </span>
            </div>
          )}

          <div className="flex flex-col gap-2 border-t pt-4">
            {/* Top commercial tier (enterprise): no higher plan — hide upsell. */}
            {hasCommercialUpgradePath(tier) && (
              <Button asChild appearance="outline" variant="neutral" className="w-full">
                <Link href="/upgrade">Change plan →</Link>
              </Button>
            )}
            {tier !== 'free' && (
              <Button
                onClick={handleManageBilling}
                disabled={actionLoading}
                appearance="outline"
                variant="neutral"
                className="w-full"
              >
                {actionLoading ? 'Opening portal...' : 'Manage billing & cancel'}
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {seats && (
        <Card>
          <CardHeader>
            <CardTitle>Team Seats</CardTitle>
            <CardDescription>
              {seats.max === null
                ? 'Unlimited members (Enterprise tier).'
                : `${seats.max.toLocaleString()} member seats included on the ${TIER_LABELS[seats.tier]} tier.`}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-end justify-between text-sm">
              <span className="font-medium">{seats.active.toLocaleString()} active</span>
              <span className="text-zinc-600">
                {seats.max === null ? 'Unlimited' : `of ${seats.max.toLocaleString()}`}
              </span>
            </div>
            {seats.max !== null && (
              <div className="h-2 w-full overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-800">
                <div
                  className={`h-full rounded-full transition-all ${
                    seats.active / seats.max >= 1
                      ? 'bg-red-500'
                      : seats.active / seats.max >= 0.8
                        ? 'bg-amber-500'
                        : 'bg-blue-500'
                  }`}
                  style={{ width: `${Math.min((seats.active / seats.max) * 100, 100)}%` }}
                />
              </div>
            )}
            {seats.max !== null && seats.active >= seats.max && (
              <div className="rounded-lg bg-red-50 p-3 dark:bg-red-950/30">
                <p className="text-xs text-red-600 dark:text-red-400">
                  {seats.tier === 'max'
                    ? "You've reached your seat limit. Contact us about Enterprise to add more members."
                    : 'You\'ve reached your seat limit. Use "Change plan" above to add more members.'}
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {usage && (
        <Card>
          <CardHeader>
            <CardTitle>Agent Task Usage</CardTitle>
            <CardDescription>
              {usage.quota === -1
                ? 'Unlimited agent tasks (Enterprise tier).'
                : `${usage.quota.toLocaleString()} tasks included per month. Resets ${new Date(usage.resetAt).toLocaleDateString('en-US', { month: 'long', day: 'numeric' })}.`}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-end justify-between text-sm">
              <span className="font-medium">{usage.used.toLocaleString()} used</span>
              <span className="text-zinc-600">
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
    </div>
  );
}
