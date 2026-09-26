/**
 * Sentry Cron Monitor configs for the Fly worker heartbeat and the daily
 * Vercel dispatch. Check-ins upsert the monitor on first send, so no
 * dashboard API call is required. Every path no-ops when SENTRY_DSN is unset.
 *
 * Schedules are UTC and match the emitter:
 * - Fly worker heartbeat: every 5 minutes (independent of GitHub Actions
 *   and Cloudflare).
 * - Vercel dispatch: apps/server/vercel.json cron "0 6 * * *" (06:00 UTC).
 */

import { logger } from '@revealui/core/observability/logger';
import * as Sentry from '@sentry/node';

type MonitorConfig = NonNullable<Parameters<typeof Sentry.captureCheckIn>[1]>;

/** Daily Vercel Hobby cron. Keep in lockstep with apps/server/vercel.json. */
export const DISPATCH_CRONTAB = '0 6 * * *';

/** Fly worker heartbeat cadence. Matches the former 5-minute probe intent. */
export const WORKER_CRONTAB = '*/5 * * * *';

export const DEFAULT_DISPATCH_MONITOR_SLUG = 'vercel-cron-dispatch';
export const DEFAULT_WORKER_MONITOR_SLUG = 'fly-worker-heartbeat';

/** Default heartbeat interval: 5 minutes, in milliseconds. */
export const DEFAULT_WORKER_HEARTBEAT_MS = 5 * 60 * 1000;

export const dispatchMonitorConfig: MonitorConfig = {
  schedule: { type: 'crontab', value: DISPATCH_CRONTAB },
  checkinMargin: 30,
  maxRuntime: 5,
  timezone: 'UTC',
  failureIssueThreshold: 1,
  recoveryThreshold: 1,
};

export const jobMonitorConfig: MonitorConfig = {
  schedule: { type: 'crontab', value: DISPATCH_CRONTAB },
  checkinMargin: 30,
  maxRuntime: 2,
  timezone: 'UTC',
  failureIssueThreshold: 1,
  recoveryThreshold: 1,
};

export const workerMonitorConfig: MonitorConfig = {
  schedule: { type: 'crontab', value: WORKER_CRONTAB },
  checkinMargin: 5,
  maxRuntime: 2,
  timezone: 'UTC',
  failureIssueThreshold: 1,
  recoveryThreshold: 1,
};

/**
 * Sub-jobs that must open a Sentry issue if the daily dispatch skips or
 * fails them. Slugs are `cron-<job name>`.
 */
export const MONITORED_JOB_NAMES: ReadonlySet<string> = new Set([
  'drain-unreconciled',
  'reconcile-subscriptions',
  'reconcile-customers',
  'reconcile-stripe-subscriptions',
  'sweep-grace-periods',
  'reconcile-entitlements',
  'billing-readiness',
]);

export function sentryCronEnabled(env: NodeJS.ProcessEnv = process.env): boolean {
  const dsn = env.SENTRY_DSN;
  return typeof dsn === 'string' && dsn.trim().length > 0;
}

export function resolveDispatchMonitorSlug(env: NodeJS.ProcessEnv = process.env): string {
  const override = env.SENTRY_CRON_DISPATCH_SLUG?.trim();
  return override ? override : DEFAULT_DISPATCH_MONITOR_SLUG;
}

export function resolveWorkerMonitorSlug(env: NodeJS.ProcessEnv = process.env): string {
  const override = env.SENTRY_CRON_WORKER_SLUG?.trim();
  return override ? override : DEFAULT_WORKER_MONITOR_SLUG;
}

export function resolveWorkerHeartbeatMs(env: NodeJS.ProcessEnv = process.env): number {
  const raw = env.SENTRY_CRON_HEARTBEAT_MS?.trim();
  if (!raw) return DEFAULT_WORKER_HEARTBEAT_MS;
  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed <= 0) return DEFAULT_WORKER_HEARTBEAT_MS;
  return parsed;
}

export function jobMonitorSlug(jobName: string): string {
  return `cron-${jobName}`;
}

export function sendWorkerHeartbeat(status: 'ok' | 'error' = 'ok'): void {
  if (!sentryCronEnabled()) return;
  try {
    Sentry.captureCheckIn({ monitorSlug: resolveWorkerMonitorSlug(), status }, workerMonitorConfig);
  } catch (err) {
    logger.warn('Sentry worker heartbeat failed', {
      error: err instanceof Error ? err.message : String(err),
    });
  }
}

let heartbeatTimer: ReturnType<typeof setInterval> | undefined;

/** Emit one check-in immediately, then on the heartbeat interval. */
export function startWorkerSentryHeartbeat(): void {
  sendWorkerHeartbeat('ok');
  if (heartbeatTimer) clearInterval(heartbeatTimer);
  heartbeatTimer = setInterval(() => {
    sendWorkerHeartbeat('ok');
  }, resolveWorkerHeartbeatMs());
  heartbeatTimer.unref?.();
}

/** Stop the heartbeat timer. Used by tests and process shutdown. */
export function stopWorkerSentryHeartbeat(): void {
  if (!heartbeatTimer) return;
  clearInterval(heartbeatTimer);
  heartbeatTimer = undefined;
}
