/**
 * Operational Hygiene Retention
 *
 * Purges terminal rows from internal queue and idempotency tables past
 * their retention windows. Keeps hot tables lean; no PII concerns (these
 * are internal operational state, not user data).
 *
 * See ~/suite/.jv/docs/cr8-p3-02-retention-design.md for the decision
 * record. This is PR2 in the CR8-P3-02 arc; PR1 shipped the log tables.
 *
 * NOTE: the design doc originally called for a third purge on
 * `unreconciled_webhooks`. That table is defined in the Drizzle schema
 * but has no corresponding CREATE TABLE migration (verified 2026-04-22
 * — snapshots at migrations/meta/0006_snapshot.json + 0009_snapshot.json
 * reference it, but no .sql migration creates it). A fresh DB would fail
 * the retention query. Dropped from PR2 scope; tracked in a separate
 * follow-up to ship the missing migration first.
 *
 * Windows:
 *   - jobs (state IN ('completed', 'failed'), completedAt < cutoff)
 *     → REVEALUI_JOB_RETENTION_DAYS (default 30)
 *     Queue rows grow unboundedly with every processed job. 30d gives
 *     post-incident-debugging headroom without table bloat. Active /
 *     created / retry rows are NEVER purged — only terminal states.
 *
 *   - processed_webhook_events (processedAt < cutoff)
 *     → REVEALUI_WEBHOOK_EVENT_RETENTION_DAYS (default 90)
 *     Stripe idempotency markers. Stripe retry horizon is ~24h; 90d is
 *     belt-and-suspenders. No PII.
 */

import { and, inArray, isNotNull, lt } from 'drizzle-orm';
import { getClient } from '../client/index.js';
import { jobs } from '../schema/jobs.js';
import { processedWebhookEvents } from '../schema/webhook-events.js';

export type OperationalRetentionTable = 'jobs' | 'webhookEvents';

export interface CleanupOperationalOptions {
  /** When true, counts rows without deleting (default: false) */
  dryRun?: boolean;
  /** Per-table retention overrides in days; each falls back to its env var, then default */
  retentionDays?: Partial<Record<OperationalRetentionTable, number>>;
  /** Limit cleanup to specific tables; defaults to all */
  tables?: OperationalRetentionTable[];
  /** Optional database client override (used by integration tests with PGlite) */
  db?: ReturnType<typeof getClient>;
}

export interface CleanupOperationalResult {
  jobs: number;
  webhookEvents: number;
  dryRun: boolean;
  windows: Record<OperationalRetentionTable, number>;
  cutoffs: Record<OperationalRetentionTable, Date>;
}

const ALL_TABLES: OperationalRetentionTable[] = ['jobs', 'webhookEvents'];

const DEFAULT_WINDOWS: Record<OperationalRetentionTable, number> = {
  jobs: 30,
  webhookEvents: 90,
};

const ENV_VARS: Record<OperationalRetentionTable, string> = {
  jobs: 'REVEALUI_JOB_RETENTION_DAYS',
  webhookEvents: 'REVEALUI_WEBHOOK_EVENT_RETENTION_DAYS',
};

function resolveWindow(table: OperationalRetentionTable, override?: number): number {
  if (typeof override === 'number') {
    if (!Number.isInteger(override) || override < 1) {
      throw new Error(
        `Invalid retentionDays override for ${table}: ${override}. Must be a positive integer.`,
      );
    }
    return override;
  }
  const envValue = process.env[ENV_VARS[table]];
  if (envValue) {
    const parsed = Number.parseInt(envValue, 10);
    if (Number.isInteger(parsed) && parsed >= 1) {
      return parsed;
    }
  }
  return DEFAULT_WINDOWS[table];
}

/**
 * Deletes (or counts, in dry-run mode) terminal rows from operational tables
 * past their retention windows.
 *
 * Safety guarantees:
 *   - `jobs`: only rows with state IN ('completed', 'failed') are considered.
 *     Active / created / retry rows survive regardless of age.
 *   - `processed_webhook_events`: no protected state; all rows past the
 *     window are purgeable (idempotency markers are bounded by time, not
 *     state).
 */
export async function cleanupOperational(
  options: CleanupOperationalOptions = {},
): Promise<CleanupOperationalResult> {
  const { dryRun = false, tables = ALL_TABLES, db: dbOverride } = options;
  const overrides = options.retentionDays ?? {};
  const db = dbOverride ?? getClient();

  const windows: Record<OperationalRetentionTable, number> = {
    jobs: resolveWindow('jobs', overrides.jobs),
    webhookEvents: resolveWindow('webhookEvents', overrides.webhookEvents),
  };

  const now = Date.now();
  const cutoffs: Record<OperationalRetentionTable, Date> = {
    jobs: new Date(now - windows.jobs * 24 * 60 * 60 * 1000),
    webhookEvents: new Date(now - windows.webhookEvents * 24 * 60 * 60 * 1000),
  };

  const result: CleanupOperationalResult = {
    jobs: 0,
    webhookEvents: 0,
    dryRun,
    windows,
    cutoffs,
  };

  if (tables.includes('jobs')) {
    // SAFETY: terminal states only. Never purge 'active', 'created', 'retry'.
    // Use completedAt as the cutoff column so a long-running job that just
    // completed isn't wrongly considered "old" by its createdAt.
    const where = and(
      inArray(jobs.state, ['completed', 'failed']),
      isNotNull(jobs.completedAt),
      lt(jobs.completedAt, cutoffs.jobs),
    );
    if (dryRun) {
      const rows = await db.select({ id: jobs.id }).from(jobs).where(where);
      result.jobs = rows.length;
    } else {
      const deleted = await db.delete(jobs).where(where).returning();
      result.jobs = deleted.length;
    }
  }

  if (tables.includes('webhookEvents')) {
    const where = lt(processedWebhookEvents.processedAt, cutoffs.webhookEvents);
    if (dryRun) {
      const rows = await db
        .select({ id: processedWebhookEvents.id })
        .from(processedWebhookEvents)
        .where(where);
      result.webhookEvents = rows.length;
    } else {
      const deleted = await db.delete(processedWebhookEvents).where(where).returning();
      result.webhookEvents = deleted.length;
    }
  }

  return result;
}
