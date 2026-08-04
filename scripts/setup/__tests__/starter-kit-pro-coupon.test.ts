import { describe, expect, it } from 'vitest';
import { promotionCodeCreateParams, STARTER_KIT_PRO_COUPON } from '../starter-kit-pro-coupon.js';

describe('STARTER_KIT_PRO_COUPON (GAP-434)', () => {
  it('locks the owner-ruled coupon and promo code ids', () => {
    expect(STARTER_KIT_PRO_COUPON.couponId).toBe('starter_kit_pro_month_1');
    expect(STARTER_KIT_PRO_COUPON.promotionCode).toBe('STARTERKITPRO1');
    expect(STARTER_KIT_PRO_COUPON.percentOff).toBe(100);
    expect(STARTER_KIT_PRO_COUPON.duration).toBe('once');
  });

  it('uses a human-readable promo code (no spaces, uppercase-friendly)', () => {
    expect(STARTER_KIT_PRO_COUPON.promotionCode).toMatch(/^[A-Z0-9_]+$/);
  });

  it('builds Stripe 22 nested promotion shape (not top-level coupon)', () => {
    const params = promotionCodeCreateParams('starter_kit_pro_month_1', 'STARTERKITPRO1', {
      revealui_gap: 'GAP-434',
    });
    expect(params).toEqual({
      promotion: { type: 'coupon', coupon: 'starter_kit_pro_month_1' },
      code: 'STARTERKITPRO1',
      metadata: { revealui_gap: 'GAP-434' },
    });
    // Top-level coupon is rejected by Stripe 22 ("Received unknown parameter: coupon").
    expect(params).not.toHaveProperty('coupon');
  });
});
