/**
 * GAP-256 PR-2 — pure snapshot mode decision from trend window (design §2.4).
 * Admit shadow/enforce is separate (PR-3); this only labels the snapshot row.
 */

export type SnapshotMode = 'open' | 'lean' | 'waitlist';

export interface SnapshotModeInput {
  /** Prior snapshots oldest→newest (same period window), excluding the candidate day if desired */
  priorNetCents: number[];
  freeCostCents: number;
  paidCostCents: number;
  revenueCents: number;
  /** Defaults for shadow; owner sets prod thresholds (Q1) */
  waitlistFloorCents: number;
  leanRatio: number;
  minPoints: number;
}

/**
 * Linear least-squares slope over net_cents series; project 7 steps ahead.
 * Pure.
 */
export function projectNet7dCents(priorNetCents: number[], currentNetCents: number): number | null {
  const series = [...priorNetCents, currentNetCents];
  if (series.length < 2) {
    return currentNetCents;
  }
  const n = series.length;
  let sumX = 0;
  let sumY = 0;
  let sumXY = 0;
  let sumXX = 0;
  for (let i = 0; i < n; i++) {
    const x = i;
    const y = series[i] ?? 0;
    sumX += x;
    sumY += y;
    sumXY += x * y;
    sumXX += x * x;
  }
  const denom = n * sumXX - sumX * sumX;
  if (denom === 0) {
    return currentNetCents;
  }
  const slope = (n * sumXY - sumX * sumY) / denom;
  const intercept = (sumY - slope * sumX) / n;
  const xFuture = n - 1 + 7;
  return Math.round(intercept + slope * xFuture);
}

export function freeCostRatio(freeCostCents: number, paidCostCents: number): number {
  const total = freeCostCents + paidCostCents;
  if (total <= 0) {
    return 0;
  }
  return freeCostCents / total;
}

/**
 * Mode policy for the snapshot row (not admit path).
 * Fail-open to open when insufficient points.
 */
export function decideSnapshotMode(input: SnapshotModeInput): {
  mode: SnapshotMode;
  projected7dCents: number | null;
  freeCostRatio: string;
  reason: string;
} {
  const currentNet = input.revenueCents - (input.freeCostCents + input.paidCostCents);
  const ratio = freeCostRatio(input.freeCostCents, input.paidCostCents);
  const ratioStr = ratio.toFixed(4);
  const projected = projectNet7dCents(input.priorNetCents, currentNet);

  const points = input.priorNetCents.length + 1;
  if (points < input.minPoints) {
    return {
      mode: 'open',
      projected7dCents: projected,
      freeCostRatio: ratioStr,
      reason: 'insufficient_points',
    };
  }

  if (projected !== null && projected < input.waitlistFloorCents && ratio >= input.leanRatio) {
    return {
      mode: 'waitlist',
      projected7dCents: projected,
      freeCostRatio: ratioStr,
      reason: 'projected_below_floor_and_free_ratio',
    };
  }

  if (projected !== null && projected < input.waitlistFloorCents) {
    return {
      mode: 'lean',
      projected7dCents: projected,
      freeCostRatio: ratioStr,
      reason: 'projected_below_floor',
    };
  }

  if (ratio >= input.leanRatio && input.freeCostCents > 0) {
    return {
      mode: 'lean',
      projected7dCents: projected,
      freeCostRatio: ratioStr,
      reason: 'free_cost_ratio',
    };
  }

  return {
    mode: 'open',
    projected7dCents: projected,
    freeCostRatio: ratioStr,
    reason: 'healthy',
  };
}

export function snapshotModeThresholdsFromEnv(
  env: NodeJS.ProcessEnv = process.env,
): Pick<SnapshotModeInput, 'waitlistFloorCents' | 'leanRatio' | 'minPoints'> {
  return {
    // Default floor: -$1k projected 7d (shadow placeholder; owner Q1)
    waitlistFloorCents: parseIntEnv(env.MARGIN_WAITLIST_FLOOR_CENTS, -100_000),
    leanRatio: parseFloatEnv(env.MARGIN_LEAN_RATIO, 0.7),
    minPoints: parseIntEnv(env.MARGIN_TREND_MIN_POINTS, 3),
  };
}

function parseIntEnv(raw: string | undefined, fallback: number): number {
  if (raw === undefined || raw.trim() === '') return fallback;
  const n = Number.parseInt(raw, 10);
  return Number.isFinite(n) ? n : fallback;
}

function parseFloatEnv(raw: string | undefined, fallback: number): number {
  if (raw === undefined || raw.trim() === '') return fallback;
  const n = Number.parseFloat(raw);
  return Number.isFinite(n) ? n : fallback;
}
