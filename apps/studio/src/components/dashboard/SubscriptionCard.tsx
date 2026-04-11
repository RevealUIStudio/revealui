/**
 * SubscriptionCard  -  Shows billing tier, status, and agent task usage.
 *
 * Fetches live data from the API via useSubscription.
 * Displays tier badge, subscription status, grace period warnings,
 * and a usage progress bar for agent tasks.
 */

import { useSubscription } from '../../hooks/use-subscription';

// ── Tier display helpers ─────────────────────────────────────────────────────

const TIER_LABELS: Record<string, string> = {
  free: 'Free',
  pro: 'Pro',
  max: 'Max',
  enterprise: 'Forge',
};

const TIER_COLORS: Record<string, string> = {
  free: 'text-neutral-400 bg-neutral-800 border-neutral-700',
  pro: 'text-orange-400 bg-orange-600/20 border-orange-600/30',
  max: 'text-amber-400 bg-amber-600/20 border-amber-600/30',
  enterprise: 'text-violet-400 bg-violet-600/20 border-violet-600/30',
};

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  active: { label: 'Active', color: 'text-emerald-400' },
  past_due: { label: 'Past Due', color: 'text-amber-400' },
  grace_period: { label: 'Grace Period', color: 'text-amber-400' },
  canceled: { label: 'Canceled', color: 'text-red-400' },
  expired: { label: 'Expired', color: 'text-red-400' },
};

// ── Component ────────────────────────────────────────────────────────────────

export default function SubscriptionCard() {
  const { subscription, usage, loading, error } = useSubscription();

  if (loading && !subscription) {
    return (
      <div className="col-span-full rounded-lg border border-neutral-800 bg-neutral-900 p-4">
        <div className="h-5 w-24 animate-pulse rounded bg-neutral-800" />
        <div className="mt-3 h-4 w-48 animate-pulse rounded bg-neutral-800" />
      </div>
    );
  }

  if (error && !subscription) {
    return (
      <div className="col-span-full rounded-lg border border-red-900/50 bg-red-950/20 p-4">
        <p className="text-xs text-red-400">Unable to load billing: {error}</p>
      </div>
    );
  }

  if (!subscription) return null;

  const tierLabel = TIER_LABELS[subscription.tier] ?? subscription.tier;
  const tierColor = TIER_COLORS[subscription.tier] ?? TIER_COLORS.free;
  const statusInfo = STATUS_LABELS[subscription.status] ?? {
    label: subscription.status,
    color: 'text-neutral-400',
  };

  const graceUntil = subscription.graceUntil ?? null;
  const graceDate = graceUntil ? new Date(graceUntil).toLocaleDateString() : null;

  // Usage bar
  const hasUsage = usage != null;
  const usagePercent =
    hasUsage && usage.quota > 0 ? Math.min(100, Math.round((usage.used / usage.quota) * 100)) : 0;
  const isUnlimited = hasUsage && usage.quota === -1;

  return (
    <div className="col-span-full rounded-lg border border-neutral-800 bg-neutral-900 p-4">
      {/* Header row */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span
            className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${tierColor}`}
          >
            {tierLabel}
          </span>
          <span className={`text-xs font-medium ${statusInfo.color}`}>{statusInfo.label}</span>
        </div>
        {subscription.expiresAt ? (
          <span className="text-xs text-neutral-500">
            Expires {new Date(subscription.expiresAt).toLocaleDateString()}
          </span>
        ) : null}
      </div>

      {/* Grace period warning */}
      {graceUntil ? (
        <div className="mt-2 rounded border border-amber-800/50 bg-amber-950/20 px-2.5 py-1.5 text-xs text-amber-400">
          Grace period until {graceDate} - update your payment method to avoid losing access.
        </div>
      ) : null}

      {/* Usage bar */}
      {hasUsage ? (
        <div className="mt-3">
          <div className="flex items-center justify-between text-xs text-neutral-400">
            <span>Agent Tasks</span>
            <span>
              {usage.used} / {isUnlimited ? '∞' : usage.quota}
            </span>
          </div>
          {isUnlimited ? null : (
            <div className="mt-1 h-1.5 w-full rounded-full bg-neutral-800">
              <div
                className={`h-full rounded-full transition-all ${
                  usagePercent >= 90
                    ? 'bg-red-500'
                    : usagePercent >= 70
                      ? 'bg-amber-500'
                      : 'bg-orange-500'
                }`}
                style={{ width: `${usagePercent}%` }}
              />
            </div>
          )}
          {usage.overage > 0 ? (
            <p className="mt-1 text-xs text-red-400">{usage.overage} tasks over quota</p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
