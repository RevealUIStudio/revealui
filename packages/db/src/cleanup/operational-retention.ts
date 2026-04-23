/**
 * Operational Hygiene Retention
 *
 * Purges terminal rows from internal queue / idempotency / reconciliation
 * tables past their retention windows. Keeps hot tables lean; no PII
 * concerns (these are internal operational state, not user data).
 *
 * See ~/suite/.jv/docs/cr8-p3-02-retention-design.md for the decision
 * record. Part of the CR8-P3-02 arc:
 *   - PR1 (revealui#495): app_logs + error_events retention
 *   - PR2 (revealui#499): jobs + processed_webhook_events retention
 *   - fix  (revealui#500): missing unreconciled_webhooks migration (0010)
 *   - this PR: extends PR2 with unreconciled_webhooks retention now that
 *     the migration is in place.
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
 *
 *   - unreconciled_webhooks (resolvedAt IS NOT NULL AND resolvedAt < cutoff)
 *     → REVEALUI_WEBHOOK_RECONCILIATION_RETENTION_DAYS (default 90)
 *     SAFETY: only purges resolved rows. Unresolved rows represent open
 *     customer-payment-fulfillment bugs and MUST persist until manually
 *     reconciled. resolvedAt=NULL rows are skipped unconditionally.
 */

import { and, inArray, isNotNull, lt } from 'drizzle-orm';
import { getClient } from '../client/index.js';
import { jobs } from '../schema/jobs.js';
import { processedWebhookEvents } from '../schema/webhook-events.js';
import { unreconciledWebhooks } from '../schema/webhook-reconciliation.js';

export type OperationalRetentionTable = 'jobs' | 'webhookEvents' | 'unreconciledWebhooks';

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
  unreconciledWebhooks: number;
  dryRun: boolean;
  windows: Record<OperationalRetentionTable, number>;
  cutoffs: Record<OperationalRetentionTable, Date>;
}

const ALL_TABLES: OperationalRetentionTable[] = ['jobs', 'webhookEvents', 'unreconciledWebhooks'];

const DEFAULT_WINDOWS: Record<OperationalRetentionTable, number> = {
  jobs: 30,
  webhookEvents: 90,
  unreconciledWebhooks: 90,
};

const ENV_VARS: Record<OperationalRetentionTable, string> = {
  jobs: 'REVEALUI_JOB_RETENTION_DAYS',
  webhookEvents: 'REVEALUI_WEBHOOK_EVENT_RETENTION_DAYS',
  unreconciledWebhooks: 'REVEALUI_WEBHOOK_RECONCILIATION_RETENTION_DAYS',
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
 *   - `unreconciled_webhooks`: only rows with resolvedAt IS NOT NULL are
 *     considered. Open reconciliation work is never silently purged.
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
    unreconciledWebhooks: resolveWindow('unreconciledWebhooks', overrides.unreconciledWebhooks),
  };

  const now = Date.now();
  const cutoffs: Record<OperationalRetentionTable, Date> = {
    jobs: new Date(now - windows.jobs * 24 * 60 * 60 * 1000),
    webhookEvents: new Date(now - windows.webhookEvents * 24 * 60 * 60 * 1000),
    unreconciledWebhooks: new Date(now - windows.unreconciledWebhooks * 24 * 60 * 60 * 1000),
  };

  const result: CleanupOperationalResult = {
    jobs: 0,
    webhookEvents: 0,
    unreconciledWebhooks: 0,
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

  if (tables.includes('unreconciledWebhooks')) {
    // SAFETY: only resolved rows. Unresolved = open customer-payment bug.
    const where = and(
      isNotNull(unreconciledWebhooks.resolvedAt),
      lt(unreconciledWebhooks.resolvedAt, cutoffs.unreconciledWebhooks),
    );
    if (dryRun) {
      const rows = await db
        .select({ eventId: unreconciledWebhooks.eventId })
        .from(unreconciledWebhooks)
        .where(where);
      result.unreconciledWebhooks = rows.length;
    } else {
      const deleted = await db.delete(unreconciledWebhooks).where(where).returning();
      result.unreconciledWebhooks = deleted.length;
    }
  }

  return result;
}
