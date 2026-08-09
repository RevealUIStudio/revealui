/**
 * GAP-256 PR-2 — single-formula COGS (K8). No agent_task double-count.
 *
 * account_day_cost_cents =
 *   Σ rows with duration_ms, !errored, classify ≠ ignore
 *   of ceil(duration_ms / 60000) * rate_cents_for(class)
 */

import { type CostRates, classifyMeter, rateCentsForClass } from './margin-cost-meters.js';

export interface UsageMeterCostRow {
  accountId: string;
  meterName: string;
  durationMs: number | null;
  errored: boolean | null;
}

/**
 * Cost for one usage_meters row. Pure.
 * Returns 0 when duration missing, errored, or class ignore.
 */
export function costCentsForMeterRow(
  row: Pick<UsageMeterCostRow, 'meterName' | 'durationMs' | 'errored'>,
  rates: CostRates,
): number {
  if (row.durationMs === null || row.durationMs === undefined) {
    return 0;
  }
  if (row.errored === true) {
    return 0;
  }
  if (row.durationMs < 0) {
    return 0;
  }
  const cls = classifyMeter(row.meterName);
  const rate = rateCentsForClass(cls, rates);
  if (rate === 0) {
    return 0;
  }
  const minutes = Math.ceil(row.durationMs / 60_000);
  return minutes * rate;
}

export interface AccountCostAggregate {
  accountId: string;
  costCents: number;
}

/**
 * Sum cost by account. Pure. Does not touch agent_task_usage.
 */
export function sumCostByAccount(rows: UsageMeterCostRow[], rates: CostRates): Map<string, number> {
  const map = new Map<string, number>();
  for (const row of rows) {
    const c = costCentsForMeterRow(row, rates);
    if (c === 0) continue;
    map.set(row.accountId, (map.get(row.accountId) ?? 0) + c);
  }
  return map;
}

/**
 * Split total free vs paid cost using entitlement tier map.
 * Accounts without entitlement row count as free (conservative for free COGS).
 */
export function splitFreePaidCost(
  costByAccount: Map<string, number>,
  tierByAccount: Map<string, string>,
): { freeCostCents: number; paidCostCents: number } {
  let freeCostCents = 0;
  let paidCostCents = 0;
  for (const [accountId, cost] of costByAccount) {
    const tier = tierByAccount.get(accountId) ?? 'free';
    if (tier === 'pro' || tier === 'max' || tier === 'enterprise') {
      paidCostCents += cost;
    } else {
      freeCostCents += cost;
    }
  }
  return { freeCostCents, paidCostCents };
}
