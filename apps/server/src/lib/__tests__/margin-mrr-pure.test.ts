/**
 * GAP-256 PR-2 — pure MRR math (no DB / config package).
 */
import { describe, expect, it } from 'vitest';
import { computeMonthlyMrrCents, dailyRevenueCentsFromMrr } from '../margin-mrr-pure.js';

describe('computeMonthlyMrrCents / dailyRevenueCentsFromMrr', () => {
  it('computes MRR and daily attribution', () => {
    const mrr = computeMonthlyMrrCents(
      { pro: 2, max: 0, enterprise: 0 },
      { pro: 4900, max: 29900, enterprise: 149900 },
    );
    expect(mrr).toBe(9800);
    const daily = dailyRevenueCentsFromMrr(mrr, new Date(Date.UTC(2026, 0, 15)));
    expect(daily).toBe(Math.round(9800 / 31));
  });
});
