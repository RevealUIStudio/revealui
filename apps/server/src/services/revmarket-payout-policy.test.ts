import { describe, expect, it, vi } from 'vitest';
import {
  accrualForCompletedTask,
  executeWeeklySweep,
  isWeeklySweepDay,
  type PlannedPayout,
  payoutIdempotencyKey,
  planWeeklySweep,
  publisherShareCents,
  type SweepEarning,
  weekStartUtc,
} from './revmarket-payout-policy.js';

const MONDAY = new Date('2026-09-21T15:00:00.000Z');
const TUESDAY = new Date('2026-09-22T15:00:00.000Z');
const HOLD_MS = 7 * 24 * 60 * 60 * 1000;

function earning(
  overrides: Partial<SweepEarning> & Pick<SweepEarning, 'id' | 'publisherId'>,
): SweepEarning {
  return {
    amountUsdCents: 2500,
    status: 'accrued',
    payableAt: new Date(MONDAY.getTime() - 1000),
    stripeAccountId: 'acct_1',
    ...overrides,
  };
}

describe('publisher share', () => {
  it('accrues 80% of 1.00 USDC as 80 cents', () => {
    expect(publisherShareCents('1.00')).toBe(80);
  });

  it('accrues exactly $25 from 31.25 USDC', () => {
    expect(publisherShareCents('31.25')).toBe(2500);
  });

  it('floors fractional cents and ignores leading zeros', () => {
    expect(publisherShareCents('1.259')).toBe(100);
    expect(publisherShareCents('0001.50')).toBe(120);
  });

  it('accrues nothing for a missing, invalid, zero, or overflowing amount', () => {
    expect(publisherShareCents(null)).toBe(0);
    expect(publisherShareCents(undefined)).toBe(0);
    expect(publisherShareCents('')).toBe(0);
    expect(publisherShareCents('nope')).toBe(0);
    expect(publisherShareCents('0')).toBe(0);
    expect(publisherShareCents('999999999.99')).toBe(0);
  });

  it('does not accrue a failed task', () => {
    expect(
      accrualForCompletedTask({ success: false, costUsdc: '31.25', completedAt: MONDAY }),
    ).toBeNull();
  });

  it('records one immutable share payable 7 days after completion', () => {
    const completedAt = new Date('2026-09-16T12:00:00.000Z');
    const accrual = accrualForCompletedTask({ success: true, costUsdc: '10', completedAt });
    expect(accrual).toEqual({
      amountUsdCents: 800,
      payableAt: new Date(completedAt.getTime() + HOLD_MS),
    });
  });
});

describe('week boundary', () => {
  it('uses the Monday UTC date', () => {
    expect(weekStartUtc(new Date('2026-09-23T15:00:00.000Z'))).toBe('2026-09-21');
    expect(weekStartUtc(new Date('2026-09-21T00:00:00.000Z'))).toBe('2026-09-21');
    expect(weekStartUtc(new Date('2026-09-20T23:00:00.000Z'))).toBe('2026-09-14');
  });

  it('sweeps on Monday UTC only', () => {
    expect(isWeeklySweepDay(MONDAY)).toBe(true);
    expect(isWeeklySweepDay(TUESDAY)).toBe(false);
  });
});

