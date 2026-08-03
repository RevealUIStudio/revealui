import { describe, expect, it } from 'vitest';
import { STARTER_KIT_PRO_COUPON } from '../starter-kit-pro-coupon.js';

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
});
