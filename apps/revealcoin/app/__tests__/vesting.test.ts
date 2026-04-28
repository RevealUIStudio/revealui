import { describe, expect, it } from 'vitest';
import { calculateVestingState, VESTING_SCHEDULES } from '../lib/vesting';

describe('VESTING_SCHEDULES', () => {
  it('exports the 4 canonical schedules in expected order', () => {
    expect(VESTING_SCHEDULES).toHaveLength(4);
    expect(VESTING_SCHEDULES.map((s) => s.name)).toEqual([
      'Team & Founders',
      'Strategic Partners',
      'Liquidity Provision',
      'Ecosystem Rewards',
    ]);
  });

  it('totalAmount per schedule matches the published tokenomics breakdown', () => {
    const byName = Object.fromEntries(VESTING_SCHEDULES.map((s) => [s.name, s.totalAmount]));
    expect(byName['Team & Founders']).toBe(8_835_900_000);
    expect(byName['Strategic Partners']).toBe(2_945_300_000);
    expect(byName['Liquidity Provision']).toBe(5_301_540_000);
    expect(byName['Ecosystem Rewards']).toBe(17_671_800_000);
  });
});

describe('calculateVestingState', () => {
  const teamSchedule = VESTING_SCHEDULES.find((s) => s.name === 'Team & Founders');
  const ecosystemSchedule = VESTING_SCHEDULES.find((s) => s.name === 'Ecosystem Rewards');

  it('returns "complete" with full vest after the end date', () => {
    if (!teamSchedule) throw new Error('Team & Founders schedule missing');
    const farFuture = new Date('2099-01-01');
    const state = calculateVestingState(teamSchedule, farFuture);
    expect(state.status).toBe('complete');
    expect(state.percentVested).toBe(100);
    expect(state.amountVested).toBe(teamSchedule.totalAmount);
    expect(state.amountLocked).toBe(0);
    expect(state.daysUntilNextMilestone).toBeNull();
  });

  it('returns "cliff" with zero vested during the cliff window for cliff-linear schedules', () => {
    if (!teamSchedule) throw new Error('Team & Founders schedule missing');
    const justAfterStart = new Date(teamSchedule.startDate);
    justAfterStart.setDate(justAfterStart.getDate() + 1);
    const state = calculateVestingState(teamSchedule, justAfterStart);
    expect(state.status).toBe('cliff');
    expect(state.percentVested).toBe(0);
    expect(state.amountVested).toBe(0);
    expect(state.amountLocked).toBe(teamSchedule.totalAmount);
    expect(state.nextMilestone?.label).toBe('Cliff ends');
  });

  it('reports a non-zero vested fraction mid-stream for front-loaded schedules', () => {
    if (!ecosystemSchedule) throw new Error('Ecosystem Rewards schedule missing');
    // Sample 18 months in: front-loaded should have emitted ~30% (Y1) + ~12.5%
    // (half of Y2 at 25%) = ~42.5%. We assert a generous range so calendar
    // arithmetic noise doesn't make the test flaky across leap years.
    const start = new Date(ecosystemSchedule.startDate);
    const eighteenMonthsIn = new Date(start);
    eighteenMonthsIn.setMonth(eighteenMonthsIn.getMonth() + 18);
    const state = calculateVestingState(ecosystemSchedule, eighteenMonthsIn);
    expect(state.status).toBe('vesting');
    expect(state.percentVested).toBeGreaterThan(35);
    expect(state.percentVested).toBeLessThan(50);
  });
});
