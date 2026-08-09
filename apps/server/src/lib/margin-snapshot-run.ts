/**
 * GAP-256 PR-2 — run one margin snapshot for a UTC calendar day.
 *
 * Read-only against usage_meters / entitlements / catalog.
 * Writes only margin_snapshots (+ optional account_margin_daily).
 * Gated by MARGIN_SNAPSHOT_CRON_ENABLED.
 */

import { randomUUID } from 'node:crypto';
import { logger } from '@revealui/core/observability/logger';
import {
  accountEntitlements,
  accountMarginDaily,
  marginSnapshots,
  usageMeters,
} from '@revealui/db/schema';
import { and, desc, eq, gte, inArray, lt } from 'drizzle-orm';
import { costRatesFromEnv } from './margin-cost-meters.js';
import { splitFreePaidCost, sumCostByAccount } from './margin-cost.js';
import {
  computeMonthlyMrrCents,
  countLivePaidEntitlementsByTier,
  dailyRevenueCentsFromMrr,
  resolveTierPriceCents,
  type MarginDb,
} from './margin-mrr.js';
import { decideSnapshotMode, snapshotModeThresholdsFromEnv } from './margin-snapshot-mode.js';
import { defaultPeriodDateUtc, periodDayBoundsUtc } from './margin-period.js';

export { defaultPeriodDateUtc, periodDayBoundsUtc } from './margin-period.js';

export interface RunMarginSnapshotResult {
  skipped: boolean;
  reason?: string;
  snapshotId?: string;
  periodDate?: string;
  freeCostCents?: number;
  paidCostCents?: number;
  revenueCents?: number;
  netCents?: number;
  mode?: string;
  accountDailyRows?: number;
}

export async function runMarginSnapshot(
  db: MarginDb,
  options?: {
    periodDate?: string;
    now?: Date;
    env?: NodeJS.ProcessEnv;
    writeAccountDaily?: boolean;
  },
): Promise<RunMarginSnapshotResult> {
  const env = options?.env ?? process.env;
  if (env.MARGIN_SNAPSHOT_CRON_ENABLED !== 'true') {
    return { skipped: true, reason: 'MARGIN_SNAPSHOT_CRON_ENABLED not true' };
  }

  const periodDate = options?.periodDate ?? defaultPeriodDateUtc(options?.now);
  const { start, end, asDate } = periodDayBoundsUtc(periodDate);
  const rates = costRatesFromEnv(env);
  const thresholds = snapshotModeThresholdsFromEnv(env);

  // Load usage meters for the day — read only
  const meterRows = (await db
    .select({
      accountId: usageMeters.accountId,
      meterName: usageMeters.meterName,
      durationMs: usageMeters.durationMs,
      errored: usageMeters.errored,
    })
    .from(usageMeters)
    .where(and(gte(usageMeters.periodStart, start), lt(usageMeters.periodStart, end)))) as Array<{
    accountId: string;
    meterName: string;
    durationMs: number | null;
    errored: boolean | null;
  }>;

  const costByAccount = sumCostByAccount(meterRows, rates);

  // Tier map for free/paid split
  const accountIds = [...costByAccount.keys()];
  const tierByAccount = new Map<string, string>();
  if (accountIds.length > 0) {
    const entRows = await db
      .select({
        accountId: accountEntitlements.accountId,
        tier: accountEntitlements.tier,
      })
      .from(accountEntitlements)
      .where(inArray(accountEntitlements.accountId, accountIds));
    for (const row of entRows) {
      tierByAccount.set(row.accountId, row.tier);
    }
  }

  const { freeCostCents, paidCostCents } = splitFreePaidCost(costByAccount, tierByAccount);
  const totalCostCents = freeCostCents + paidCostCents;

  const tierCounts = await countLivePaidEntitlementsByTier(db);
  const prices = await resolveTierPriceCents(db);
  const monthlyMrr = computeMonthlyMrrCents(tierCounts, prices);
  const revenueCents = dailyRevenueCentsFromMrr(monthlyMrr, asDate);
  const netCents = revenueCents - totalCostCents;

  // Prior snapshots for trend (last 13 before this period)
  const priorRows = (await db
    .select({
      periodDate: marginSnapshots.periodDate,
      netCents: marginSnapshots.netCents,
    })
    .from(marginSnapshots)
    .where(lt(marginSnapshots.periodDate, periodDate))
    .orderBy(desc(marginSnapshots.periodDate))
    .limit(13)) as Array<{ periodDate: string; netCents: number }>;

  const priorNet = [...priorRows].reverse().map((r) => r.netCents);
  const modeDecision = decideSnapshotMode({
    priorNetCents: priorNet,
    freeCostCents,
    paidCostCents,
    revenueCents,
    ...thresholds,
  });

  const snapshotId = randomUUID();
  const computedAt = options?.now ?? new Date();

  // Upsert by period_date: delete then insert (simple; unique on period_date)
  await db.delete(marginSnapshots).where(eq(marginSnapshots.periodDate, periodDate));
  await db.insert(marginSnapshots).values({
    id: snapshotId,
    periodDate,
    freeCostCents,
    paidCostCents,
    totalCostCents,
    revenueCents,
    netCents,
    projected7dCents: modeDecision.projected7dCents,
    freeCostRatio: modeDecision.freeCostRatio,
    mode: modeDecision.mode,
    rates: {
      mcpMinuteCents: rates.mcpMinuteCents,
      cloudMinuteCents: rates.cloudMinuteCents,
      localMinuteCents: rates.localMinuteCents,
    },
    trend: {
      priorPoints: priorNet.length,
      reason: modeDecision.reason,
      projected7dCents: modeDecision.projected7dCents,
    },
    accountCountFree: tierCountsToFreeCount(tierByAccount, costByAccount),
    accountCountPaid: tierCounts.pro + tierCounts.max + tierCounts.enterprise,
    computedAt,
    createdAt: computedAt,
  });

  let accountDailyRows = 0;
  const writeDaily = options?.writeAccountDaily !== false;
  if (writeDaily && costByAccount.size > 0) {
    await db.delete(accountMarginDaily).where(eq(accountMarginDaily.periodDate, periodDate));
    const values = [...costByAccount.entries()].map(([accountId, costCents]) => ({
      id: randomUUID(),
      accountId,
      periodDate,
      costCents,
      agentTasks: 0, // analytics-only; task rollup optional later
      revenueCents: 0, // per-account revenue attribution deferred
      tier: tierByAccount.get(accountId) ?? 'free',
      createdAt: computedAt,
    }));
    // batch insert
    const batchSize = 500;
    for (let i = 0; i < values.length; i += batchSize) {
      const chunk = values.slice(i, i + batchSize);
      await db.insert(accountMarginDaily).values(chunk);
      accountDailyRows += chunk.length;
    }
  }

  logger.info('[margin-snapshot] wrote snapshot', {
    snapshotId,
    periodDate,
    freeCostCents,
    paidCostCents,
    revenueCents,
    netCents,
    mode: modeDecision.mode,
    accountDailyRows,
  });

  return {
    skipped: false,
    snapshotId,
    periodDate,
    freeCostCents,
    paidCostCents,
    revenueCents,
    netCents,
    mode: modeDecision.mode,
    accountDailyRows,
  };
}

function tierCountsToFreeCount(
  tierByAccount: Map<string, string>,
  costByAccount: Map<string, number>,
): number {
  let n = 0;
  for (const accountId of costByAccount.keys()) {
    const tier = tierByAccount.get(accountId) ?? 'free';
    if (tier === 'free') n += 1;
  }
  return n;
}
