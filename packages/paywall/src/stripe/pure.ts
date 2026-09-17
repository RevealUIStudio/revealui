import type {
  CheckoutMetadata,
  EarlyAdopterConfig,
  PaidTier,
  RequestEntitlements,
} from './types.js';

/**
 * Unix timestamp (seconds) for the last second of the billing cycle that
 * starts at `cycleStart` (UTC midnight of day 1).
 *
 * @example
 * ```ts
 * import { getMeterEventTimestamp } from '@revealui/paywall/stripe';
 * const ts = getMeterEventTimestamp(new Date(Date.UTC(2026, 1, 1)));
 * ```
 */
export function getMeterEventTimestamp(cycleStart: Date): number {
  const nextCycleStart = new Date(
    Date.UTC(cycleStart.getUTCFullYear(), cycleStart.getUTCMonth() + 1, 1),
  );
  return Math.floor(nextCycleStart.getTime() / 1000) - 1;
}

/**
 * Early-adopter coupon window from env. Hosts may pass an override instead of
 * reading `process.env` (tests).
 *
 * @example
 * ```ts
 * import { getEarlyAdopterConfig } from '@revealui/paywall/stripe';
 * const cfg = getEarlyAdopterConfig();
 * ```
 */
export function getEarlyAdopterConfig(env: NodeJS.ProcessEnv = process.env): EarlyAdopterConfig {
  const endStr = env.REVEALUI_EARLY_ADOPTER_END;
  return {
    endDate: endStr && !Number.isNaN(new Date(endStr).getTime()) ? new Date(endStr) : null,
    coupons: {
      pro: env.REVEALUI_EARLY_ADOPTER_COUPON_PRO,
      max: env.REVEALUI_EARLY_ADOPTER_COUPON_MAX,
      enterprise: env.REVEALUI_EARLY_ADOPTER_COUPON_ENT,
    },
  };
}

/**
 * Stripe `discounts` vs `allow_promotion_codes` (mutually exclusive).
 *
 * @example
 * ```ts
 * import { getEarlyAdopterDiscount } from '@revealui/paywall/stripe';
 * const promo = getEarlyAdopterDiscount('pro');
 * ```
 */
export function getEarlyAdopterDiscount(
  tier: string,
  now: Date = new Date(),
  config: EarlyAdopterConfig = getEarlyAdopterConfig(),
): { discounts: Array<{ coupon: string }> } | { allow_promotion_codes: true } {
  if (!config.endDate || now > config.endDate) {
    return { allow_promotion_codes: true };
  }
  const couponId = config.coupons[tier];
  if (!couponId) {
    return { allow_promotion_codes: true };
  }
  return { discounts: [{ coupon: couponId }] };
}

/**
 * Resolve agent-task quota from entitlements, else `fallback`.
 *
 * @example
 * ```ts
 * import { resolveUsageQuota } from '@revealui/paywall/stripe';
 * const quota = resolveUsageQuota(entitlements, () => 100);
 * ```
 */
export function resolveUsageQuota(
  entitlements: RequestEntitlements | undefined,
  fallback: () => number,
): number {
  const accountQuota = entitlements?.limits?.maxAgentTasks;
  if (typeof accountQuota === 'number') {
    return accountQuota;
  }
  return fallback();
}

/**
 * Deduped Checkout / PaymentIntent metadata pair used by hosted checkout.
 *
 * @example
 * ```ts
 * import { buildCheckoutMetadata } from '@revealui/paywall/stripe';
 * const meta = buildCheckoutMetadata('pro', userId, { interval: 'month' });
 * ```
 */
export function buildCheckoutMetadata(
  tier: string,
  userId: string,
  extras: Record<string, string> = {},
): CheckoutMetadata {
  const metadata = { tier, userId, ...extras };
  return { metadata, payment_intent_data: { metadata } };
}

export type { EarlyAdopterConfig, PaidTier };
