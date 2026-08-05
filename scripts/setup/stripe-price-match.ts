/**
 * Pure price-matching predicates for the Stripe seeder.
 *
 * Extracted from `seed-stripe.ts` so they are unit-testable without importing
 * that script (which runs `main()` on import). Matching on EITHER the Stripe
 * `lookup_key` OR the legacy `metadata.revealui_price_key` lets the seeder
 * migrate price identity from metadata to lookup_key without creating duplicate
 * prices on the live account during the transition.
 */

/** A single price within a product definition (shared with seed-stripe.ts). */
export interface PriceDefinition {
  key: string;
  unitAmount: number; // cents
  currency: string;
  interval?: 'month' | 'year';
  /**
   * `metered` = subscription overage price (usage_type metered), GAP-212 step 1.
   * Catalog rows for metered rates stay owner-gated until per-tier rates land.
   */
  mode: 'subscription' | 'payment' | 'metered';
  trialDays?: number;
}

/**
 * The subset of a Stripe price these predicates read. `Stripe.Price` is
 * structurally assignable to it, so callers pass live prices directly while
 * tests pass plain object literals.
 */
export interface MatchablePrice {
  lookup_key: string | null;
  metadata: Record<string, string> | null;
  unit_amount: number | null;
  currency: string;
  recurring: { interval: string; usage_type?: string | null } | null;
}

/**
 * True when a live price carries a definition's stable handle — its
 * `lookup_key` or the legacy `metadata.revealui_price_key` — regardless of
 * amount or interval. Used to find a stale price to archive before recreating.
 */
export function priceSharesHandle(price: MatchablePrice, priceDef: PriceDefinition): boolean {
  return price.lookup_key === priceDef.key || price.metadata?.revealui_price_key === priceDef.key;
}

/**
 * True when a live price matches a definition exactly: it shares the stable
 * handle AND has the same amount, currency, and recurrence shape.
 */
export function priceMatchesDefinition(price: MatchablePrice, priceDef: PriceDefinition): boolean {
  if (!priceSharesHandle(price, priceDef)) return false;
  if (price.unit_amount !== priceDef.unitAmount) return false;
  if (price.currency !== priceDef.currency) return false;
  if (priceDef.mode === 'subscription') {
    return (
      price.recurring?.interval === priceDef.interval &&
      (price.recurring.usage_type == null || price.recurring.usage_type === 'licensed')
    );
  }
  if (priceDef.mode === 'metered') {
    return (
      price.recurring?.interval === (priceDef.interval ?? 'month') &&
      price.recurring.usage_type === 'metered'
    );
  }
  return !price.recurring;
}
