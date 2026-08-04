/**
 * GAP-434 — first-month-of-Pro coupon catalog (pure constants + create shape).
 *
 * The seed script and docs must agree on IDs so support can email a stable
 * promotion code after each Starter Kit sale.
 */

export const STARTER_KIT_PRO_COUPON = {
  /** Stripe coupon id (immutable once created). */
  couponId: 'starter_kit_pro_month_1',
  name: 'Starter Kit first Pro month',
  /** 100% off one Pro billing cycle (duration once). */
  percentOff: 100,
  duration: 'once' as const,
  /** Human-facing promo code emailed with GitHub invite. */
  promotionCode: 'STARTERKITPRO1',
} as const;

/**
 * Stripe SDK 22+ requires promotion codes to reference a coupon via nested
 * `promotion`, not top-level `coupon` (rejected: "Received unknown parameter: coupon").
 */
export function promotionCodeCreateParams(
  couponId: string,
  code: string,
  metadata: Record<string, string>,
): {
  promotion: { type: 'coupon'; coupon: string };
  code: string;
  metadata: Record<string, string>;
} {
  return {
    promotion: {
      type: 'coupon',
      coupon: couponId,
    },
    code,
    metadata,
  };
}
