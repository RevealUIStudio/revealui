/**
 * Saga Recovery — Sweep and Recover Stuck Sagas
 *
 * Finds saga jobs stuck in 'active' state (indicating the process crashed
 * mid-execution) and marks them as failed. Compensation is not attempted
 * automatically because the step functions are in code, not serialized
 * in the job data — recovery requires re-invoking the saga definition.
 *
 * Designed to run as a periodic cron job or be called manually.
 *
 * @example
 * ```typescript
 * // In a cron handler:
 * const recovered = await recoverStaleSagas(db);
 * // recovered.length contains the count of stuck sagas found
 *
 * // With custom threshold:
 * const recovered = await recoverStaleSagas(db, 10 * 60 * 1000); // 10 minutes
 * ```
 */

import { and, eq, lt, sql } from 'drizzle-orm';
import type { Database } from '../client/index.js';
import { jobs } from '../schema/jobs.js';
import type { SagaCheckpointData } from './types.js';

// Default threshold: 5 minutes (generous for Vercel function timeouts)
const DEFAULT_STALE_THRESHOLD_MS = 5 * 60 * 1000;

export interface RecoveredSaga {
  sagaId: string;
  sagaName: string;
  sagaKey: string;
  completedSteps: string[];
  startedAt: Date | null;
  recoveredAt: Date;
}

/**
 * Find and mark stuck saga jobs as failed.
 *
 * A saga is considered "stuck" if it has been in 'active' state longer
 * than the threshold. This indicates the executing process crashed or
 * timed out without completing or compensating.
 *
 * @param db - Database client
 * @param thresholdMs - How long a saga must be active before it's considered stuck
 * @returns List of recovered saga records
 */
export async function recoverStaleSagas(
  db: Database,
  thresholdMs: number = DEFAULT_STALE_THRESHOLD_MS,
): Promise<RecoveredSaga[]> {
  const cutoff = new Date(Date.now() - thresholdMs);

  // Find stuck saga jobs
  const staleJobs = await db
    .select()
    .from(jobs)
    .where(
      and(eq(jobs.state, 'active'), sql`${jobs.name} LIKE 'saga:%'`, lt(jobs.startedAt, cutoff)),
    );

  if (staleJobs.length === 0) return [];

  const recovered: RecoveredSaga[] = [];
  const now = new Date();

  for (const job of staleJobs) {
    const data = job.data as unknown as SagaCheckpointData | null;
    const sagaName = data?.sagaName ?? job.name.replace('saga:', '');
    const sagaKey = data?.sagaKey ?? 'unknown';
    const completedSteps = data?.completedSteps?.map((s) => s.name) ?? [];

    // Mark as failed with recovery metadata
    await db
      .update(jobs)
      .set({
        state: 'failed',
        output: {
          error: 'Saga recovered from stale active state',
          recoveredAt: now.toISOString(),
          completedStepsAtRecovery: completedSteps,
          originalStartedAt: job.startedAt?.toISOString(),
        } as Record<string, unknown>,
      })
      .where(eq(jobs.id, job.id));

    recovered.push({
      sagaId: job.id,
      sagaName,
      sagaKey,
      completedSteps,
      startedAt: job.startedAt,
      recoveredAt: now,
    });
  }

  return recovered;
}

/**
 * Clean up expired idempotency keys.
 * Should be called periodically to prevent the table from growing unbounded.
 *
 * @param db - Database client
 * @returns Number of expired keys deleted
 */
export async function cleanupExpiredIdempotencyKeys(db: Database): Promise<number> {
  // Dynamic import to avoid circular dependency at module load time
  const { idempotencyKeys } = await import('../schema/idempotency.js');

  const result = await db
    .delete(idempotencyKeys)
    .where(lt(idempotencyKeys.expiresAt, new Date()))
    .returning();

  return result.length;
}
