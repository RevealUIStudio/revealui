import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Chainable mock DB — every method returns `chain` so any Drizzle query order works.
let queryResult: unknown[] = [];

const chain: Record<string, ReturnType<typeof vi.fn>> = {};
chain.select = vi.fn(() => chain);
chain.from = vi.fn(() => chain);
chain.where = vi.fn(() => chain);
chain.orderBy = vi.fn(() => chain);
chain.limit = vi.fn(() => chain);
chain.values = vi.fn(() => Promise.resolve());
chain.insert = vi.fn(() => chain);

// Make chain thenable so `await db.select().from()...` resolves to queryResult
chain.then = vi.fn((resolve: (v: unknown) => void) => resolve(queryResult));

vi.mock('@revealui/db', () => ({
  getClient: vi.fn(() => chain),
}));

vi.mock('@revealui/db/schema', () => ({
  revealcoinPayments: {
    id: 'id',
    txSignature: 'txSignature',
    walletAddress: 'walletAddress',
    userId: 'userId',
    amountRvui: 'amountRvui',
    amountUsd: 'amountUsd',
    discountUsd: 'discountUsd',
    purpose: 'purpose',
    status: 'status',
    createdAt: 'createdAt',
  },
  revealcoinPriceSnapshots: {
    id: 'id',
    priceUsd: 'priceUsd',
    source: 'source',
    recordedAt: 'recordedAt',
  },
}));

vi.mock('drizzle-orm', () => ({
  and: vi.fn((...args: unknown[]) => args),
  desc: vi.fn((col: unknown) => `desc(${String(col)})`),
  eq: vi.fn((col: unknown, val: unknown) => `eq(${String(col)},${String(val)})`),
  gte: vi.fn((col: unknown, val: unknown) => `gte(${String(col)},${String(val)})`),
  sql: vi.fn(),
}));

vi.mock('@revealui/core/observability/logger', () => ({
  createLogger: () => ({
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  }),
}));

import {
  configureSafeguards,
  getSafeguardsConfig,
  getTwapPrice,
  isDiscountCapExceeded,
  isDuplicateTransaction,
  isPaymentOverMaximum,
  isPriceCircuitBreakerOpen,
  isWalletRateLimited,
  recordPayment,
  recordPriceSnapshot,
  resetSafeguardsConfig,
  validatePayment,
} from '../safeguards.js';

describe('SafeguardsConfig', () => {
  afterEach(() => {
    resetSafeguardsConfig();
  });

  it('returns default config', () => {
    const config = getSafeguardsConfig();
    expect(config.twapWindowMs).toBe(3_600_000);
    expect(config.priceCircuitBreakerThreshold).toBe(0.3);
    expect(config.maxPaymentsPerWalletPerHour).toBe(3);
    expect(config.maxSinglePaymentUsd).toBe(500);
    expect(config.maxMonthlyDiscountUsd).toBe(100);
  });

  it('overrides config', () => {
    configureSafeguards({ maxSinglePaymentUsd: 200, maxPaymentsPerWalletPerHour: 5 });
    const config = getSafeguardsConfig();
    expect(config.maxSinglePaymentUsd).toBe(200);
    expect(config.maxPaymentsPerWalletPerHour).toBe(5);
    expect(config.twapWindowMs).toBe(3_600_000); // unchanged
  });

  it('resets to defaults', () => {
    configureSafeguards({ maxSinglePaymentUsd: 1 });
    resetSafeguardsConfig();
    expect(getSafeguardsConfig().maxSinglePaymentUsd).toBe(500);
  });

  it('returns a copy (not mutable reference)', () => {
    const a = getSafeguardsConfig();
    const b = getSafeguardsConfig();
    expect(a).not.toBe(b);
    expect(a).toEqual(b);
  });
});

