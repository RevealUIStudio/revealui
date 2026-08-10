/**
 * GAP-256 Layer 3 — pure COGS circuit breaker decide (no DB, no I/O).
 * Free accounts only; paying tiers never trip.
 */
export interface CogsBreakerFlags {
  enabled: boolean;
  dailyLimitCents: number;
}

export function cogsBreakerFlagsFromEnv(
  env: Record<string, string | undefined> = process.env,
): CogsBreakerFlags {
  const enabled = env.COGS_BREAKER_ENABLED === 'true';
  const dailyLimitCents = parsePositiveInt(env.COGS_BREAKER_DAILY_CENTS, 1_000);
  return { enabled, dailyLimitCents };
}

function parsePositiveInt(raw: string | undefined, fallback: number): number {
  if (raw === undefined || raw.trim() === '') return fallback;
  const n = Number.parseInt(raw, 10);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

export type CogsBreakerDecideInput = {
  tier: string;
  costCents: number;
  flags: CogsBreakerFlags;
  alreadyTripped: boolean;
};

export type CogsBreakerDecideResult =
  | { action: 'none'; reason: string }
  | { action: 'trip'; reason: string }
  | { action: 'already_tripped'; reason: string };

export function decideCogsBreakerTrip(input: CogsBreakerDecideInput): CogsBreakerDecideResult {
  if (!input.flags.enabled) {
    return { action: 'none', reason: 'breaker_disabled' };
  }
  if (input.tier === 'pro' || input.tier === 'max' || input.tier === 'enterprise') {
    return { action: 'none', reason: 'paid_tier_exempt' };
  }
  if (input.alreadyTripped) {
    return { action: 'already_tripped', reason: 'already_tripped' };
  }
  if (input.costCents > input.flags.dailyLimitCents) {
    return {
      action: 'trip',
      reason: `daily_cogs_${input.costCents}_gt_${input.flags.dailyLimitCents}`,
    };
  }
  return { action: 'none', reason: 'under_limit' };
}
