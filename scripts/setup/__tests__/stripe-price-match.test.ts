import { describe, expect, it } from 'vitest';
import {
  type MatchablePrice,
  type PriceDefinition,
  priceMatchesDefinition,
  priceSharesHandle,
} from '../stripe-price-match.js';

const proMonthly: PriceDefinition = {
  key: 'revealui_pro_monthly',
  unitAmount: 4900,
  currency: 'usd',
  mode: 'subscription',
  interval: 'month',
};

const proPerpetual: PriceDefinition = {
  key: 'revealui_pro_perpetual',
  unitAmount: 29900,
  currency: 'usd',
  mode: 'payment',
};

/** Build a MatchablePrice shaped like proMonthly, overridable per test. */
function price(overrides: Partial<MatchablePrice> = {}): MatchablePrice {
  return {
    lookup_key: null,
    metadata: {},
    unit_amount: 4900,
    currency: 'usd',
    recurring: { interval: 'month' },
    ...overrides,
  };
}

describe('priceSharesHandle', () => {
  it('matches by lookup_key', () => {
    expect(priceSharesHandle(price({ lookup_key: 'revealui_pro_monthly' }), proMonthly)).toBe(true);
  });

  it('matches by the legacy metadata key (pre-lookup_key prices)', () => {
    expect(
      priceSharesHandle(
        price({ lookup_key: null, metadata: { revealui_price_key: 'revealui_pro_monthly' } }),
        proMonthly,
      ),
    ).toBe(true);
  });

  it('does not match a different handle', () => {
    expect(
      priceSharesHandle(
        price({
          lookup_key: 'revealui_max_monthly',
          metadata: { revealui_price_key: 'revealui_max_monthly' },
        }),
        proMonthly,
      ),
    ).toBe(false);
  });

  it('tolerates null metadata', () => {
    expect(priceSharesHandle(price({ lookup_key: null, metadata: null }), proMonthly)).toBe(false);
  });
});

describe('priceMatchesDefinition', () => {
  it('matches when handle, amount, currency, and interval all agree', () => {
    expect(priceMatchesDefinition(price({ lookup_key: 'revealui_pro_monthly' }), proMonthly)).toBe(
      true,
    );
  });

  it('matches a metadata-only price during the migration', () => {
    expect(
      priceMatchesDefinition(
        price({ lookup_key: null, metadata: { revealui_price_key: 'revealui_pro_monthly' } }),
        proMonthly,
      ),
    ).toBe(true);
  });

  it('rejects on amount drift (forces archive + recreate)', () => {
    expect(
      priceMatchesDefinition(
        price({ lookup_key: 'revealui_pro_monthly', unit_amount: 5900 }),
        proMonthly,
      ),
    ).toBe(false);
  });

  it('rejects on interval drift', () => {
    expect(
      priceMatchesDefinition(
        price({ lookup_key: 'revealui_pro_monthly', recurring: { interval: 'year' } }),
        proMonthly,
      ),
    ).toBe(false);
  });

  it('rejects on currency drift', () => {
    expect(
      priceMatchesDefinition(
        price({ lookup_key: 'revealui_pro_monthly', currency: 'eur' }),
        proMonthly,
      ),
    ).toBe(false);
  });

  it('matches a one-time price only when it is not recurring', () => {
    expect(
      priceMatchesDefinition(
        price({ lookup_key: 'revealui_pro_perpetual', unit_amount: 29900, recurring: null }),
        proPerpetual,
      ),
    ).toBe(true);
    expect(
      priceMatchesDefinition(
        price({
          lookup_key: 'revealui_pro_perpetual',
          unit_amount: 29900,
          recurring: { interval: 'month' },
        }),
        proPerpetual,
      ),
    ).toBe(false);
  });

  it('rejects when neither handle matches even if amount agrees', () => {
    expect(priceMatchesDefinition(price({ lookup_key: 'other', metadata: {} }), proMonthly)).toBe(
      false,
    );
  });

  it('matches a metered overage price only when usage_type is metered (GAP-212)', () => {
    const overage: PriceDefinition = {
      key: 'revealui_pro_task_overage',
      unitAmount: 5,
      currency: 'usd',
      mode: 'metered',
      interval: 'month',
    };
    expect(
      priceMatchesDefinition(
        price({
          lookup_key: 'revealui_pro_task_overage',
          unit_amount: 5,
          recurring: { interval: 'month', usage_type: 'metered' },
        }),
        overage,
      ),
    ).toBe(true);
    expect(
      priceMatchesDefinition(
        price({
          lookup_key: 'revealui_pro_task_overage',
          unit_amount: 5,
          recurring: { interval: 'month', usage_type: 'licensed' },
        }),
        overage,
      ),
    ).toBe(false);
  });

  it('still matches licensed subscription when usage_type is absent (legacy Stripe prices)', () => {
    expect(
      priceMatchesDefinition(
        price({ lookup_key: 'revealui_pro_monthly', recurring: { interval: 'month' } }),
        proMonthly,
      ),
    ).toBe(true);
  });
});
