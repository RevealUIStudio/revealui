/**
 * GAP-256 PR-2 — HC13: single-formula cost; no task double-count.
 */
import { describe, expect, it } from 'vitest';
import { costCentsForMeterRow, splitFreePaidCost, sumCostByAccount } from '../margin-cost.js';
import { type CostRates, classifyMeter, rateCentsForClass } from '../margin-cost-meters.js';
import { defaultPeriodDateUtc, periodDayBoundsUtc } from '../margin-period.js';
import { decideSnapshotMode, projectNet7dCents } from '../margin-snapshot-mode.js';

const rates: CostRates = {
  mcpMinuteCents: 10,
  cloudMinuteCents: 20,
  localMinuteCents: 0,
};

describe('classifyMeter', () => {
  it('classifies mcp.* as mcp', () => {
    expect(classifyMeter('mcp.tool.call')).toBe('mcp');
    expect(classifyMeter('mcp.sampling.create')).toBe('mcp');
    expect(classifyMeter('mcp.resource.read')).toBe('mcp');
  });

  it('ignores audit / upgrade product meters', () => {
    expect(classifyMeter('audit_anchor')).toBe('ignore');
    expect(classifyMeter('audit_export')).toBe('ignore');
    expect(classifyMeter('upgrade_intent')).toBe('ignore');
  });

  it('defaults unknown names to local_default', () => {
    expect(classifyMeter('agent.stream.chunk')).toBe('local_default');
  });
});

describe('costCentsForMeterRow (HC13)', () => {
  it('charges ceil minutes * rate for mcp duration', () => {
    // 90s → 2 minutes * 10 = 20
    expect(
      costCentsForMeterRow(
        { meterName: 'mcp.tool.call', durationMs: 90_000, errored: false },
        rates,
      ),
    ).toBe(20);
  });

  it('returns 0 for null duration, errored, or ignore class', () => {
    expect(
      costCentsForMeterRow({ meterName: 'mcp.tool.call', durationMs: null, errored: false }, rates),
    ).toBe(0);
    expect(
      costCentsForMeterRow(
        { meterName: 'mcp.tool.call', durationMs: 60_000, errored: true },
        rates,
      ),
    ).toBe(0);
    expect(
      costCentsForMeterRow({ meterName: 'audit_view', durationMs: 60_000, errored: false }, rates),
    ).toBe(0);
  });

  it('does not invent cost from tasks — only usage_meters rows', () => {
    // Fixture: one MCP duration row + "task" is not a meter input at all
    const map = sumCostByAccount(
      [
        {
          accountId: 'a1',
          meterName: 'mcp.tool.call',
          durationMs: 60_000,
          errored: false,
        },
      ],
      rates,
    );
    expect(map.get('a1')).toBe(10);
    // No second formula adding agent_task_usage
    expect(rateCentsForClass('ignore', rates)).toBe(0);
  });
});

describe('splitFreePaidCost', () => {
  it('splits by entitlement tier', () => {
    const cost = new Map([
      ['free-acct', 100],
      ['pro-acct', 50],
    ]);
    const tiers = new Map([
      ['free-acct', 'free'],
      ['pro-acct', 'pro'],
    ]);
    expect(splitFreePaidCost(cost, tiers)).toEqual({
      freeCostCents: 100,
      paidCostCents: 50,
    });
  });
});

describe('decideSnapshotMode', () => {
  it('opens when insufficient points', () => {
    const r = decideSnapshotMode({
      priorNetCents: [0],
      freeCostCents: 1000,
      paidCostCents: 0,
      revenueCents: 0,
      waitlistFloorCents: -100,
      leanRatio: 0.5,
      minPoints: 3,
    });
    expect(r.mode).toBe('open');
    expect(r.reason).toBe('insufficient_points');
  });

  it('projects linear trend', () => {
    // increasing net: 0, 100, 200 → slope ~100/day → +7 ~900 from last
    const p = projectNet7dCents([0, 100], 200);
    expect(p).not.toBeNull();
    expect(p as number).toBeGreaterThan(200);
  });
});

describe('period helpers', () => {
  it('defaults to previous UTC day', () => {
    const now = new Date(Date.UTC(2026, 7, 9, 15, 0, 0));
    expect(defaultPeriodDateUtc(now)).toBe('2026-08-08');
    const { start, end } = periodDayBoundsUtc('2026-08-08');
    expect(start.toISOString()).toBe('2026-08-08T00:00:00.000Z');
    expect(end.toISOString()).toBe('2026-08-09T00:00:00.000Z');
  });
});
