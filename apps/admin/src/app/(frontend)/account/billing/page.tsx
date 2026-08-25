'use client';

import { useSession } from '@revealui/auth/react';
import {
  ENTERPRISE_SALES_HREF,
  type LicenseTierId,
  type PricingResponse,
  TIER_COLORS,
  TIER_LABELS,
} from '@revealui/contracts/pricing';
import {
  Button,
  Callout,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@revealui/presentation';
import { logger } from '@revealui/utils/logger';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Suspense, useCallback, useEffect, useState } from 'react';
import { TestModeBanner } from '@/components/TestModeBanner';
import { hasCommercialUpgradePath } from '@/lib/components/should-show-upgrade-nav';
import { apiFetch } from '@/lib/utils/csrf';
import { safeStripeRedirect } from '@/lib/utils/safe-stripe-redirect';
import { subscriptionCheckoutBody } from '@/lib/utils/subscription-checkout';
import {
  formatTrialEndDate,
  perpetualActivatedMessage,
  resubscribeTier,
  subscriptionActivatedMessage,
  subscriptionExpiredMessage,
  trialEndsBody,
  trialEndsTitle,
} from './trial-copy';

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
  const searchParams = useSearchParams();
  const success = searchParams.get('success');
  const perpetual = searchParams.get('perpetual');
  const credits = searchParams.get('credits');
  const renewal = searchParams.get('renewal');
  // ?upgrade=pro|max|enterprise deep link (marketing pricing cards via /signup?plan=).
  // Unknown values are ignored. Enterprise is sales-assisted — never auto-checkout.
  const upgradeParam = searchParams.get('upgrade');
  const upgrade: 'pro' | 'max' | 'enterprise' | null =
    upgradeParam === 'pro' || upgradeParam === 'max' || upgradeParam === 'enterprise'
      ? upgradeParam
      : null;
  const { isLoading: sessionLoading } = useSession();
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
    if (sessionLoading) return;
    // Same as /account/license: proxy already gated unauth visitors.
    // A useSession 401 must not bounce to /login (httpOnly cookies +
    // bare /login 307 to the dashboard).
    void fetchSubscription();
  }, [sessionLoading, fetchSubscription]);

  const handleCheckout = useCallback(
    async (target: 'pro' | 'max' | 'enterprise' = 'pro') => {
      if (target === 'enterprise') {
        window.location.assign(ENTERPRISE_SALES_HREF);
        return;
      }
      setActionLoading(true);
      setError(null);
      try {
        const res = await apiFetch(`${apiUrl}/api/billing/checkout`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify(subscriptionCheckoutBody(target)),
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

  // Auto-redirect to checkout on signup with ?upgrade=pro|max, and for churned
  // users (expired/canceled) arriving with explicit upgrade intent. Never fires
  // for active or trialing subscribers. Enterprise is Contact sales, not Stripe.
  useEffect(() => {
    const canAutoCheckout =
      subscription?.tier === 'free' ||
      subscription?.status === 'expired' ||
      subscription?.status === 'canceled';
    if (upgrade && upgrade !== 'enterprise' && canAutoCheckout && !actionLoading) {
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
        <Callout variant="info" role="status" title={trialEndsTitle(tier, subscription.expiresAt)}>
          {trialEndsBody(getPrice(tier))}
        </Callout>
      )}

      {subscription?.status === 'active' &&
        subscription.expiresAt &&
        new Date(subscription.expiresAt) > new Date() && (
          <Callout
            variant="warning"
            role="status"
            title={`Your subscription will end on ${formatTrialEndDate(subscription.expiresAt)}`}
          >
            You&apos;ll retain access to {TIER_LABELS[tier]} features until then.{' '}
            <Button
              type="button"
              appearance="link"
              variant="neutral"
              size="sm"
              onClick={handleManageBilling}
              disabled={actionLoading}
              className="h-auto p-0 font-medium text-inherit underline"
            >
              Resubscribe
            </Button>
          </Callout>
        )}

      {subscription?.status === 'expired' && (
        <Callout variant="error" role="alert" title="Subscription expired">
          {subscriptionExpiredMessage(tier)}{' '}
          <Button
            type="button"
            appearance="link"
            variant="neutral"
            size="sm"
            onClick={() => void handleCheckout(resubscribeTier(tier))}
            disabled={actionLoading}
            className="h-auto p-0 font-medium text-inherit underline"
          >
            Resubscribe
          </Button>
        </Callout>
      )}

      {subscription?.status === 'revoked' && (
        <Callout variant="error" role="alert" title="Subscription revoked">
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
        </Callout>
      )}

      {subscription?.graceUntil &&
        (subscription.status === 'past_due' || subscription.status === 'grace_period') && (
          <Callout
            variant="warning"
            role="status"
            title={`Your payment is past due. You have access until ${formatTrialEndDate(subscription.graceUntil)}`}
          >
            Please update your payment method to avoid losing access.{' '}
            <Button
              type="button"
              appearance="link"
              variant="neutral"
              size="sm"
              onClick={handleManageBilling}
              disabled={actionLoading}
              className="h-auto p-0 font-medium text-inherit underline"
            >
              Update payment
            </Button>
          </Callout>
        )}

      {perpetual && (
        <Callout variant="success" role="status" title="Perpetual license activated">
          {perpetualActivatedMessage(tier)}{' '}
          <Link href="/account/license" className="font-medium underline hover:no-underline">
            View your license key &rarr;
          </Link>
        </Callout>
      )}

      {renewal && (
        <Callout variant="success" role="status" title="Support contract renewed">
          Your perpetual license support has been extended by 1 year.{' '}
          <Link href="/account/license" className="font-medium underline hover:no-underline">
            View your license &rarr;
          </Link>
        </Callout>
      )}

      {credits && (
        <Callout variant="success" role="status" title="Credit bundle purchased">
          Your agent task credits have been added to your balance.
        </Callout>
      )}

      {success && !perpetual && !credits && (
        <Callout variant="success" role="status" title="Subscription activated">
          {subscriptionActivatedMessage(tier)}
        </Callout>
      )}

      {error && (
        <Callout variant="error" role="alert">
          {error}
        </Callout>
      )}

      {upgrade === 'enterprise' && (
        <Callout variant="info" role="status" title="Enterprise is sold through sales">
          Not unattended checkout.{' '}
          <Button asChild appearance="link" variant="neutral" size="sm" className="h-auto p-0">
            <a href={ENTERPRISE_SALES_HREF}>Contact sales</a>
          </Button>
        </Callout>
      )}

      {subscriptionLoadFailed && upgrade && upgrade !== 'enterprise' && (
        <Callout variant="error" role="alert" title="Could not load your subscription">
          Checkout did not start automatically.{' '}
          <Button
            type="button"
            appearance="link"
            variant="neutral"
            size="sm"
            onClick={() => void handleCheckout(upgrade)}
            disabled={actionLoading}
            className="h-auto p-0 font-medium text-inherit underline"
          >
            Continue to checkout
          </Button>
        </Callout>
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
