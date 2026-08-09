/**
 * GAP-256 PR-2 — shared MRR helpers (K12).
 *
 * Same paid-entitlement filters as GET /api/billing/metrics so admin cards
 * and margin snapshots cannot drift.
 */

import { getConfiguredStripeMode } from '@revealui/config/stripe-mode';
import type { getClient } from '@revealui/db';
import { accountEntitlements, billingCatalog } from '@revealui/db/schema';
import { and, count, eq, ne } from 'drizzle-orm';
import { computeMonthlyMrrCents, dailyRevenueCentsFromMrr } from './margin-mrr-pure.js';
import type { LivePaidTierCounts, PaidSubscriptionTier } from './margin-mrr-types.js';
import { MRR_TIER_PRICE_FALLBACK_CENTS } from './tier-pricing.js';

export type { LivePaidTierCounts, PaidSubscriptionTier } from './margin-mrr-types.js';
export { computeMonthlyMrrCents, dailyRevenueCentsFromMrr } from './margin-mrr-pure.js';

/** Drizzle client returned by getClient(). */
export type MarginDb = ReturnType<typeof getClient>;

/**
 * Count live paid entitlements by tier.
 * Filters: status=active, mode=live, source≠grant; free/trialing ignored for MRR.
 */
export async function countLivePaidEntitlementsByTier(db: MarginDb): Promise<LivePaidTierCounts> {
  const tierRows = await db
    .select({
      tier: accountEntitlements.tier,
      tierCount: count(),
    })
    .from(accountEntitlements)
    .where(
      and(
        eq(accountEntitlements.status, 'active'),
        eq(accountEntitlements.mode, 'live'),
        ne(accountEntitlements.source, 'grant'),
      ),
    )
    .groupBy(accountEntitlements.tier);

  const out: LivePaidTierCounts = { pro: 0, max: 0, enterprise: 0 };
  for (const row of tierRows as Array<{ tier: string; tierCount: number }>) {
    if (row.tier === 'pro' || row.tier === 'max' || row.tier === 'enterprise') {
      out[row.tier] = row.tierCount;
    }
  }
  return out;
}

/**
 * Resolve monthly price cents per tier from catalog or fallback constants.
 */
export async function resolveTierPriceCents(
  db: MarginDb,
): Promise<Record<PaidSubscriptionTier, number>> {
  const catalogRows = await db
    .select({
      tier: billingCatalog.tier,
      metadata: billingCatalog.metadata,
    })
    .from(billingCatalog)
    .where(
      and(
        eq(billingCatalog.billingModel, 'subscription'),
        eq(billingCatalog.mode, getConfiguredStripeMode()),
        eq(billingCatalog.active, true),
      ),
    );

  const catalogPriceCents: Partial<Record<string, number>> = {};
  for (const entry of catalogRows as Array<{
    tier: string;
    metadata: unknown;
  }>) {
    const amount =
      typeof entry.metadata === 'object' &&
      entry.metadata !== null &&
      'unitAmountCents' in entry.metadata
        ? Number((entry.metadata as { unitAmountCents: unknown }).unitAmountCents)
        : undefined;
    if (typeof amount === 'number' && amount > 0) {
      catalogPriceCents[entry.tier] = amount;
    }
  }

  return {
    pro: catalogPriceCents.pro ?? MRR_TIER_PRICE_FALLBACK_CENTS.pro,
    max: catalogPriceCents.max ?? MRR_TIER_PRICE_FALLBACK_CENTS.max,
    enterprise: catalogPriceCents.enterprise ?? MRR_TIER_PRICE_FALLBACK_CENTS.enterprise,
  };
}
