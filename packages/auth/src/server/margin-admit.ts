/**
 * GAP-256 free-intake admit + free@t0 entitlement (shared by server + admin).
 *
 * Pure decide lives in @revealui/core/margin-governor. This module is the I/O
 * wrapper: read margin_snapshots, never COUNT(users). Waitlist enqueue is PR-4.
 */

import { getFeaturesForTier } from '@revealui/core/features';
import {
  type AdmissionChannel,
  type CohortLimits,
  decideFreeIntake,
  freeCohortLimitsForMode,
  type GovernorFlags,
  governorFlagsFromEnv,
  type MarginSnapshotView,
  type PayingIntentSignal,
  type PureAdmitResult,
} from '@revealui/core/margin-governor';
import { logger } from '@revealui/core/observability/logger';
import { getClient } from '@revealui/db';
import {
  accountEntitlements,
  accountMemberships,
  accounts,
  marginSnapshots,
} from '@revealui/db/schema';
import { and, desc, eq } from 'drizzle-orm';
import { enqueueAdmissionWaitlist } from './admission-waitlist.js';
import { ensureAccountOwnerPlatformAdmin } from './platform-roles.js';

export type AdmitFreeIntakeInput = {
  channel: AdmissionChannel;
  email?: string;
  payingIntent?: PayingIntentSignal;
  deploymentMode?: 'hosted' | 'forge' | 'unknown';
  env?: NodeJS.ProcessEnv;
  now?: Date;
  /** Waitlist enqueue source tag (default free_signup). */
  source?: string;
};

export type AdmitFreeIntakeResult = PureAdmitResult & {
  flags: GovernorFlags;
  /** Present on waitlist decision after successful enqueue (raw once). */
  waitlistToken?: string;
  positionEstimate?: number | null;
};

/** Hosted free open limits — lockstep with apps/server getHostedLimitsForTier('free'). */
export const OPEN_FREE_LIMITS: CohortLimits = {
  maxSites: 1,
  maxUsers: 3,
  maxAgentTasks: 1_000,
};

function detectDeploymentMode(env: NodeJS.ProcessEnv): 'hosted' | 'forge' | 'unknown' {
  const raw = env.REVEALUI_DEPLOYMENT_MODE?.trim().toLowerCase();
  if (raw === 'hosted') return 'hosted';
  if (raw === 'forge') return 'forge';
  if (env.REVEALUI_LICENSE_PRIVATE_KEY) return 'hosted';
  if (raw) return 'unknown';
  return 'hosted';
}

async function loadLatestSnapshot(): Promise<MarginSnapshotView | null> {
  try {
    const db = getClient();
    const [row] = await db
      .select({
        id: marginSnapshots.id,
        mode: marginSnapshots.mode,
        computedAt: marginSnapshots.computedAt,
        netCents: marginSnapshots.netCents,
        freeCostRatio: marginSnapshots.freeCostRatio,
        projected7dCents: marginSnapshots.projected7dCents,
      })
      .from(marginSnapshots)
      .orderBy(desc(marginSnapshots.computedAt))
      .limit(1);
    if (!row) return null;
    const mode = row.mode;
    if (mode !== 'open' && mode !== 'lean' && mode !== 'waitlist') {
      return null;
    }
    return {
      id: row.id,
      mode,
      computedAt: row.computedAt,
      netCents: row.netCents,
      freeCostRatio: row.freeCostRatio,
      projected7dCents: row.projected7dCents,
    };
  } catch (err) {
    logger.warn('[admit-free-intake] snapshot read failed; fail-open', {
      error: err instanceof Error ? err.message : String(err),
    });
    return null;
  }
}

/**
 * Pre-check free intake. Call **before** any users insert (K13).
 * Shadow defaults → always admit (never waitlist response).
 * Enforce waitlist → enqueue admission_waitlist and attach raw token.
 */
function leanMaxAgentTasksFromEnv(env: NodeJS.ProcessEnv): number {
  const raw = env.LEAN_FREE_MAX_AGENT_TASKS;
  if (raw === undefined || raw.trim() === '') return 250;
  const n = Number.parseInt(raw, 10);
  return Number.isFinite(n) && n > 0 ? n : 250;
}

export async function admitFreeIntake(input: AdmitFreeIntakeInput): Promise<AdmitFreeIntakeResult> {
  const env = input.env ?? process.env;
  const flags = governorFlagsFromEnv(env);
  const snapshot = await loadLatestSnapshot();
  const result = decideFreeIntake({
    channel: input.channel,
    deploymentMode: input.deploymentMode ?? detectDeploymentMode(env),
    payingIntent: input.payingIntent ?? { kind: 'none' },
    snapshot,
    flags,
    openLimits: OPEN_FREE_LIMITS,
    leanMaxAgentTasks: leanMaxAgentTasksFromEnv(env),
    now: input.now,
  });

  if (result.decision === 'waitlist') {
    const email = input.email?.trim();
    if (!email) {
      // Cannot enqueue without identity — fail-open admit (not margin 403).
      logger.warn('[admit-free-intake] waitlist without email; fail-open admit', {
        channel: input.channel,
        snapshotId: result.snapshotId,
      });
      return {
        decision: 'admit',
        mode: 'open',
        cohortLimits: freeCohortLimitsForMode('open', OPEN_FREE_LIMITS),
        snapshotId: result.snapshotId,
        reason: 'waitlist_missing_email',
        shadow: false,
        flags,
      };
    }

    try {
      const enqueued = await enqueueAdmissionWaitlist({
        email,
        snapshotId: result.snapshotId,
        modeAtEnqueue: 'waitlist',
        source: input.source ?? input.channel,
        now: input.now,
      });
      logger.info('[admit-free-intake]', {
        channel: input.channel,
        email: '[redacted]',
        decision: 'waitlist',
        mode: result.mode,
        reason: result.reason,
        shadow: result.shadow,
        snapshotId: result.snapshotId,
        governorEnabled: flags.enabled,
        waitlistId: enqueued.id,
        positionEstimate: enqueued.positionEstimate,
      });
      return {
        ...result,
        flags,
        waitlistToken: enqueued.waitlistToken,
        positionEstimate: enqueued.positionEstimate,
      };
    } catch (err) {
      // Enqueue failure must not 403; fail-open admit so signup can proceed.
      logger.error(
        '[admit-free-intake] waitlist enqueue failed; fail-open admit',
        err instanceof Error ? err : undefined,
        { channel: input.channel },
      );
      return {
        decision: 'admit',
        mode: 'open',
        cohortLimits: freeCohortLimitsForMode('open', OPEN_FREE_LIMITS),
        snapshotId: result.snapshotId,
        reason: 'waitlist_enqueue_failed',
        shadow: false,
        flags,
      };
    }
  }

  logger.info('[admit-free-intake]', {
    channel: input.channel,
    email: input.email ? '[redacted]' : undefined,
    decision: result.decision,
    mode: result.mode,
    reason: result.reason,
    shadow: result.shadow,
    snapshotId: result.snapshotId,
    governorEnabled: flags.enabled,
  });

  return { ...result, flags };
}