describe('isPaymentOverMaximum', () => {
  afterEach(() => resetSafeguardsConfig());

  it('returns false for amounts under cap', () => {
    expect(isPaymentOverMaximum(499)).toBe(false);
  });

  it('returns false for amounts at cap', () => {
    expect(isPaymentOverMaximum(500)).toBe(false);
  });

  it('returns true for amounts over cap', () => {
    expect(isPaymentOverMaximum(501)).toBe(true);
  });

  it('respects configured cap', () => {
    configureSafeguards({ maxSinglePaymentUsd: 100 });
    expect(isPaymentOverMaximum(101)).toBe(true);
    expect(isPaymentOverMaximum(100)).toBe(false);
  });
});

describe('getTwapPrice', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Re-bind chain methods after clearAllMocks
    chain.select = vi.fn(() => chain);
    chain.from = vi.fn(() => chain);
    chain.where = vi.fn(() => chain);
    chain.orderBy = vi.fn(() => chain);
    chain.limit = vi.fn(() => chain);
  });

  it('returns null with fewer than 2 snapshots', async () => {
    queryResult = [];
    chain.then = vi.fn((resolve: (v: unknown) => void) => resolve(queryResult));
    const result = await getTwapPrice();
    expect(result).toBeNull();
  });

  it('returns null with exactly 1 snapshot', async () => {
    queryResult = [{ priceUsd: '0.005', recordedAt: new Date() }];
    chain.then = vi.fn((resolve: (v: unknown) => void) => resolve(queryResult));
    const result = await getTwapPrice();
    expect(result).toBeNull();
  });

  it('calculates time-weighted average with 2 snapshots', async () => {
    const now = Date.now();
    queryResult = [
      { priceUsd: '0.004', recordedAt: new Date(now - 60_000) },
      { priceUsd: '0.006', recordedAt: new Date(now) },
    ];
    chain.then = vi.fn((resolve: (v: unknown) => void) => resolve(queryResult));

    const result = await getTwapPrice();
    expect(result).not.toBeNull();
    // Only 1 interval: price 0.004 for 60s → TWAP = 0.004
    expect(result).toBeCloseTo(0.004, 6);
  });

  it('calculates time-weighted average with 3 snapshots', async () => {
    const now = Date.now();
    queryResult = [
      { priceUsd: '0.004', recordedAt: new Date(now - 120_000) },
      { priceUsd: '0.006', recordedAt: new Date(now - 60_000) },
      { priceUsd: '0.008', recordedAt: new Date(now) },
    ];
    chain.then = vi.fn((resolve: (v: unknown) => void) => resolve(queryResult));

    const result = await getTwapPrice();
    expect(result).not.toBeNull();
    // TWAP: (0.004 * 60000 + 0.006 * 60000) / 120000 = 0.005
    expect(result).toBeCloseTo(0.005, 6);
  });

  it('returns null when total duration is 0', async () => {
    const now = Date.now();
    const sameTime = new Date(now);
    queryResult = [
      { priceUsd: '0.004', recordedAt: sameTime },
      { priceUsd: '0.006', recordedAt: sameTime },
    ];
    chain.then = vi.fn((resolve: (v: unknown) => void) => resolve(queryResult));

    const result = await getTwapPrice();
    expect(result).toBeNull();
  });
});

describe('isDuplicateTransaction', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    chain.select = vi.fn(() => chain);
    chain.from = vi.fn(() => chain);
    chain.where = vi.fn(() => chain);
    chain.limit = vi.fn(() => chain);
  });

  it('returns false for new transaction', async () => {
    queryResult = [];
    chain.then = vi.fn((resolve: (v: unknown) => void) => resolve(queryResult));
    const result = await isDuplicateTransaction('new-tx-sig');
    expect(result).toBe(false);
  });

  it('returns true for existing transaction', async () => {
    queryResult = [{ id: 'existing-payment-id' }];
    chain.then = vi.fn((resolve: (v: unknown) => void) => resolve(queryResult));
    const result = await isDuplicateTransaction('existing-tx-sig');
    expect(result).toBe(true);
  });
});

