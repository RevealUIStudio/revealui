/**
 * GAP-256 PR-2 — meter → cost class map (SSOT for snapshot job + COGS breaker).
 *
 * Single table. When a new cloud meter ships, add one row here (no second map).
 *
 * @see docs/specs/2026-08-09-gap-256-margin-admission-layers-2-3.md §2.2
 */

export type MeterCostClass = 'mcp' | 'cloud' | 'local_default' | 'ignore';

export interface CostRates {
  /** Cents per minute of billable MCP duration */
  mcpMinuteCents: number;
  /** Reserved for future hosted-provider meters */
  cloudMinuteCents: number;
  /** Free local / unknown-with-duration (default 0) */
  localMinuteCents: number;
}

/** Ops/product meters that must never enter LLM COGS (code-grounded). */
const IGNORE_METERS = new Set(['audit_anchor', 'audit_export', 'audit_view', 'upgrade_intent']);

/**
 * Classify a usage_meters.meter_name for COGS.
 * Pure. No I/O.
 */
export function classifyMeter(meterName: string): MeterCostClass {
  const name = meterName.trim();
  if (name.length === 0) {
    return 'ignore';
  }
  if (IGNORE_METERS.has(name)) {
    return 'ignore';
  }
  if (name.startsWith('mcp.') || name === 'mcp') {
    return 'mcp';
  }
  // Future: cloud provider meter names land here as explicit cases before default.
  return 'local_default';
}

export function rateCentsForClass(cls: MeterCostClass, rates: CostRates): number {
  switch (cls) {
    case 'mcp':
      return rates.mcpMinuteCents;
    case 'cloud':
      return rates.cloudMinuteCents;
    case 'local_default':
      return rates.localMinuteCents;
    case 'ignore':
      return 0;
    default: {
      const _exhaustive: never = cls;
      return _exhaustive;
    }
  }
}

/**
 * Rates from env (defaults match design: local free default 0).
 * MCP default 1 cent/min is a shadow placeholder until owner Q1 sets real COGS.
 */
export function costRatesFromEnv(env: NodeJS.ProcessEnv = process.env): CostRates {
  return {
    mcpMinuteCents: parseNonNegInt(env.MARGIN_COST_MCP_MINUTE_CENTS, 1),
    cloudMinuteCents: parseNonNegInt(env.MARGIN_COST_CLOUD_MINUTE_CENTS, 1),
    localMinuteCents: parseNonNegInt(env.MARGIN_COST_LOCAL_MINUTE_CENTS, 0),
  };
}

function parseNonNegInt(raw: string | undefined, fallback: number): number {
  if (raw === undefined || raw.trim() === '') {
    return fallback;
  }
  const n = Number.parseInt(raw, 10);
  if (!Number.isFinite(n) || n < 0) {
    return fallback;
  }
  return n;
}