/**
 * Provision personal account + owner membership on hosted (same as signUp).
 * Idempotent-ish: skips if user already has an active owner membership.
 */
export async function provisionHostedPersonalAccount(params: {
  userId: string;
  displayName: string;
}): Promise<{ accountId: string } | { skipped: true; reason: string }> {
  const { isHostedDeployment } = await import('@revealui/core/deployment-mode');
  if (!isHostedDeployment(process.env)) {
    return { skipped: true, reason: 'not_hosted' };
  }

  const db = getClient();
  const [existing] = await db
    .select({ accountId: accountMemberships.accountId })
    .from(accountMemberships)
    .where(
      and(
        eq(accountMemberships.userId, params.userId),
        eq(accountMemberships.role, 'owner'),
        eq(accountMemberships.status, 'active'),
      ),
    )
    .limit(1);
  if (existing) {
    return { accountId: existing.accountId };
  }

  const accountId = crypto.randomUUID();
  const now = new Date();
  await db.insert(accounts).values({
    id: accountId,
    name: `${params.displayName || 'RevealUI'} Workspace`,
    slug: `acct-${accountId}`,
    status: 'active',
    createdAt: now,
    updatedAt: now,
  });
  await db.insert(accountMemberships).values({
    id: crypto.randomUUID(),
    accountId,
    userId: params.userId,
    role: 'owner',
    status: 'active',
    createdAt: now,
    updatedAt: now,
  });
  await ensureAccountOwnerPlatformAdmin(db, params.userId);
  return { accountId };
}

/**
 * Free entitlement@t0 (K15) with source=signup.
 * Ensures owner membership/account exist first (passkey/oauth paths).
 */
export async function ensureFreeSignupEntitlement(params: {
  userId: string;
  cohortLimits: CohortLimits;
  displayName?: string;
  now?: Date;
}): Promise<{ accountId: string } | { skipped: true; reason: string }> {
  const provisioned = await provisionHostedPersonalAccount({
    userId: params.userId,
    displayName: params.displayName ?? 'RevealUI',
  });
  if ('skipped' in provisioned && provisioned.skipped) {
    // still try membership lookup on non-hosted? skip
    if (provisioned.reason === 'not_hosted') {
      return provisioned;
    }
  }

  const db = getClient();
  const now = params.now ?? new Date();

  const [membership] = await db
    .select({ accountId: accountMemberships.accountId })
    .from(accountMemberships)
    .where(
      and(
        eq(accountMemberships.userId, params.userId),
        eq(accountMemberships.role, 'owner'),
        eq(accountMemberships.status, 'active'),
      ),
    )
    .limit(1);

  if (!membership) {
    logger.warn('[free-signup-entitlement] no owner membership; skip', {
      userId: params.userId,
    });
    return { skipped: true, reason: 'no_owner_membership' };
  }

  const accountId = membership.accountId;
  const [existing] = await db
    .select({ source: accountEntitlements.source })
    .from(accountEntitlements)
    .where(eq(accountEntitlements.accountId, accountId))
    .limit(1);

  if (existing?.source === 'stripe' || existing?.source === 'grant') {
    // Do not overwrite paid/gifted rows
    return { accountId };
  }

  const features = getFeaturesForTier('free') as unknown as Record<string, boolean>;
  const row = {
    accountId,
    planId: 'free' as const,
    tier: 'free' as const,
    status: 'active',
    features,
    limits: {
      maxSites: params.cohortLimits.maxSites,
      maxUsers: params.cohortLimits.maxUsers,
      maxAgentTasks: params.cohortLimits.maxAgentTasks,
    },
    meteringStatus: 'active',
    mode: 'live' as const,
    source: 'signup' as const,
    graceUntil: null,
    lastEventAt: null,
    updatedAt: now,
    cogsBreakerTrippedAt: null,
    cogsBreakerReason: null,
  };

  if (existing) {
    // free_preserve: do not clobber existing free limits mid-cycle
    await db
      .update(accountEntitlements)
      .set({ updatedAt: now })
      .where(eq(accountEntitlements.accountId, accountId));
  } else {
    await db.insert(accountEntitlements).values(row);
  }

  logger.info('[free-signup-entitlement] upserted', {
    accountId,
    userId: params.userId,
    maxAgentTasks: params.cohortLimits.maxAgentTasks,
  });

  return { accountId };
}
