import { describe, expect, it } from 'vitest';
import { utcIsoWeekBounds, weeklyUsagePercent } from '../weekly-agent-usage.js';

describe('utcIsoWeekBounds', () => {
  it('starts Monday 00:00 UTC for a mid-week instant', () => {
    const { weekStart, weekResetAt } = utcIsoWeekBounds(new Date('2026-09-03T15:22:00.000Z'));
    expect(weekStart.toISOString()).toBe('2026-08-31T00:00:00.000Z');
    expect(weekResetAt.toISOString()).toBe('2026-09-07T00:00:00.000Z');
  });

  it('keeps Sunday in the week that began the prior Monday', () => {
    const { weekStart } = utcIsoWeekBounds(new Date('2026-09-06T23:59:59.000Z'));
    expect(weekStart.toISOString()).toBe('2026-08-31T00:00:00.000Z');
  });

  it('opens a new week at Monday 00:00 UTC', () => {
    const { weekStart } = utcIsoWeekBounds(new Date('2026-09-07T00:00:00.000Z'));
    expect(weekStart.toISOString()).toBe('2026-09-07T00:00:00.000Z');
  });
});

describe('weeklyUsagePercent', () => {
  it('returns null for unlimited (-1) and zero allotment', () => {
    expect(weeklyUsagePercent(0, -1)).toBeNull();
    expect(weeklyUsagePercent(12, 0)).toBeNull();
  });

  it('returns 0 when the week has no usage against a finite cap', () => {
    expect(weeklyUsagePercent(0, 10_000)).toBe(0);
  });

  it('rounds used/cap and caps at 100', () => {
    expect(weeklyUsagePercent(250, 10_000)).toBe(3);
    expect(weeklyUsagePercent(12_000, 10_000)).toBe(100);
  });
});
