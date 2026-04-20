/**
 * Tests for seat-count-guard.ts (#397 / CR8-P2-03).
 *
 * Covers the three behavioral branches of assertSeatAvailable:
 *   1. Unlimited (maxUsers == null) — no DB read, resolves.
 *   2. Under cap — resolves.
 *   3. At or over cap — throws SeatLimitReachedError with structured fields.
 *
 * Concurrency (two-request race) is not covered here — that's the DB-trigger
 * follow-up that lands in a separate PR.
 */

import { describe, expect, it, vi } from 'vitest';
import { assertSeatAvailable, SeatLimitReachedError } from '../seat-count-guard.js';

// Minimal Drizzle-shaped mock: select().from().where() returning the result.
function makeDbMock(currentCount: number | null) {
  const where = vi.fn().mockResolvedValue(currentCount === null ? [] : [{ count: currentCount }]);
  const from = vi.fn().mockReturnValue({ where });
  const select = vi.fn().mockReturnValue({ from });
  return { select, from, where };
}

describe('assertSeatAvailable', () => {
  it('no-ops when maxUsers is null (enterprise / unlimited)', async () => {
    const mock = makeDbMock(999);
    await expect(assertSeatAvailable(mock, 'acct-x', null)).resolves.toBeUndefined();
    expect(mock.select).not.toHaveBeenCalled();
  });

  it('no-ops when maxUsers is undefined (enterprise / unlimited)', async () => {
    const mock = makeDbMock(999);
    await expect(assertSeatAvailable(mock, 'acct-x', undefined)).resolves.toBeUndefined();
    expect(mock.select).not.toHaveBeenCalled();
  });

  it('resolves when current count is under the cap', async () => {
    const mock = makeDbMock(10);
    await expect(assertSeatAvailable(mock, 'acct-pro', 25)).resolves.toBeUndefined();
    expect(mock.select).toHaveBeenCalledTimes(1);
  });

  it('resolves when table returns no rows (empty account)', async () => {
    const mock = makeDbMock(null);
    await expect(assertSeatAvailable(mock, 'acct-new', 25)).resolves.toBeUndefined();
  });

  it('throws SeatLimitReachedError when current count equals cap', async () => {
    const mock = makeDbMock(25);
    await expect(assertSeatAvailable(mock, 'acct-pro-full', 25)).rejects.toThrow(
      SeatLimitReachedError,
    );
  });

  it('throws SeatLimitReachedError when current count exceeds cap', async () => {
    const mock = makeDbMock(30);
    await expect(assertSeatAvailable(mock, 'acct-overshoot', 25)).rejects.toThrow(
      SeatLimitReachedError,
    );
  });

  it('the thrown error carries structured fields for API 402 rendering', async () => {
    const mock = makeDbMock(25);
    try {
      await assertSeatAvailable(mock, 'acct-pro-full', 25);
      expect.fail('should have thrown');
    } catch (err) {
      expect(err).toBeInstanceOf(SeatLimitReachedError);
      const typed = err as SeatLimitReachedError;
      expect(typed.code).toBe('seat_limit_reached');
      expect(typed.accountId).toBe('acct-pro-full');
      expect(typed.current).toBe(25);
      expect(typed.max).toBe(25);
      expect(typed.message).toContain('25/25');
      expect(typed.message).toContain('acct-pro-full');
    }
  });

  it('maxUsers=0 is treated as a literal cap', async () => {
    const mock = makeDbMock(0);
    await expect(assertSeatAvailable(mock, 'acct-deactivated', 0)).rejects.toThrow(
      SeatLimitReachedError,
    );
  });
});
