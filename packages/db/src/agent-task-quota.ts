/**
 * Shared agent-task admission for the monthly tier quota.
 *
 * One conditional upsert reserves a plan slot. Admin chat and the API
 * task-quota middleware both call this so they increment the same
 * agent_task_usage row. Enterprise (Infinity) meters and never blocks.
 * A failed plan-slot write allows the request, matching the historical
 * middleware. A failed credit decrement blocks.
 */

import { logger } from '@revealui/utils/logger';
import { and, eq, gt, lt, sql } from 'drizzle-orm';
import type { Database } from './client/index.js';
import { agentCreditBalance, agentTaskUsage } from './schema/agents.js';

/** Tracks consecutive DB write failures for observability. */
let quotaWriteFailures = 0;
const FAILURE_LOG_INTERVAL = 10;

function onQuotaWriteError(err: unknown): void {
  quotaWriteFailures++;
  if (quotaWriteFailures % FAILURE_LOG_INTERVAL === 1) {
    logger.warn('Task quota DB write failed', {
      consecutiveFailures: quotaWriteFailures,
      error: err instanceof Error ? err.message : String(err),
    });
  }
}

export interface AdmitAgentTaskInput {
  userId: string;
  /** Infinity meters without blocking. Zero denies unless a credit remains. */
  quota: number;
  now?: Date;
}

export type AdmitAgentTaskResult =
  | { admitted: true }
  | { admitted: false; reason: 'billing_error' }
  | {
      admitted: false;
      reason: 'quota';
      used: number;
      quota: number;
      resetAt: string;
    };

/** UTC timestamp for the start of the calendar month containing `now`. */
export function agentTaskCycleStart(now: Date = new Date()): Date {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
}

function nextCycleStartIso(cycle: Date): string {
  return new Date(Date.UTC(cycle.getUTCFullYear(), cycle.getUTCMonth() + 1, 1)).toISOString();
}

/**
 * Reserve one monthly agent-task slot for `userId`, or report why it was refused.
 * Callers map a refusal onto their own HTTP response (429, 402, or 503).
 */
export async function admitAgentTask(
  db: Database,
  input: AdmitAgentTaskInput,
): Promise<AdmitAgentTaskResult> {
  const quota = input.quota;
  const cycle = agentTaskCycleStart(input.now);

  if (quota === Infinity) {
    void db
      .insert(agentTaskUsage)
      .values({ userId: input.userId, cycleStart: cycle, count: 1, overage: 0 })
      .onConflictDoUpdate({
        target: [agentTaskUsage.userId, agentTaskUsage.cycleStart],
        set: { count: sql`${agentTaskUsage.count} + 1`, updatedAt: new Date() },
      })
      .catch(onQuotaWriteError);
    return { admitted: true };
  }

  // Neon HTTP has no transactions, so the plan slot is one statement:
  // insert the month row, or increment only while count is still under quota.
  if (quota > 0) {
    try {
      const [reserved] = await db
        .insert(agentTaskUsage)
        .values({ userId: input.userId, cycleStart: cycle, count: 1, overage: 0 })
        .onConflictDoUpdate({
          target: [agentTaskUsage.userId, agentTaskUsage.cycleStart],
          set: { count: sql`${agentTaskUsage.count} + 1`, updatedAt: new Date() },
          setWhere: lt(agentTaskUsage.count, quota),
        })
        .returning();

      if (reserved) {
        quotaWriteFailures = 0;
        return { admitted: true };
      }
    } catch (err) {
      onQuotaWriteError(err);
      // Allow the request. One lost increment is better than blocking a paid user.
      return { admitted: true };
    }
  }

  const [row] = await db
    .select({ count: agentTaskUsage.count })
    .from(agentTaskUsage)
    .where(and(eq(agentTaskUsage.userId, input.userId), eq(agentTaskUsage.cycleStart, cycle)))
    .limit(1);

  const current = row?.count ?? 0;

  if (current >= quota) {
    try {
      const [decremented] = await db
        .update(agentCreditBalance)
        .set({
          balance: sql`${agentCreditBalance.balance} - 1`,
          updatedAt: new Date(),
        })
        .where(and(eq(agentCreditBalance.userId, input.userId), gt(agentCreditBalance.balance, 0)))
        .returning();

      if (decremented !== undefined) {
        void db
          .insert(agentTaskUsage)
          .values({ userId: input.userId, cycleStart: cycle, count: current + 1, overage: 1 })
          .onConflictDoUpdate({
            target: [agentTaskUsage.userId, agentTaskUsage.cycleStart],
            set: {
              count: sql`${agentTaskUsage.count} + 1`,
              overage: sql`${agentTaskUsage.overage} + 1`,
              updatedAt: new Date(),
            },
          })
          .catch(onQuotaWriteError);

        return { admitted: true };
      }
    } catch (err) {
      logger.error(
        'Credit deduction failed, blocking task',
        err instanceof Error ? err : undefined,
        { userId: input.userId },
      );
      return { admitted: false, reason: 'billing_error' };
    }

    void db
      .insert(agentTaskUsage)
      .values({ userId: input.userId, cycleStart: cycle, count: current, overage: 1 })
      .onConflictDoUpdate({
        target: [agentTaskUsage.userId, agentTaskUsage.cycleStart],
        set: { overage: sql`${agentTaskUsage.overage} + 1`, updatedAt: new Date() },
      })
      .catch(onQuotaWriteError);

    return {
      admitted: false,
      reason: 'quota',
      used: current,
      quota,
      resetAt: nextCycleStartIso(cycle),
    };
  }

  try {
    await db
      .insert(agentTaskUsage)
      .values({ userId: input.userId, cycleStart: cycle, count: 1, overage: 0 })
      .onConflictDoUpdate({
        target: [agentTaskUsage.userId, agentTaskUsage.cycleStart],
        set: { count: sql`${agentTaskUsage.count} + 1`, updatedAt: new Date() },
      });
    quotaWriteFailures = 0;
  } catch (err) {
    onQuotaWriteError(err);
  }

  return { admitted: true };
}
