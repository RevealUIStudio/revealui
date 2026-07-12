/**
 * Audit write failure classification + ratio tracking.
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
 * There is no metrics/counter primitive (StatsD, prom-client, Sentry metrics)
 * anywhere in this repo today — see the Stage 0 PR description. This module
 * is deliberately just a structured-logger-backed counter, not a new metrics
 * system: `audit_write_failures_total` is a stable log event name intended
 * for log-based counting (Vercel Logs / Datadog / Sentry breadcrumbs), not a
 * Prometheus counter.
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
 * Classify a thrown/rejected audit-write error into one of the four Stage 0
 * failure modes. Checks the `getAuditSecret()` message first (that path
 * throws before any query ever reaches Postgres, so it has no `.code`), then
 * the Postgres SQLSTATE (`.code`) surfaced by both `pg` and
 * `@neondatabase/serverless`, and falls back to `db_error` for anything else
 * (connection failures, timeouts, driver errors).
 */
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

/** Minimum sample size before the ratio alarm can fire — avoids noise on cold start. */
const MIN_SAMPLE_SIZE = 20;
/** Failure ratio above which the whole audit trail is suspect. */
const FAILURE_RATIO_THRESHOLD = 0.01;

interface FailureCounters {
  attempted: number;
  failed: number;
  byReason: Record<AuditWriteFailureReason, number>;
}

function emptyCounters(): FailureCounters {
  return {
    attempted: 0,
    failed: 0,
    byReason: {
      constraint_violation: 0,
      missing_secret: 0,
      schema_mismatch: 0,
      db_error: 0,
    },
  };
}

let counters = emptyCounters();
let ratioAlarmFired = false;

export interface AuditWriteOutcome {
  ok: boolean;
  reason?: AuditWriteFailureReason;
  /** The failed/succeeded event's id, when known — for correlating the log line to a record. */
  eventId?: string;
  eventType?: string;
}

/**
 * Record the outcome of a single audit-log write attempt. Call this from
 * every audit write path (success AND failure) so the ratio reflects the
 * whole system rather than one call site's private view of it.
 *
 * Emits `audit_write_failures_total` on every failure (the log-based counter
 * this module stands in for a real metrics backend), and escalates to
 * `logger.error` once the rolling failure ratio crosses 1% — the signal that
 * would have caught every Stage 0 bug on day one.
 */
export function recordAuditWriteResult(outcome: AuditWriteOutcome): void {
  counters.attempted++;

  if (!outcome.ok) {
    counters.failed++;
    if (outcome.reason) {
      counters.byReason[outcome.reason]++;
    }
    logger.warn('audit_write_failures_total', {
      reason: outcome.reason,
      eventId: outcome.eventId,
      eventType: outcome.eventType,
    });
  }

  if (counters.attempted < MIN_SAMPLE_SIZE) return;

  const ratio = counters.failed / counters.attempted;
  if (ratio > FAILURE_RATIO_THRESHOLD) {
    if (!ratioAlarmFired) {
      ratioAlarmFired = true;
      logger.error('Audit write failure ratio exceeded threshold', {
        attempted: counters.attempted,
        failed: counters.failed,
        ratio,
        threshold: FAILURE_RATIO_THRESHOLD,
        byReason: { ...counters.byReason },
      });
    }
  } else {
    ratioAlarmFired = false;
  }
}

/** Test-only accessor — never call from production code. */
export function getAuditWriteFailureStatsForTest(): FailureCounters {
  return { ...counters, byReason: { ...counters.byReason } };
}

/** Test-only reset — never call from production code. */
export function resetAuditWriteFailureStatsForTest(): void {
  counters = emptyCounters();
  ratioAlarmFired = false;
}
