import { afterEach, describe, expect, it } from 'vitest';

import {
  buildCheckoutMetadata,
  getEarlyAdopterConfig,
  getEarlyAdopterDiscount,
  getMeterEventTimestamp,
  resolveUsageQuota,
} from '../pure.js';

const originalEnv = { ...process.env };

afterEach(() => {
  process.env = { ...originalEnv };
});

describe('getMeterEventTimestamp', () => {
  it('returns last second of 31-day months', () => {
    const ts = getMeterEventTimestamp(new Date(Date.UTC(2026, 0, 1)));
    expect(ts).toBe(Math.floor(Date.UTC(2026, 1, 1) / 1000) - 1);
  });

  it('handles February in a non-leap year', () => {
    const ts = getMeterEventTimestamp(new Date(Date.UTC(2026, 1, 1)));
    expect(ts).toBe(Math.floor(Date.UTC(2026, 2, 1) / 1000) - 1);
  });

  it('handles February in a leap year', () => {
    const ts = getMeterEventTimestamp(new Date(Date.UTC(2024, 1, 1)));
    expect(ts).toBe(Math.floor(Date.UTC(2024, 2, 1) / 1000) - 1);
  });
});

describe('getEarlyAdopterDiscount', () => {
  it('allows promotion codes when window is unset', () => {
    delete process.env.REVEALUI_EARLY_ADOPTER_END;
    expect(getEarlyAdopterDiscount('pro')).toEqual({ allow_promotion_codes: true });
  });

  it('returns coupon while window is open', () => {
    const cfg = getEarlyAdopterConfig({
      REVEALUI_EARLY_ADOPTER_END: '2099-01-01',
      REVEALUI_EARLY_ADOPTER_COUPON_PRO: 'EARLYPRO',
    });
    expect(getEarlyAdopterDiscount('pro', new Date('2026-01-01'), cfg)).toEqual({
      discounts: [{ coupon: 'EARLYPRO' }],
    });
  });
});

describe('resolveUsageQuota', () => {
  it('prefers entitlements maxAgentTasks', () => {
    expect(resolveUsageQuota({ limits: { maxAgentTasks: 42 } }, () => 7)).toBe(42);
  });

  it('falls back when quota missing', () => {
    expect(resolveUsageQuota(undefined, () => 7)).toBe(7);
  });
});

describe('buildCheckoutMetadata', () => {
  it('mirrors metadata onto payment_intent_data', () => {
    expect(buildCheckoutMetadata('pro', 'user-1', { interval: 'month' })).toEqual({
      metadata: { tier: 'pro', userId: 'user-1', interval: 'month' },
      payment_intent_data: {
        metadata: { tier: 'pro', userId: 'user-1', interval: 'month' },
      },
    });
  });
});
