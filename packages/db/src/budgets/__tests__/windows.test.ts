import { afterEach, describe, expect, it } from 'vitest';
import {
  configureBudgetLimits,
  crossesHardStop,
  crossesWarn,
  defaultWarnPercent,
  LIFETIME_WINDOW_START,
  normalizeWarnPercent,
  warnAmount,
  windowStart,
  wouldExceedHardStop,
} from '../windows.js';

afterEach(() => {
  configureBudgetLimits(null);
});

describe('budget windows', () => {
  it('truncates a calendar month to UTC midnight on the first', () => {
    const at = new Date('2026-09-15T18:30:00.000Z');
    expect(windowStart('calendar_month_utc', at).toISOString()).toBe('2026-09-01T00:00:00.000Z');
  });

  it('keeps the UTC month when the local calendar would roll forward', () => {
    const at = new Date('2026-09-01T12:00:00.000Z');
    expect(windowStart('calendar_month_utc', at).toISOString()).toBe('2026-09-01T00:00:00.000Z');
  });

  it('truncates a calendar day to UTC midnight', () => {
    const at = new Date('2026-09-15T23:59:00.000Z');
    expect(windowStart('calendar_day_utc', at).toISOString()).toBe('2026-09-15T00:00:00.000Z');
  });

  it('uses the epoch for a lifetime window', () => {
    expect(windowStart('lifetime', new Date('2026-09-15T00:00:00.000Z')).getTime()).toBe(
      LIFETIME_WINDOW_START.getTime(),
    );
  });
});

describe('budget limits', () => {
  it('defaults an enabled warning to 80 and leaves warnings off otherwise', () => {
    expect(defaultWarnPercent()).toBe(80);
    expect(normalizeWarnPercent(false)).toBeNull();
    expect(normalizeWarnPercent(false, 50)).toBeNull();
    expect(normalizeWarnPercent(true)).toBe(80);
    expect(normalizeWarnPercent(true, 50)).toBe(50);
  });

  it('rejects a warn percent outside 1 to 99', () => {
    expect(() => normalizeWarnPercent(true, 0)).toThrow(
      'budget warnPercent must be an integer from 1 to 99',
    );
    expect(() => normalizeWarnPercent(true, 100)).toThrow(
      'budget warnPercent must be an integer from 1 to 99',
    );
  });

  it('uses the configured default when warnings are enabled without a percent', () => {
    configureBudgetLimits({ defaultWarnPercent: 70 });
    expect(normalizeWarnPercent(true)).toBe(70);
  });

  it('floors the warn amount and detects a single crossing', () => {
    expect(warnAmount(10, 80)).toBe(8);
    expect(warnAmount(10, null)).toBeNull();
    expect(crossesWarn(7, 8, 8)).toBe(true);
    expect(crossesWarn(8, 9, 8)).toBe(false);
    expect(crossesWarn(0, 9, null)).toBe(false);
  });

  it('trips a hard stop only when spend moves from within the limit to over it', () => {
    expect(crossesHardStop(10, 11, 10, true)).toBe(true);
    expect(crossesHardStop(9, 10, 10, true)).toBe(false);
    expect(crossesHardStop(10, 11, 10, false)).toBe(false);
    expect(wouldExceedHardStop(10, 1, 10, true)).toBe(true);
    expect(wouldExceedHardStop(9, 1, 10, true)).toBe(false);
    expect(wouldExceedHardStop(10, 1, 10, false)).toBe(false);
  });
});
