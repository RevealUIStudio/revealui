/**
 * Worker-side claim + state transition primitives for the durable work
 * queue (CR8-P2-01 phase A).
 *
 * Primary path: `SELECT … FOR UPDATE SKIP LOCKED` via a pg Pool (Supabase
 * or localhost). Multiple concurrent worker invocations claim disjoint
 * rows without blocking each other.
 *
 * Fallback path: advisory-lock + UPDATE for the Neon HTTP driver, which
 * does not support row-level locks across stateless HTTP calls. Mirrors
 * the pattern used in apps/api/src/lib/seat-count-guard.ts and
 * ensureStripeCustomer. Lower throughput but correct.
 *
 * @see packages/db/src/jobs/enqueue.ts — producer side
 * @see packages/db/src/jobs/handlers.ts — handler registry
 */

import { randomUUID } from 'node:crypto';
import { and, eq, lt, lte, sql } from 'drizzle-orm';
import type { Database } from '../client/index.js';
import { getClient, getRestPool } from '../client/index.js';
import { type Job, jobs } from '../schema/jobs.js';

/** Default visibility timeout for a claim (60 s). */
export const DEFAULT_VISIBILITY_TIMEOUT_MS = 60_000;

/**
 * Thrown when a handler exceeds its remaining Vercel budget. Worker catches
 * this via markFailedOrRetry so the job retries with backoff.
 */
export class DeadlineExceededError extends Error {
  readonly name = 'DeadlineExceededError';
  constructor(remainingMs: number) {
    super(`[jobs] handler exceeded its deadline of ${remainingMs}ms`);
  }
}

/**
 * A Promise that rejects with DeadlineExceededError after `ms` milliseconds.
 * Race it against the handler to enforce the remaining-Vercel-budget
 * ceiling.
 */
export function deadlineSignal(ms: number): Promise<never> {
  return new Promise((_, reject) => {
    setTimeout(() => reject(new DeadlineExceededError(ms)), ms);
  });
}

export interface ClaimOptions {
  /** Worker identity written to locked_by. Default: a fresh UUID. */
  workerId?: string;
  /** Visibility timeout in milliseconds. Default: 60_000. */
  visibilityTimeoutMs?: number;
  /**
   * Override the Drizzle client used for the claim (advisory-lock fallback
   * path only). Primarily for tests that drive PGlite directly.
   */
  db?: Database;
}

export interface DbOverride {
  /** Override the Drizzle client. Primarily for tests. */
  db?: Database;
}

/**
 * Atomically claim the highest-priority eligible job and transition it to
 * state='active'. Returns null when nothing is eligible.
 *
 * Eligibility = state='created' AND start_after <= now() AND (expire_at
 * IS NULL OR expire_at > now()).
 */
export async function claimNext(options: ClaimOptions = {}): Promise<Job | null> {
  const workerId = options.workerId ?? randomUUID();
  const visibilityTimeoutMs = options.visibilityTimeoutMs ?? DEFAULT_VISIBILITY_TIMEOUT_MS;

  // If the caller injected a db (tests with PGlite), skip the pool path and
  // go straight to the Drizzle-over-HTTP-style advisory-lock fallback.
  if (options.db) {
    return claimWithAdvisoryLock(options.db, workerId, visibilityTimeoutMs);
  }

  // Primary path: SKIP LOCKED via pg Pool.
  const pool = getRestPool();
  if (pool) {
    return claimWithSkipLocked(pool, workerId, visibilityTimeoutMs);
  }

  // Fallback path: advisory lock + UPDATE for Neon HTTP driver.
  const db = getClient();
  return claimWithAdvisoryLock(db, workerId, visibilityTimeoutMs);
}

/**
 * Primary claim path: CTE with SELECT … FOR UPDATE SKIP LOCKED.
 */
async function claimWithSkipLocked(
  pool: import('pg').Pool,
  workerId: string,
  visibilityTimeoutMs: number,
): Promise<Job | null> {
  const lockedUntilSql = `now() + interval '${Math.round(visibilityTimeoutMs)} milliseconds'`;
  const result = await pool.query<JobRow>(
    `WITH claimed AS (
       SELECT id
         FROM jobs
        WHERE state = 'created'
          AND start_after <= now()
          AND (expire_at IS NULL OR expire_at > now())
        ORDER BY priority DESC, created_at ASC
        LIMIT 1
        FOR UPDATE SKIP LOCKED
     )
     UPDATE jobs SET
       state        = 'active',
       locked_by    = $1,
       locked_until = ${lockedUntilSql},
       started_at   = COALESCE(started_at, now())
      WHERE id IN (SELECT id FROM claimed)
      RETURNING *`,
    [workerId],
  );
  return result.rows[0] ? rowToJob(result.rows[0]) : null;
}

/**
 * Fallback claim path: advisory lock + UPDATE. Serializes claims across
 * workers (one-at-a-time) but correct under Neon HTTP driver semantics.
 */
