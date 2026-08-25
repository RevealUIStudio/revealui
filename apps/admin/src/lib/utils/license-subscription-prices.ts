import type { LicenseTierId, PricingResponse, SubscriptionTier } from '@revealui/contracts/pricing';

/**
 * Display fallbacks for license subscriptions when GET /api/pricing is
 * unreachable. Lockstep with:
 *   - apps/server/src/routes/pricing.ts HARDCODED_SUBSCRIPTION_PRICES
 *   - apps/marketing/app/lib/pricing-fallbacks.ts SUBSCRIPTION_PRICE_FALLBACKS
 *   - offerings-canonical license SKUs (Pro $49 / Max $299 / Enterprise $1,499)
 *
 * Never used for agency / services / Fleet SKUs.
 */
export const LICENSE_SUBSCRIPTION_PRICE_FALLBACKS: Record<
  LicenseTierId,
  { price: string; period?: string }
> = {
  free: { price: '$0' },
  pro: { price: '$49', period: '/mo' },
  max: { price: '$299', period: '/mo' },
  enterprise: { price: '$1,499', period: '/mo' },
};

export function mergeLicenseSubscriptionPrices(
  tiers: SubscriptionTier[],
  catalog: Pick<PricingResponse, 'subscriptions'> | null | undefined,
): SubscriptionTier[] {
  return tiers.map((tier) => {
    const fromCatalog = catalog?.subscriptions.find((entry) => entry.id === tier.id);
    const fallback = LICENSE_SUBSCRIPTION_PRICE_FALLBACKS[tier.id];
    return {
      ...tier,
      price: fromCatalog?.price ?? fallback.price,
      period: fromCatalog?.period ?? fallback.period,
    };
  });
}
