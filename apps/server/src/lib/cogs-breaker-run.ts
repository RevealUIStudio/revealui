/**
 * GAP-256 Layer 3 — COGS breaker sweep over account_margin_daily.
 */
import { cogsBreakerFlagsFromEnv, decideCogsBreakerTrip } from '@revealui/core/cogs-breaker';
import { logger } from '@revealui/core/observability/logger';
import { accountEntitlements, accountMarginDaily } from '@revealui/db/schema';
import { and, eq, isNull } from 'drizzle-orm';
import type { MarginDb } from './margin-mrr.js';
import { defaultPeriodDateUtc } from './margin-period.js';

export interface RunCogsBreakerResult {
  skipped: boolean;
  reason?: string;
  periodDate?: string;
  examined?: number;
  tripped?: number;
  alreadyTripped?: number;
}

export async function runCogsBreakerSweep(
  db: MarginDb,
  options?: { periodDate?: string; now?: Date; env?: NodeJS.ProcessEnv },
): Promise<RunCogsBreakerResult> {
  const env = options?.env ?? process.env;
  const flags = cogsBreakerFlagsFromEnv(env as Record<string, string | undefined>);
  if (!flags.enabled) {
    return { skipped: true, reason: 'COGS_BREAKER_ENABLED not true' };
  }
  const periodDate = options?.periodDate ?? defaultPeriodDateUtc(options?.now);
  const now = options?.now ?? new Date();

  const dailyRows = (await db
    .select({
      accountId: accountMarginDaily.accountId,
      costCents: accountMarginDaily.costCents,
      tier: accountMarginDaily.tier,
    })
    .from(accountMarginDaily)
    .where(eq(accountMarginDaily.periodDate, periodDate))) as Array<{
    accountId: string;
    costCents: number;
    tier: string | null;
  }>;

  let examined = 0;
  let tripped = 0;
  let alreadyTripped = 0;

  for (const row of dailyRows) {
    examined += 1;
    const [ent] = (await db
      .select({
        cogsBreakerTrippedAt: accountEntitlements.cogsBreakerTrippedAt,
        tier: accountEntitlements.tier,
      })
      .from(accountEntitlements)
      .where(eq(accountEntitlements.accountId, row.accountId))
      .limit(1)) as Array<{
      cogsBreakerTrippedAt: Date | null;
      tier: string | null;
    }>;

    const decision = decideCogsBreakerTrip({
      tier: ent?.tier ?? row.tier ?? 'free',
      costCents: row.costCents,
      flags,
      alreadyTripped: ent?.cogsBreakerTrippedAt != null,
    });

    if (decision.action === 'already_tripped') {
      alreadyTripped += 1;
      continue;
    }
    if (decision.action !== 'trip') continue;

    await db
      .update(accountEntitlements)
      .set({
        cogsBreakerTrippedAt: now,
        cogsBreakerReason: decision.reason,
        limits: { maxSites: 1, maxUsers: 1, maxAgentTasks: 0 },
        updatedAt: now,
      })
      .where(
        and(
          eq(accountEntitlements.accountId, row.accountId),
          isNull(accountEntitlements.cogsBreakerTrippedAt),
        ),
      );
    tripped += 1;
    logger.info('[cogs-breaker] tripped free account', {
      accountId: row.accountId,
      costCents: row.costCents,
      periodDate,
      reason: decision.reason,
    });
  }

  return { skipped: false, periodDate, examined, tripped, alreadyTripped };
}