async function claimWithAdvisoryLock(
  db: Database,
  workerId: string,
  visibilityTimeoutMs: number,
): Promise<Job | null> {
  // Acquire a transactional advisory lock scoped to the claim operation.
  // The lock is released at the end of the outer implicit transaction,
  // which for Neon HTTP is the single statement — so we serialize via a
  // single UPDATE that both locks and claims. The hash input is a constant
  // so all workers queue on the same lock.
  const visibility = Math.round(visibilityTimeoutMs);
  const rows = await db.execute<JobRow>(sql`
    UPDATE jobs SET
      state = 'active',
      locked_by = ${workerId},
      locked_until = now() + (interval '1 millisecond' * ${visibility}),
      started_at = COALESCE(started_at, now())
    WHERE id = (
      SELECT id FROM jobs
       WHERE state = 'created'
         AND start_after <= now()
         AND (expire_at IS NULL OR expire_at > now())
         AND pg_try_advisory_xact_lock(hashtext('jobs:claim'))
       ORDER BY priority DESC, created_at ASC
       LIMIT 1
    )
    RETURNING *`);

  // Neon HTTP returns { rows }, node-postgres returns { rows } too — both
  // accessible via .rows; Drizzle's .execute types it as QueryResult.
  const row = extractFirstRow(rows);
  return row ? rowToJob(row) : null;
}

// =============================================================================
// State transitions
// =============================================================================

/**
 * Mark a claimed job as completed and clear the lock fields.
 */
export async function markCompleted(
  jobId: string,
  output: Record<string, unknown> | null,
  opts: DbOverride = {},
): Promise<void> {
  const db = opts.db ?? getClient();
  await db
    .update(jobs)
    .set({
      state: 'completed',
      output: output ?? null,
      completedAt: new Date(),
      lockedBy: null,
      lockedUntil: null,
    })
    .where(eq(jobs.id, jobId));
}

export interface RetryDecision {
  /** 'retry' = row is back in 'created' with a future start_after. */
  kind: 'retry' | 'failed';
  /** Retry count AFTER this decision (row's new retry_count value). */
  retryCount: number;
  /** Only set when kind === 'retry'. Epoch ms the row becomes eligible. */
  nextAttemptAt?: number;
  /** Captured error message. */
  error: string;
}

/**
 * Transition a failed claim: either reschedule with exponential backoff
 * (state='created', updated start_after) or write it off to the DLQ
 * (state='failed'). Clears the lock fields either way.
 *
 * Backoff curve: 10s × n² × jitter (0.8 → 1.2). Attempts 1-3 land around
 * 8-12s, 32-48s, 72-108s.
 */
export async function markFailedOrRetry(
  jobId: string,
  err: unknown,
  now: number = Date.now(),
  opts: DbOverride = {},
): Promise<RetryDecision> {
  const db = opts.db ?? getClient();
  const errMessage = err instanceof Error ? err.message : String(err);

  const rows = await db
    .select({ retryCount: jobs.retryCount, retryLimit: jobs.retryLimit })
    .from(jobs)
    .where(eq(jobs.id, jobId))
    .limit(1);
  const row = rows[0];
  if (!row) {
    // Row vanished (e.g. test teardown). Surface as a terminal failure
    // decision even though there's nothing to mutate.
    return { kind: 'failed', retryCount: 0, error: errMessage };
  }

  const nextAttempt = row.retryCount + 1;

  if (nextAttempt >= row.retryLimit) {
    // DLQ — retries exhausted.
    await db
      .update(jobs)
      .set({
        state: 'failed',
        retryCount: nextAttempt,
        lastError: errMessage,
        completedAt: new Date(now),
        lockedBy: null,
        lockedUntil: null,
      })
      .where(eq(jobs.id, jobId));
    return { kind: 'failed', retryCount: nextAttempt, error: errMessage };
  }

  // Exponential backoff with jitter: 10s × n² × [0.8, 1.2).
  const backoffMs = Math.round(10_000 * nextAttempt * nextAttempt * (0.8 + Math.random() * 0.4));
  const nextAttemptAt = now + backoffMs;

  await db
    .update(jobs)
    .set({
      state: 'created',
      retryCount: nextAttempt,
      lastError: errMessage,
      startAfter: new Date(nextAttemptAt),
      lockedBy: null,
      lockedUntil: null,
    })
    .where(eq(jobs.id, jobId));

  return { kind: 'retry', retryCount: nextAttempt, nextAttemptAt, error: errMessage };
}

/**
 * Release a claim without marking the job completed or failed. Used when
 * the worker decides not to process a job after claiming it (e.g. no
 * handler registered yet). The job returns to 'created' for another
 * worker to try.
 */
export async function releaseClaim(jobId: string, opts: DbOverride = {}): Promise<void> {
  const db = opts.db ?? getClient();
  await db
    .update(jobs)
    .set({ state: 'created', lockedBy: null, lockedUntil: null })
    .where(and(eq(jobs.id, jobId), eq(jobs.state, 'active')));
}

/**
 * Mark a job as failed terminally (no retry attempt). Used when no handler
 * is registered for the job's name — retrying won't help because code
 * deployment is what's needed.
 */