describe('isWalletRateLimited', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetSafeguardsConfig();
    chain.select = vi.fn(() => chain);
    chain.from = vi.fn(() => chain);
    chain.where = vi.fn(() => chain);
  });

  it('returns false when under limit', async () => {
    queryResult = [{ count: 2 }];
    chain.then = vi.fn((resolve: (v: unknown) => void) => resolve(queryResult));
    const result = await isWalletRateLimited('wallet-abc');
    expect(result).toBe(false);
  });

  it('returns true when at limit', async () => {
    queryResult = [{ count: 3 }];
    chain.then = vi.fn((resolve: (v: unknown) => void) => resolve(queryResult));
    const result = await isWalletRateLimited('wallet-abc');
    expect(result).toBe(true);
  });

  it('returns true when over limit', async () => {
    queryResult = [{ count: 5 }];
    chain.then = vi.fn((resolve: (v: unknown) => void) => resolve(queryResult));
    const result = await isWalletRateLimited('wallet-abc');
    expect(result).toBe(true);
  });

  it('returns false when result is empty (no payments)', async () => {
    queryResult = [{ count: 0 }];
    chain.then = vi.fn((resolve: (v: unknown) => void) => resolve(queryResult));
    const result = await isWalletRateLimited('wallet-abc');
    expect(result).toBe(false);
  });
});

describe('isDiscountCapExceeded', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetSafeguardsConfig();
    chain.select = vi.fn(() => chain);
    chain.from = vi.fn(() => chain);
    chain.where = vi.fn(() => chain);
  });

  it('returns false when under cap', async () => {
    queryResult = [{ total: 50 }];
    chain.then = vi.fn((resolve: (v: unknown) => void) => resolve(queryResult));
    const result = await isDiscountCapExceeded('user-1');
    expect(result).toBe(false);
  });

  it('returns true when at cap', async () => {
    queryResult = [{ total: 100 }];
    chain.then = vi.fn((resolve: (v: unknown) => void) => resolve(queryResult));
    const result = await isDiscountCapExceeded('user-1');
    expect(result).toBe(true);
  });

  it('returns true when over cap', async () => {
    queryResult = [{ total: 150 }];
    chain.then = vi.fn((resolve: (v: unknown) => void) => resolve(queryResult));
    const result = await isDiscountCapExceeded('user-1');
    expect(result).toBe(true);
  });

  it('returns false when no discounts yet', async () => {
    queryResult = [{ total: 0 }];
    chain.then = vi.fn((resolve: (v: unknown) => void) => resolve(queryResult));
    const result = await isDiscountCapExceeded('user-1');
    expect(result).toBe(false);
  });

  it('respects configured cap', async () => {
    configureSafeguards({ maxMonthlyDiscountUsd: 50 });
    queryResult = [{ total: 50 }];
    chain.then = vi.fn((resolve: (v: unknown) => void) => resolve(queryResult));
    const result = await isDiscountCapExceeded('user-1');
    expect(result).toBe(true);
  });
});

describe('recordPriceSnapshot', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    chain.insert = vi.fn(() => chain);
    chain.values = vi.fn(() => Promise.resolve());
  });

  it('inserts a snapshot record', async () => {
    await recordPriceSnapshot(0.0042, 'jupiter-v3');
    expect(chain.insert).toHaveBeenCalled();
    expect(chain.values).toHaveBeenCalledWith(
      expect.objectContaining({
        priceUsd: '0.0042',
        source: 'jupiter-v3',
      }),
    );
  });
});

describe('recordPayment', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    chain.insert = vi.fn(() => chain);
    chain.values = vi.fn(() => Promise.resolve());
  });

  it('inserts a payment record with all fields', async () => {
    await recordPayment({
      txSignature: 'tx-sig-123',
      walletAddress: 'wallet-abc',
      userId: 'user-1',
      amountRvui: '1000000000',
      amountUsd: 4.2,
      discountUsd: 0.63,
      purpose: 'subscription',
    });

    expect(chain.insert).toHaveBeenCalled();
    expect(chain.values).toHaveBeenCalledWith(
      expect.objectContaining({
        txSignature: 'tx-sig-123',
        walletAddress: 'wallet-abc',
        userId: 'user-1',
        amountRvui: '1000000000',
        amountUsd: '4.2',
        discountUsd: '0.63',
        purpose: 'subscription',
        status: 'verified',
      }),
    );
  });
});

