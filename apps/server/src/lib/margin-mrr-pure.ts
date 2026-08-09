/**
 * GAP-256 PR-2 — pure MRR math (no DB).
 */

import type { LivePaidTierCounts, PaidSubscriptionTier } from './margin-mrr-types.js';

export function computeMonthlyMrrCents(
  counts: LivePaidTierCounts,
  prices: Record<PaidSubscriptionTier, number>,
): number {
  let mrr = 0;
  for (const tier of ['pro', 'max', 'enterprise'] as const) {
    mrr += counts[tier] * prices[tier];
  }
  return mrr;
}

/** Daily revenue attribution from monthly MRR (calendar month of periodDate). */
export function dailyRevenueCentsFromMrr(monthlyMrrCents: number, periodDate: Date): number {
  const year = periodDate.getUTCFullYear();
  const month = periodDate.getUTCMonth();
  const daysInMonth = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  if (daysInMonth <= 0) {
    return 0;
  }
  return Math.round(monthlyMrrCents / daysInMonth);
}
