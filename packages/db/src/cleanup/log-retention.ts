/**
 * Log Retention Cleanup
 *
 * Purges old rows from `app_logs` and `error_events` past the configured
 * retention window. Runs daily as part of the consolidated cron dispatcher.
 *
 * Retention window comes from `REVEALUI_LOG_RETENTION_DAYS` (default 90).
 * See docs/security/ for the privacy-policy-facing commitment and
 * ~/suite/.jv/docs/cr8-p3-02-retention-design.md for the decision record.
 *
 * Audit logs (`audit_log`) are intentionally excluded — they are
 * append-only by design with tamper-evident hash chains, retained
 * indefinitely for security and compliance purposes (decision D1).
 */

import { lt } from 'drizzle-orm';
import { getClient } from '../client/index.js';
import { appLogs } from '../schema/app-logs.js';
import { errorEvents } from '../schema/error-events.js';

export type LogRetentionTable = 'appLogs' | 'errorEvents';

export interface CleanupLogsOptions {
  /** When true, counts rows without deleting (default: false) */
  dryRun?: boolean;
  /** Override retention window in days; defaults to REVEALUI_LOG_RETENTION_DAYS env (fallback 90) */
  retentionDays?: number;
  /** Limit cleanup to specific tables; defaults to both */
  tables?: LogRetentionTable[];
  /** Optional database client override (used by integration tests with PGlite) */
  db?: ReturnType<typeof getClient>;
}

export interface CleanupLogsResult {
  appLogs: number;
  errorEvents: number;
  dryRun: boolean;
  retentionDays: number;
  cutoff: Date;
}

const ALL_TABLES: LogRetentionTable[] = ['appLogs', 'errorEvents'];
const DEFAULT_RETENTION_DAYS = 90;

function resolveRetentionDays(override?: number): number {
  if (typeof override === 'number') {
    if (!Number.isInteger(override) || override < 1) {
      throw new Error(`Invalid retentionDays override: ${override}. Must be a positive integer.`);
    }
    return override;
  }
  const envValue = process.env.REVEALUI_LOG_RETENTION_DAYS;
  if (envValue) {
    const parsed = Number.parseInt(envValue, 10);
    if (Number.isInteger(parsed) && parsed >= 1) {
      return parsed;
    }
  }
  return DEFAULT_RETENTION_DAYS;
}

/**
 * Deletes (or counts, in dry-run mode) log rows older than the retention window.
 * Reads POSTGRES_URL / DATABASE_URL from the environment via getClient() unless
 * an explicit `db` client is provided.
 */
export async function cleanupOldLogs(options: CleanupLogsOptions = {}): Promise<CleanupLogsResult> {
  const { dryRun = false, tables = ALL_TABLES, db: dbOverride } = options;
  const retentionDays = resolveRetentionDays(options.retentionDays);
  const db = dbOverride ?? getClient();
  const cutoff = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000);

  const result: CleanupLogsResult = {
    appLogs: 0,
    errorEvents: 0,
    dryRun,
    retentionDays,
    cutoff,
  };

  if (tables.includes('appLogs')) {
    const where = lt(appLogs.timestamp, cutoff);
    if (dryRun) {
      const rows = await db.select({ id: appLogs.id }).from(appLogs).where(where);
      result.appLogs = rows.length;
    } else {
      const deleted = await db.delete(appLogs).where(where).returning();
      result.appLogs = deleted.length;
    }
  }

  if (tables.includes('errorEvents')) {
    const where = lt(errorEvents.timestamp, cutoff);
    if (dryRun) {
      const rows = await db.select({ id: errorEvents.id }).from(errorEvents).where(where);
      result.errorEvents = rows.length;
    } else {
      const deleted = await db.delete(errorEvents).where(where).returning();
      result.errorEvents = deleted.length;
    }
  }

  return result;
}