// ---------------------------------------------------------------------------
// TWAP — Extended Scenarios
// ---------------------------------------------------------------------------
describe('getTwapPrice — extended', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    chain.select = vi.fn(() => chain);
    chain.from = vi.fn(() => chain);
    chain.where = vi.fn(() => chain);
    chain.orderBy = vi.fn(() => chain);
    chain.limit = vi.fn(() => chain);
  });

  it('calculates TWAP correctly with many snapshots (simulated 1-hour polling)', async () => {
    const now = Date.now();
    // 60 snapshots over 1 hour — price ramps from 0.004 to 0.006
    const snapshots = Array.from({ length: 60 }, (_, i) => ({
      priceUsd: String(0.004 + (i / 59) * 0.002),
      recordedAt: new Date(now - (59 - i) * 60_000),
    }));
    queryResult = snapshots;
    chain.then = vi.fn((resolve: (v: unknown) => void) => resolve(queryResult));

    const result = await getTwapPrice();
    expect(result).not.toBeNull();
    // Linear ramp: TWAP should be close to midpoint (0.005)
    expect(result!).toBeCloseTo(0.005, 3);
  });

  it('handles price spike correctly (weights by duration)', async () => {
    const now = Date.now();
    // Price is stable at 0.005, then spikes to 0.050 for the last minute
    queryResult = [
      { priceUsd: '0.005', recordedAt: new Date(now - 600_000) }, // t=-10min
      { priceUsd: '0.005', recordedAt: new Date(now - 300_000) }, // t=-5min
      { priceUsd: '0.005', recordedAt: new Date(now - 60_000) }, // t=-1min
      { priceUsd: '0.050', recordedAt: new Date(now) }, // spike at end
    ];
    chain.then = vi.fn((resolve: (v: unknown) => void) => resolve(queryResult));

    const result = await getTwapPrice();
    expect(result).not.toBeNull();
    // 0.005 * 300s + 0.005 * 240s + 0.005 * 60s = 0.005 * 600s / 600s = 0.005
    // The spike at the end is the LAST snapshot, so it's not weighted
    expect(result!).toBeCloseTo(0.005, 6);
  });

  it('handles uniform price (all snapshots same value)', async () => {
    const now = Date.now();
    queryResult = [
      { priceUsd: '0.010', recordedAt: new Date(now - 180_000) },
      { priceUsd: '0.010', recordedAt: new Date(now - 120_000) },
      { priceUsd: '0.010', recordedAt: new Date(now - 60_000) },
      { priceUsd: '0.010', recordedAt: new Date(now) },
    ];
    chain.then = vi.fn((resolve: (v: unknown) => void) => resolve(queryResult));

    const result = await getTwapPrice();
    expect(result).toBe(0.01);
  });
});