describe('planWeeklySweep', () => {
  it('skips a publisher under $25', () => {
    const plan = planWeeklySweep({
      now: MONDAY,
      bridgedUsdCents: 100_000,
      earnings: [earning({ id: 'e1', publisherId: 'pub-a', amountUsdCents: 2499 })],
    });
    expect(plan.payouts).toEqual([]);
    expect(plan.skippedBelowMinimum).toEqual(['pub-a']);
    expect(plan.conversionCalls).toBe(0);
  });

  it('pays a publisher at $25 when bridged USD covers the payout', () => {
    const plan = planWeeklySweep({
      now: MONDAY,
      bridgedUsdCents: 2500,
      earnings: [earning({ id: 'e1', publisherId: 'pub-a', amountUsdCents: 2500 })],
    });
    expect(plan.payouts).toEqual([
      {
        publisherId: 'pub-a',
        stripeAccountId: 'acct_1',
        earningIds: ['e1'],
        amountUsdCents: 2500,
      },
    ]);
    expect(plan.conversionCalls).toBe(1);
  });

  it('sums multiple accrued earnings for the same publisher', () => {
    const plan = planWeeklySweep({
      now: MONDAY,
      bridgedUsdCents: 3000,
      earnings: [
        earning({ id: 'e2', publisherId: 'pub-a', amountUsdCents: 1500 }),
        earning({ id: 'e1', publisherId: 'pub-a', amountUsdCents: 1000 }),
      ],
    });
    expect(plan.payouts[0]?.amountUsdCents).toBe(2500);
    expect(plan.payouts[0]?.earningIds).toEqual(['e1', 'e2']);
  });

  it('pays publisher-id order and stops when the next payout does not fit', () => {
    const plan = planWeeklySweep({
      now: MONDAY,
      bridgedUsdCents: 3000,
      earnings: [
        earning({ id: 'b', publisherId: 'pub-b', amountUsdCents: 2500, stripeAccountId: 'acct_b' }),
        earning({ id: 'a', publisherId: 'pub-a', amountUsdCents: 2500, stripeAccountId: 'acct_a' }),
      ],
    });
    expect(plan.payouts.map((payout) => payout.publisherId)).toEqual(['pub-a']);
  });

  it('pays nobody when bridged USD is zero', () => {
    const plan = planWeeklySweep({
      now: MONDAY,
      bridgedUsdCents: 0,
      earnings: [earning({ id: 'e1', publisherId: 'pub-a' })],
    });
    expect(plan.payouts).toEqual([]);
    expect(plan.conversionCalls).toBe(1);
  });

  it('ignores earnings that are not yet payable or not accrued', () => {
    const plan = planWeeklySweep({
      now: MONDAY,
      bridgedUsdCents: 100_000,
      earnings: [
        earning({
          id: 'future',
          publisherId: 'pub-future',
          payableAt: new Date(MONDAY.getTime() + 1000),
        }),
        earning({ id: 'held', publisherId: 'pub-held', status: 'held_for_dispute' }),
        earning({ id: 'paid', publisherId: 'pub-paid', status: 'paid' }),
        earning({ id: 'dropped', publisherId: 'pub-dropped', status: 'dropped' }),
      ],
    });
    expect(plan.payouts).toEqual([]);
    expect(plan.conversionCalls).toBe(0);
  });

  it('skips a publisher with no Connect account', () => {
    const plan = planWeeklySweep({
      now: MONDAY,
      bridgedUsdCents: 100_000,
      earnings: [earning({ id: 'e1', publisherId: 'pub-a', stripeAccountId: null })],
    });
    expect(plan.payouts).toEqual([]);
    expect(plan.skippedBelowMinimum).toEqual([]);
  });

  it('skips a publisher whose earnings point at two Connect accounts', () => {
    const plan = planWeeklySweep({
      now: MONDAY,
      bridgedUsdCents: 100_000,
      earnings: [
        earning({
          id: 'e1',
          publisherId: 'pub-a',
          stripeAccountId: 'acct_1',
          amountUsdCents: 2000,
        }),
        earning({
          id: 'e2',
          publisherId: 'pub-a',
          stripeAccountId: 'acct_2',
          amountUsdCents: 2000,
        }),
      ],
    });
    expect(plan.payouts).toEqual([]);
    expect(plan.skippedConflict).toEqual(['pub-a']);
    expect(plan.conversionCalls).toBe(0);
  });
});

describe('payout idempotency key', () => {
  it('is stable when earning ids arrive in a different order', () => {
    const left = payoutIdempotencyKey('pub-a', '2026-09-21', ['e2', 'e1']);
    const right = payoutIdempotencyKey('pub-a', '2026-09-21', ['e1', 'e2']);
    expect(left).toBe(right);
    expect(left.startsWith('revmarket-payout-pub-a-2026-09-21-')).toBe(true);
  });
});

