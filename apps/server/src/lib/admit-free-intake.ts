/**
 * GAP-256 PR-3 — admit free intake (I/O wrapper around pure decide).
 *
 * Reads latest margin_snapshots; never COUNT(users). Waitlist insert is PR-4.
 */

import {
  type AdmissionChannel,
  type CohortLimits,
  decideFreeIntake,
  type GovernorFlags,
  governorFlagsFromEnv,
  type MarginSnapshotView,
  type PayingIntentSignal,
  type PureAdmitResult,
} from '@revealui/core/margin-governor';
import { logger } from '@revealui/core/observability/logger';
import { getClient } from '@revealui/db';
import { marginSnapshots } from '@revealui/db/schema';
import { desc } from 'drizzle-orm';
import { getHostedLimitsForTier } from './tier-limits.js';

export type AdmitFreeIntakeInput = {
  channel: AdmissionChannel;
  email?: string;
  payingIntent?: PayingIntentSignal;
  deploymentMode?: 'hosted' | 'forge' | 'unknown';
  env?: NodeJS.ProcessEnv;
  now?: Date;
};

export type AdmitFreeIntakeResult = PureAdmitResult & {
  flags: GovernorFlags;
};

function openLimitsFromTier(): CohortLimits {
  const free = getHostedLimitsForTier('free');
  return {
    maxSites: free.maxSites ?? 1,
    maxUsers: free.maxUsers ?? 3,
    maxAgentTasks: free.maxAgentTasks ?? 1_000,
  };
}

function detectDeploymentMode(env: NodeJS.ProcessEnv): 'hosted' | 'forge' | 'unknown' {
  const raw = env.REVEALUI_DEPLOYMENT_MODE?.trim().toLowerCase();
  if (raw === 'hosted') return 'hosted';
  if (raw === 'forge') return 'forge';
  // Overlap window: key presence ≈ hosted (same as isHostedDeployment fallback)
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
 * Pre-check free intake. Call **before** signUp / identity create.
 * PR-3: shadow defaults → always admit (never waitlist response).
 */
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
    openLimits: openLimitsFromTier(),
    now: input.now,
  });

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