// ---------------------------------------------------------------------------
// isPriceCircuitBreakerOpen
// ---------------------------------------------------------------------------
describe('isPriceCircuitBreakerOpen', () => {
  // This function makes 2 DB calls:
  // 1. db.select().from().orderBy().limit(1) — latest snapshot
  // 2. getTwapPrice() — db.select().from().where().orderBy() — all snapshots in window
  //
  // We need to return different data for each call. We do this by making
  // chain.then return different values on sequential calls.

  beforeEach(() => {
    vi.clearAllMocks();
    resetSafeguardsConfig();
    chain.select = vi.fn(() => chain);
    chain.from = vi.fn(() => chain);
    chain.where = vi.fn(() => chain);
    chain.orderBy = vi.fn(() => chain);
    chain.limit = vi.fn(() => chain);
  });

  it('returns true when no price data exists', async () => {
    queryResult = [];
    chain.then = vi.fn((resolve: (v: unknown) => void) => resolve(queryResult));

    const result = await isPriceCircuitBreakerOpen();
    expect(result).toBe(true);
  });

  it('returns true when TWAP is unavailable (only 1 snapshot)', async () => {
    const now = Date.now();
    const snapshot = { priceUsd: '0.005', recordedAt: new Date(now) };

    // First call: latest snapshot → returns [snapshot]
    // Second call: TWAP query → returns [snapshot] (only 1 = insufficient)
    let callCount = 0;
    chain.then = vi.fn((resolve: (v: unknown) => void) => {
      callCount++;
      if (callCount === 1)
        resolve([snapshot]); // latest
      else resolve([snapshot]); // TWAP — 1 snapshot, returns null
    });

    const result = await isPriceCircuitBreakerOpen();
    expect(result).toBe(true);
  });

  it('returns false when price is stable', async () => {
    const now = Date.now();
    const latest = { priceUsd: '0.005', recordedAt: new Date(now) };
    const snapshots = [
      { priceUsd: '0.005', recordedAt: new Date(now - 120_000) },
      { priceUsd: '0.005', recordedAt: new Date(now - 60_000) },
      { priceUsd: '0.005', recordedAt: new Date(now) },
    ];

    let callCount = 0;
    chain.then = vi.fn((resolve: (v: unknown) => void) => {
      callCount++;
      if (callCount === 1) resolve([latest]);
      else resolve(snapshots);
    });

    const result = await isPriceCircuitBreakerOpen();
    expect(result).toBe(false);
  });

  it('returns true when price drops 30% or more below TWAP', async () => {
    const now = Date.now();
    // TWAP is 0.010, latest price is 0.006 → 40% drop → circuit breaker open
    const latest = { priceUsd: '0.006', recordedAt: new Date(now) };
    const snapshots = [
      { priceUsd: '0.010', recordedAt: new Date(now - 120_000) },
      { priceUsd: '0.010', recordedAt: new Date(now - 60_000) },
      { priceUsd: '0.006', recordedAt: new Date(now) },
    ];

    let callCount = 0;
    chain.then = vi.fn((resolve: (v: unknown) => void) => {
      callCount++;
      if (callCount === 1) resolve([latest]);
      else resolve(snapshots);
    });

    const result = await isPriceCircuitBreakerOpen();
    expect(result).toBe(true);
  });

  it('returns false when price drop is under threshold', async () => {
    const now = Date.now();
    // TWAP is 0.010, latest is 0.008 → 20% drop → under 30% threshold
    const latest = { priceUsd: '0.008', recordedAt: new Date(now) };
    const snapshots = [
      { priceUsd: '0.010', recordedAt: new Date(now - 120_000) },
      { priceUsd: '0.010', recordedAt: new Date(now - 60_000) },
      { priceUsd: '0.008', recordedAt: new Date(now) },
    ];

    let callCount = 0;
    chain.then = vi.fn((resolve: (v: unknown) => void) => {
      callCount++;
      if (callCount === 1) resolve([latest]);
      else resolve(snapshots);
    });

    const result = await isPriceCircuitBreakerOpen();
    expect(result).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// validatePayment (composite safeguard check)
// ---------------------------------------------------------------------------
describe('validatePayment', () => {
  const baseParams = {
    walletAddress: 'wallet-abc',
    userId: 'user-1',
    txSignature: 'unique-tx-sig',
    amountUsd: 100,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    resetSafeguardsConfig();
    chain.select = vi.fn(() => chain);
    chain.from = vi.fn(() => chain);
    chain.where = vi.fn(() => chain);
    chain.orderBy = vi.fn(() => chain);
    chain.limit = vi.fn(() => chain);
  });

  it('rejects duplicate transactions first', async () => {
    // isDuplicateTransaction → [{ id: 'existing' }] → true
    queryResult = [{ id: 'existing' }];
    chain.then = vi.fn((resolve: (v: unknown) => void) => resolve(queryResult));

    const result = await validatePayment(baseParams);
    expect(result.allowed).toBe(false);
    expect(result.reason).toContain('already used');
  });

  it('rejects when payment exceeds maximum', async () => {
    // isDuplicateTransaction → [] → false
    // isPriceCircuitBreakerOpen → needs data (we'll return stable price)
    // isPaymentOverMaximum → amountUsd > 500

    let callCount = 0;
    chain.then = vi.fn((resolve: (v: unknown) => void) => {
      callCount++;
      if (callCount === 1)
        resolve([]); // duplicate check: not duplicate
      else if (callCount === 2)
        resolve([]); // circuit breaker: no data → open
      // Circuit breaker returns true (no data) → but validatePayment checks
      // it after duplicate, so this will fail on circuit breaker first
      else resolve([]);
    });

    // Since circuit breaker will be open (no price data), let's test with
    // enough price data to pass the circuit breaker, then a high amount
    const now = Date.now();
    const stableSnapshots = [
      { priceUsd: '0.01', recordedAt: new Date(now - 120_000) },
      { priceUsd: '0.01', recordedAt: new Date(now - 60_000) },
      { priceUsd: '0.01', recordedAt: new Date(now) },
    ];

    callCount = 0;
    chain.then = vi.fn((resolve: (v: unknown) => void) => {
      callCount++;
      if (callCount === 1) resolve([]); // duplicate: not found
      if (callCount === 2) resolve([stableSnapshots[2]]); // latest snapshot
      if (callCount === 3) resolve(stableSnapshots); // TWAP snapshots
      if (callCount === 4) resolve([{ count: 0 }]); // rate limit
      if (callCount === 5) resolve([{ total: 0 }]); // discount cap
    });

    const result = await validatePayment({ ...baseParams, amountUsd: 501 });
    expect(result.allowed).toBe(false);
    expect(result.reason).toContain('exceeds maximum');
  });

  it('rejects when wallet is rate limited', async () => {
    const now = Date.now();
    const stableSnapshots = [
      { priceUsd: '0.01', recordedAt: new Date(now - 120_000) },
      { priceUsd: '0.01', recordedAt: new Date(now - 60_000) },
      { priceUsd: '0.01', recordedAt: new Date(now) },
    ];

    let callCount = 0;
    chain.then = vi.fn((resolve: (v: unknown) => void) => {
      callCount++;
      if (callCount === 1) resolve([]); // duplicate: not found
      if (callCount === 2) resolve([stableSnapshots[2]]); // latest
      if (callCount === 3) resolve(stableSnapshots); // TWAP
      if (callCount === 4) resolve([{ count: 3 }]); // rate limited!
    });

    const result = await validatePayment(baseParams);
    expect(result.allowed).toBe(false);
    expect(result.reason).toContain('rate limit');
  });

  it('allows valid payment when all checks pass', async () => {
    const now = Date.now();
    const stableSnapshots = [
      { priceUsd: '0.01', recordedAt: new Date(now - 120_000) },
      { priceUsd: '0.01', recordedAt: new Date(now - 60_000) },
      { priceUsd: '0.01', recordedAt: new Date(now) },
    ];

    let callCount = 0;
    chain.then = vi.fn((resolve: (v: unknown) => void) => {
      callCount++;
      if (callCount === 1) resolve([]); // duplicate: not found
      if (callCount === 2) resolve([stableSnapshots[2]]); // latest
      if (callCount === 3) resolve(stableSnapshots); // TWAP
      if (callCount === 4) resolve([{ count: 0 }]); // rate limit: under
      if (callCount === 5) resolve([{ total: 0 }]); // discount cap: under
    });

    const result = await validatePayment(baseParams);
    expect(result.allowed).toBe(true);
  });
});
