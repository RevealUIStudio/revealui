/**
 * GAP-256 PR-3 — pure margin admission decide (no DB, no I/O).
 *
 * Call sites: apps/server admitFreeIntake (reads snapshot, then this).
 * HARD: never call after users insert for free_signup; pure module has no COUNT.
 *
 * @see docs/specs/2026-08-09-gap-256-margin-admission-layers-2-3.md
 */

export type AdmissionChannel =
  | 'free_signup'
  | 'paid_signup'
  | 'paid_checkout'
  | 'invite_accept'
  | 'admin_provision'
  | 'waitlist_claim_free'
  | 'waitlist_claim_paid';

export type PayingIntentSignal =
  | { kind: 'none' }
  | { kind: 'checkout'; tier: 'pro' | 'max' | 'enterprise' }
  | { kind: 'existing_paid'; accountId: string; tier: string; status: 'active' };

export type CohortLimits = {
  maxSites: number;
  maxUsers: number;
  maxAgentTasks: number;
};

export type SnapshotMode = 'open' | 'lean' | 'waitlist';

/** Minimal snapshot view for pure decide (from margin_snapshots row). */
export interface MarginSnapshotView {
  id: string;
  mode: SnapshotMode;
  computedAt: Date;
  netCents?: number;
  freeCostRatio?: string | null;
  projected7dCents?: number | null;
}

export interface GovernorFlags {
  /** Master; off → admit always with open limits */
  enabled: boolean;
  /**
   * When true (default for first enable): compute mode for logs but never
   * waitlist / never lean-enforce on admit (always admit).
   */
  shadow: boolean;
  /** Hours after which a snapshot is ignored (fail-open to open). Default 36. */
  staleHours: number;
}

export type PureAdmitResult =
  | {
      decision: 'admit';
      mode: SnapshotMode | 'bypass' | 'disabled' | 'shadow';
      cohortLimits: CohortLimits;
      snapshotId: string | null;
      reason: string;
      shadow: boolean;
    }
  | {
      decision: 'waitlist';
      mode: 'waitlist';
      reason: string;
      snapshotId: string | null;
      shadow: false;
      httpStatus: 202;
      code: 'WAITLISTED';
    };

/** Open free cohort = standard hosted free limits (caller supplies base). */
export function freeCohortLimitsForMode(
  mode: 'open' | 'lean',
  openLimits: CohortLimits,
  leanMaxAgentTasks = 250,
): CohortLimits {
  if (mode === 'lean') {
    return {
      maxSites: openLimits.maxSites,
      maxUsers: openLimits.maxUsers,
      maxAgentTasks: leanMaxAgentTasks,
    };
  }
  return { ...openLimits };
}

/** Paid-signup pending only — never free cohort (K20). */
export function paidPendingLimits(): CohortLimits {
  return { maxSites: 1, maxUsers: 1, maxAgentTasks: 0 };
}

export function governorFlagsFromEnv(
  env: Record<string, string | undefined> = process.env,
): GovernorFlags {
  const enabled = env.MARGIN_GOVERNOR_ENABLED === 'true';
  // When master is on, shadow defaults true unless explicitly false
  const shadowExplicit = env.MARGIN_GOVERNOR_SHADOW;
  const shadow =
    shadowExplicit === 'false' ? false : shadowExplicit === 'true' ? true : enabled ? true : true;
  const staleHours = parsePositiveInt(env.MARGIN_SNAPSHOT_STALE_HOURS, 36);
  return { enabled, shadow, staleHours };
}

function parsePositiveInt(raw: string | undefined, fallback: number): number {
  if (raw === undefined || raw.trim() === '') return fallback;
  const n = Number.parseInt(raw, 10);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

function isPayingBypass(channel: AdmissionChannel, payingIntent: PayingIntentSignal): boolean {
  if (
    channel === 'paid_signup' ||
    channel === 'paid_checkout' ||
    channel === 'invite_accept' ||
    channel === 'admin_provision' ||
    channel === 'waitlist_claim_paid'
  ) {
    return true;
  }
  if (payingIntent.kind === 'checkout' || payingIntent.kind === 'existing_paid') {
    return true;
  }
  return false;
}

function isSnapshotStale(
  snapshot: MarginSnapshotView | null,
  now: Date,
  staleHours: number,
): boolean {
  if (!snapshot) return true;
  const ageMs = now.getTime() - snapshot.computedAt.getTime();
  return ageMs > staleHours * 3_600_000;
}

/**
 * Pure admit decision for free intake.
 * Does not touch users table, COUNT, or waitlist I/O.
 */
export function decideFreeIntake(input: {
  channel: AdmissionChannel;
  deploymentMode: 'hosted' | 'forge' | 'unknown';
  payingIntent: PayingIntentSignal;
  snapshot: MarginSnapshotView | null;
  flags: GovernorFlags;
  openLimits: CohortLimits;
  leanMaxAgentTasks?: number;
  now?: Date;
}): PureAdmitResult {
  const now = input.now ?? new Date();
  const leanTasks = input.leanMaxAgentTasks ?? 250;
  const openLimits = input.openLimits;

  if (input.deploymentMode === 'forge') {
    return {
      decision: 'admit',
      mode: 'disabled',
      cohortLimits: freeCohortLimitsForMode('open', openLimits, leanTasks),
      snapshotId: null,
      reason: 'forge_deployment',
      shadow: false,
    };
  }

  if (isPayingBypass(input.channel, input.payingIntent)) {
    return {
      decision: 'admit',
      mode: 'bypass',
      // Bypass waitlist only — paid_signup must NOT use free cohort (caller uses paidPendingLimits)
      cohortLimits: freeCohortLimitsForMode('open', openLimits, leanTasks),
      snapshotId: input.snapshot?.id ?? null,
      reason: 'paying_intent_bypass',
      shadow: false,
    };
  }

  if (!input.flags.enabled) {
    return {
      decision: 'admit',
      mode: 'disabled',
      cohortLimits: freeCohortLimitsForMode('open', openLimits, leanTasks),
      snapshotId: input.snapshot?.id ?? null,
      reason: 'governor_disabled',
      shadow: false,
    };
  }

  const stale = isSnapshotStale(input.snapshot, now, input.flags.staleHours);
  const rawMode: SnapshotMode = stale ? 'open' : (input.snapshot?.mode ?? 'open');
  const snapshotId = input.snapshot?.id ?? null;

  // Shadow: always admit; attach would-be mode for logs
  if (input.flags.shadow) {
    const cohortMode = rawMode === 'lean' ? 'lean' : 'open';
    return {
      decision: 'admit',
      mode: 'shadow',
      cohortLimits: freeCohortLimitsForMode(cohortMode, openLimits, leanTasks),
      snapshotId,
      reason: stale ? `shadow_stale_would_${rawMode}` : `shadow_would_${rawMode}`,
      shadow: true,
    };
  }

  // Enforce path (PR-4): waitlist when mode is waitlist
  if (rawMode === 'waitlist') {
    return {
      decision: 'waitlist',
      mode: 'waitlist',
      reason: stale ? 'stale_fail_open_blocked' : 'snapshot_waitlist',
      snapshotId,
      shadow: false,
      httpStatus: 202,
      code: 'WAITLISTED',
    };
  }

  const cohortMode = rawMode === 'lean' ? 'lean' : 'open';
  return {
    decision: 'admit',
    mode: rawMode,
    cohortLimits: freeCohortLimitsForMode(cohortMode, openLimits, leanTasks),
    snapshotId,
    reason: stale ? 'stale_fail_open' : `snapshot_${rawMode}`,
    shadow: false,
  };
}
