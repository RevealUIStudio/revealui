/**
 * Self-serve subscription checkout body.
 *
 * POST /api/billing/checkout resolves the Stripe price from the server
 * `billing_catalog` (`resolveCatalogPriceId`). A client-baked
 * `NEXT_PUBLIC_STRIPE_*_PRICE_ID` is not that catalog — posting it is a
 * 400 "Requested price does not match the server billing catalog."
 *
 * Display amounts come from GET /api/pricing (public catalog). Checkout
 * sends only the tier so the handler's catalog is the price source of truth.
 */

export type SelfServeSubscriptionTier = 'pro' | 'max';

export interface SubscriptionCheckoutBody {
  tier: SelfServeSubscriptionTier;
}

export function subscriptionCheckoutBody(
  tier: SelfServeSubscriptionTier,
): SubscriptionCheckoutBody {
  return { tier };
}