describe('executeWeeklySweep', () => {
  function deps(earnings: SweepEarning[], bridgedUsdCents: number) {
    const loadEligible = vi.fn(async () => earnings);
    const readBridgedUsdCents = vi.fn(async () => bridgedUsdCents);
    const transfer = vi.fn(async (payout: PlannedPayout) => ({
      transferId: `tr_${payout.publisherId}`,
    }));
    const markPaid = vi.fn(async () => undefined);
    const markFailed = vi.fn(async () => undefined);
    return { loadEligible, readBridgedUsdCents, transfer, markPaid, markFailed };
  }

  it('does not load earnings or read Stripe on a non-Monday', async () => {
    const adapters = deps([earning({ id: 'e1', publisherId: 'pub-a' })], 10_000);
    const result = await executeWeeklySweep({ now: TUESDAY, ...adapters });
    expect(result.reason).toBe('not-monday');
    expect(result.conversionCalls).toBe(0);
    expect(adapters.loadEligible).not.toHaveBeenCalled();
    expect(adapters.readBridgedUsdCents).not.toHaveBeenCalled();
    expect(adapters.transfer).not.toHaveBeenCalled();
  });

  it('runs on a non-Monday when forced', async () => {
    const adapters = deps([earning({ id: 'e1', publisherId: 'pub-a' })], 2500);
    const result = await executeWeeklySweep({ now: TUESDAY, force: true, ...adapters });
    expect(result.reason).toBe('swept');
    expect(result.paid).toHaveLength(1);
    expect(adapters.readBridgedUsdCents).toHaveBeenCalledTimes(1);
  });

  it('does not read Stripe when nobody meets $25', async () => {
    const adapters = deps(
      [earning({ id: 'e1', publisherId: 'pub-a', amountUsdCents: 100 })],
      10_000,
    );
    const result = await executeWeeklySweep({ now: MONDAY, ...adapters });
    expect(result.reason).toBe('none-eligible');
    expect(result.conversionCalls).toBe(0);
    expect(adapters.readBridgedUsdCents).not.toHaveBeenCalled();
  });

  it('reads bridged USD once for two publishers and pays both', async () => {
    const adapters = deps(
      [
        earning({ id: 'a', publisherId: 'pub-a', stripeAccountId: 'acct_a' }),
        earning({ id: 'b', publisherId: 'pub-b', stripeAccountId: 'acct_b' }),
      ],
      10_000,
    );
    const result = await executeWeeklySweep({ now: MONDAY, ...adapters });
    expect(adapters.readBridgedUsdCents).toHaveBeenCalledTimes(1);
    expect(result.conversionCalls).toBe(1);
    expect(adapters.transfer).toHaveBeenCalledTimes(2);
    expect(result.paid.map((payout) => payout.transferId)).toEqual(['tr_pub-a', 'tr_pub-b']);
    expect(adapters.markPaid).toHaveBeenCalledTimes(2);
    expect(adapters.markFailed).not.toHaveBeenCalled();
  });

  it('releases earnings when the transfer fails', async () => {
    const adapters = deps([earning({ id: 'e1', publisherId: 'pub-a' })], 2500);
    adapters.transfer.mockRejectedValueOnce(new Error('stripe down'));
    const result = await executeWeeklySweep({ now: MONDAY, ...adapters });
    expect(result.paid).toEqual([]);
    expect(result.failed).toEqual([{ publisherId: 'pub-a', error: 'stripe down' }]);
    expect(adapters.markFailed).toHaveBeenCalledTimes(1);
    expect(adapters.markPaid).not.toHaveBeenCalled();
    expect(adapters.readBridgedUsdCents).toHaveBeenCalledTimes(1);
  });

  it('does not release earnings when Stripe already transferred and the ledger write fails', async () => {
    const adapters = deps([earning({ id: 'e1', publisherId: 'pub-a' })], 2500);
    adapters.markPaid.mockRejectedValueOnce(new Error('db down'));
    const result = await executeWeeklySweep({ now: MONDAY, ...adapters });
    expect(adapters.markFailed).not.toHaveBeenCalled();
    expect(result.failed[0]?.error).toContain('unmarked-after-transfer');
  });
});
