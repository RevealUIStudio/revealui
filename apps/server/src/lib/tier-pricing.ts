/**
 * Hosted-tier MRR fallback pricing — display-only fallback used when the
 * `billing_catalog` DB row has no Stripe price ID set for a tier.
 *
 * Stripe Dashboard is the source of truth for what customers actually pay.
 * `billing_catalog.stripePriceId` is the DB cache of that truth. This
 * constant is the last-resort display fallback for the admin MRR metrics
 * route — used only when both of the above are unavailable or null.
 *
 * Formerly named `CANONICAL_TIER_PRICES` in `apps/server/src/routes/billing.ts`
 * — the rename (CR8-P2-04) fixes a misleading label: this is not canonical;
 * Stripe is. The `billing-readiness` cron (`./cron/billing-readiness.ts`)
 * asserts drift by fetching each Stripe price on the `STRIPE_*_PRICE_ID` env
 * var and comparing `price.unit_amount` to the cents values derived here.
 */

export type SubscriptionTierId = 'pro' | 'max' | 'enterprise';

/**
 * MRR fallback monthly price per tier, in USD (whole dollars).
 * Consumed by the admin MRR metrics route when `billing_catalog.stripePriceId`
 * is null for a tier. Must stay in sync with Stripe Dashboard; drift is
 * surfaced as a hard-fail by the `billing-readiness` cron.
 */
export const MRR_TIER_PRICE_FALLBACK_USD: Record<SubscriptionTierId, number> = {
  pro: 49,
  max: 149,
  enterprise: 299,
};

/** Same values in cents — convenience for Stripe comparisons. */
export const MRR_TIER_PRICE_FALLBACK_CENTS: Record<SubscriptionTierId, number> = Object.fromEntries(
  Object.entries(MRR_TIER_PRICE_FALLBACK_USD).map(([tier, usd]) => [tier, usd * 100]),
) as Record<SubscriptionTierId, number>;
