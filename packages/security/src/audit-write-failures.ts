/**
 * Audit write failure classification + rolling-ratio tracking.
 *
 * Stage 0 finding: an audit write can fail for four distinct reasons
 * (a rejected severity value, a missing signing secret, a schema mismatch in
 * a hand-rolled writer, or a generic DB error) and every one of them produced
 * identical silence — the failure vanished into a `.catch()` with no log line
 * and no counter. Every audit write path funnels its outcome through
 * `recordAuditWriteResult()` so failures are classified and counted in one
 * place, and a failure ratio that would otherwise mean "the audit trail has
 * gone silent" gets escalated loudly instead.
 *
 * This module counts SILENTLY. It never logs per attempt or per failure —
 * each call site already owns its own event-level logging at whatever
 * cadence makes sense for that call site (e.g. `middleware/audit.ts`'s
 * existing 1-in-10 throttle). The only thing this module ever emits is the
 * rolling-ratio escalation below. Emitting a log line here on every failure
 * would sit underneath every call site's own throttle and multiply log
 * volume during exactly the condition (near-100% failure) this module
 * exists to catch — that was tried and reverted.
 *
 * There is no metrics/counter primitive (StatsD, prom-client, Sentry metrics)
 * anywhere in this repo today — see the Stage 0 PR description. This is an
 * in-process counter, not a new metrics system.
 *
 * The ratio is computed over a fixed-size ROLLING WINDOW of the last
 * `WINDOW_SIZE` attempts, not a lifetime cumulative count. A cumulative
 * count never decays: once enough failures accrue to cross the threshold,
 * diluting it back down would require roughly 100x as many subsequent
 * successes, so in practice the alarm could fire at most once per process
 * and could never re-arm for a second, later failure spike. The rolling
 * window ages failures out as new attempts come in, so the ratio reflects
 * recent behavior and the alarm can legitimately re-fire after a recovery.
 */

import { logger } from '@revealui/utils/logger';

export type AuditWriteFailureReason =
  | 'constraint_violation'
  | 'missing_secret'
  | 'schema_mismatch'
  | 'db_error';

// Postgres SQLSTATE codes relevant to audit_log writes. Not authored regex —
// plain string constants matched against the driver's `.code` property.
// Reference: https://www.postgresql.org/docs/current/errcodes-appendix.html
const CHECK_VIOLATION = '23514';
const UNIQUE_VIOLATION = '23505';
const NOT_NULL_VIOLATION = '23502';
const UNDEFINED_COLUMN = '42703';
const UNDEFINED_TABLE = '42P01';

const CONSTRAINT_VIOLATION_CODES = new Set([CHECK_VIOLATION, UNIQUE_VIOLATION, NOT_NULL_VIOLATION]);
const SCHEMA_MISMATCH_CODES = new Set([UNDEFINED_COLUMN, UNDEFINED_TABLE]);

/**
 * Extract a Postgres SQLSTATE `.code` from an error, checking the error
 * itself and then one level of `.cause` — drizzle-orm wraps every driver
 * error in a `DrizzleQueryError` whose own `.code` is undefined; the real
 * `pg`/`@neondatabase/serverless` error (and its `.code`) lives at
 * `error.cause`.
 */
function extractPgErrorCode(error: unknown): string | undefined {
  for (const candidate of [error, error instanceof Error ? error.cause : undefined]) {
    if (
      candidate &&
      typeof candidate === 'object' &&
      'code' in candidate &&
      typeof candidate.code === 'string'
    ) {
      return candidate.code;
    }
  }
  return undefined;
}

/**
 * Classify a thrown/rejected audit-write error into one of the four Stage 0
 * failure modes. Checks the `getAuditSecret()` message first (that path
 * throws before any query ever reaches Postgres, so it has no `.code`), then
 * the Postgres SQLSTATE (`.code`) surfaced by both `pg` and
 * `@neondatabase/serverless`, and falls back to `db_error` for anything else
 * (connection failures, timeouts, driver errors).
 */
export function classifyAuditWriteFailure(error: unknown): AuditWriteFailureReason {
  if (error instanceof Error && error.message.startsWith('Audit HMAC signing requires')) {
    return 'missing_secret';
  }
  const code = extractPgErrorCode(error);
  if (code) {
    if (CONSTRAINT_VIOLATION_CODES.has(code)) return 'constraint_violation';
    if (SCHEMA_MISMATCH_CODES.has(code)) return 'schema_mismatch';
  }
  return 'db_error';
}

/** Number of most-recent attempts the rolling ratio is computed over. */
const WINDOW_SIZE = 500;
/** Minimum attempts IN THE WINDOW before the ratio alarm can fire — avoids noise on cold start. */
const MIN_SAMPLE_SIZE = 20;
/** Failure ratio above which the whole audit trail is suspect. */
const FAILURE_RATIO_THRESHOLD = 0.01;

export interface AuditWriteOutcome {
  ok: boolean;
  reason?: AuditWriteFailureReason;
  /** The failed/succeeded event's id, when known — surfaced only in the ratio-escalation log, never per-attempt. */
  eventId?: string;
  eventType?: string;
}

interface FailureCounters {
  attempted: number;
  failed: number;
  byReason: Record<AuditWriteFailureReason, number>;
}

function emptyByReason(): Record<AuditWriteFailureReason, number> {
  return { constraint_violation: 0, missing_secret: 0, schema_mismatch: 0, db_error: 0 };
}

let window: AuditWriteOutcome[] = [];
let ratioAlarmFired = false;
let lastFailure: AuditWriteOutcome | undefined;

function computeCounters(): FailureCounters {
  const byReason = emptyByReason();
  let failed = 0;
  for (const outcome of window) {
    if (!outcome.ok) {
      failed++;
      if (outcome.reason) byReason[outcome.reason]++;
    }
  }
  return { attempted: window.length, failed, byReason };
}

/**
 * Record the outcome of a single audit-log write attempt. Call this from
 * every audit write path (success AND failure) so the ratio reflects the
 * whole system rather than one call site's private view of it.
 *
 * Counts silently. Escalates to `logger.error` once the rolling failure
 * ratio (over the last `WINDOW_SIZE` attempts) crosses 1% — the signal that
 * would have caught every Stage 0 bug on day one — and stays quiet while the
 * ratio remains above threshold so the escalation itself doesn't spam.
 */
export function recordAuditWriteResult(outcome: AuditWriteOutcome): void {
  window.push(outcome);
  if (window.length > WINDOW_SIZE) {
    window.shift();
  }
  if (!outcome.ok) {
    lastFailure = outcome;
  }

  const counters = computeCounters();
  if (counters.attempted < MIN_SAMPLE_SIZE) return;

  const ratio = counters.failed / counters.attempted;
  if (ratio > FAILURE_RATIO_THRESHOLD) {
    if (!ratioAlarmFired) {
      ratioAlarmFired = true;
      logger.error('Audit write failure ratio exceeded threshold', {
        windowSize: counters.attempted,
        failed: counters.failed,
        ratio,
        threshold: FAILURE_RATIO_THRESHOLD,
        byReason: { ...counters.byReason },
        lastFailureEventId: lastFailure?.eventId,
        lastFailureEventType: lastFailure?.eventType,
      });
    }
  } else {
    ratioAlarmFired = false;
  }
}

/** Test-only accessor — never call from production code. */
export function getAuditWriteFailureStatsForTest(): FailureCounters {
  return computeCounters();
}

/** Test-only reset — never call from production code. */
export function resetAuditWriteFailureStatsForTest(): void {
  window = [];
  ratioAlarmFired = false;
  lastFailure = undefined;
}