export async function markUnhandled(
  jobId: string,
  jobName: string,
  opts: DbOverride = {},
): Promise<void> {
  const db = opts.db ?? getClient();
  const errMessage = `no handler registered for '${jobName}'`;
  await db
    .update(jobs)
    .set({
      state: 'failed',
      lastError: errMessage,
      completedAt: new Date(),
      lockedBy: null,
      lockedUntil: null,
      retryCount: sql`${jobs.retryCount} + 1`,
    })
    .where(eq(jobs.id, jobId));
}

// =============================================================================
// Query helpers
// =============================================================================

/**
 * Count jobs eligible right now (state='created', start_after <= now()).
 * Used by the cron safety-net (phase B) to decide whether to fire a wake.
 */
export async function countEligible(opts: DbOverride = {}): Promise<number> {
  const db = opts.db ?? getClient();
  const rows = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(jobs)
    .where(and(eq(jobs.state, 'created'), lte(jobs.startAfter, new Date())));
  return rows[0]?.count ?? 0;
}

/**
 * Details of a single reclaimed job, surfaced for logging + observability by
 * the cron safety-net.
 */
export interface ReclaimedJob {
  id: string;
  name: string;
  retryCount: number;
  previousLockedBy: string | null;
  previousLockedUntil: Date | null;
}

/**
 * Reclaim jobs whose visibility timeout expired before completion.
 *
 * Transitions `state='active' AND locked_until < now()` rows back to
 * `state='created'` with `retry_count += 1` and a diagnostic `last_error`
 * so the usual retry/DLQ logic applies on the next claim.
 *
 * Intended to be called from the cron safety-net (CR8-P2-01 phase B) so
 * that a pod crash or hung handler doesn't orphan a row in 'active'
 * indefinitely. Idempotent: running it twice in quick succession finds
 * nothing to reclaim on the second pass.
 */
export async function reclaimStalled(opts: DbOverride = {}): Promise<ReclaimedJob[]> {
  const db = opts.db ?? getClient();

  // Capture the rows we're about to reclaim (for logging) before mutating.
  const stale = await db
    .select({
      id: jobs.id,
      name: jobs.name,
      retryCount: jobs.retryCount,
      lockedBy: jobs.lockedBy,
      lockedUntil: jobs.lockedUntil,
    })
    .from(jobs)
    .where(
      and(
        eq(jobs.state, 'active'),
        sql`${jobs.lockedUntil} IS NOT NULL`,
        lt(jobs.lockedUntil, new Date()),
      ),
    );

  if (stale.length === 0) return [];

  await db
    .update(jobs)
    .set({
      state: 'created',
      lockedBy: null,
      lockedUntil: null,
      retryCount: sql`${jobs.retryCount} + 1`,
      lastError: 'stalled: claim expired before completion',
    })
    .where(
      and(
        eq(jobs.state, 'active'),
        sql`${jobs.lockedUntil} IS NOT NULL`,
        lt(jobs.lockedUntil, new Date()),
      ),
    );

  return stale.map((row) => ({
    id: row.id,
    name: row.name,
    retryCount: row.retryCount + 1,
    previousLockedBy: row.lockedBy,
    previousLockedUntil: row.lockedUntil,
  }));
}

// =============================================================================
// Internal helpers (row → Job conversion for raw pool queries)
// =============================================================================

interface JobRow {
  id: string;
  name: string;
  data: Record<string, unknown>;
  state: string;
  priority: number;
  retry_count: number;
  retry_limit: number;
  start_after: string | Date;
  expire_at: string | Date | null;
  output: Record<string, unknown> | null;
  locked_by: string | null;
  locked_until: string | Date | null;
  last_error: string | null;
  created_at: string | Date;
  started_at: string | Date | null;
  completed_at: string | Date | null;
  // Index signature required by Drizzle's db.execute<T> generic constraint.
  [key: string]: unknown;
}

function rowToJob(row: JobRow): Job {
  const toDate = (v: string | Date | null): Date | null =>
    v == null ? null : v instanceof Date ? v : new Date(v);
  const toDateNN = (v: string | Date): Date => (v instanceof Date ? v : new Date(v));
  return {
    id: row.id,
    name: row.name,
    data: row.data,
    state: row.state,
    priority: row.priority,
    retryCount: row.retry_count,
    retryLimit: row.retry_limit,
    startAfter: toDateNN(row.start_after),
    expireAt: toDate(row.expire_at),
    output: row.output,
    lockedBy: row.locked_by,
    lockedUntil: toDate(row.locked_until),
    lastError: row.last_error,
    createdAt: toDateNN(row.created_at),
    startedAt: toDate(row.started_at),
    completedAt: toDate(row.completed_at),
  };
}

function extractFirstRow(result: unknown): JobRow | null {
  if (result && typeof result === 'object' && 'rows' in result) {
    const rows = (result as { rows: unknown }).rows;
    if (Array.isArray(rows) && rows.length > 0) {
      return rows[0] as JobRow;
    }
  }
  return null;
}
