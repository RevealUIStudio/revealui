import { describe, expect, it } from 'vitest';
import { planContiguousBatch, type SignedAuditRow } from '../audit-anchor-batch.js';

describe('planContiguousBatch (GAP-355 S4-3)', () => {
  it('returns null for empty input', () => {
    expect(planContiguousBatch(0, [])).toBeNull();
  });

  it('accepts a contiguous batch when lastAnchored is 0', () => {
    const rows: SignedAuditRow[] = [
      { seq: 5, signature: 's5' },
      { seq: 6, signature: 's6' },
      { seq: 7, signature: 's7' },
    ];
    expect(planContiguousBatch(0, rows)).toEqual(rows);
  });

  it('requires next seq = last+1 when lastAnchored > 0', () => {
    const rows: SignedAuditRow[] = [
      { seq: 12, signature: 's12' },
      { seq: 13, signature: 's13' },
    ];
    expect(planContiguousBatch(10, rows)).toBeNull();
    expect(planContiguousBatch(11, rows)).toEqual(rows);
  });

  it('takes longest contiguous prefix when a mid-batch gap appears', () => {
    const rows: SignedAuditRow[] = [
      { seq: 1, signature: 'a' },
      { seq: 2, signature: 'b' },
      { seq: 4, signature: 'c' },
    ];
    expect(planContiguousBatch(0, rows)).toEqual([
      { seq: 1, signature: 'a' },
      { seq: 2, signature: 'b' },
    ]);
  });
});
