/**
 * Admin-side cron failure alert helper.
 *
 * Mirrors `apps/server/src/lib/cron-alerts.ts` minus the email-fanout step
 * (admin doesn't have a server-equivalent email transport today). Logger
 * + Sentry coverage is the critical path; email fan-out can be added in
 * a follow-up once the helper is extracted to a shared package.
 *
 * TODO (revealui#835 follow-up): extract to `@revealui/observability`
 * (or `@revealui/security/cron`) so apps/server + apps/admin share one
 * caller. The duplication is intentional for the P0 batch — minimizes
 * blast radius.
 */

import { logger } from '@revealui/core/observability/logger';
import * as Sentry from '@sentry/nextjs';

export interface CronFailureContext {
  jobName: string;
  error: Error;
  severity?: 'warn' | 'error' | 'fatal';
  metadata?: Record<string, unknown>;
}

/**
 * Centralized alert path for admin cron failures. Always logs at the chosen
 * severity. When Sentry is initialised, captures with tags + severity scope.
 *
 * Never throws — each step is independent. A failure in one step is logged
 * and does not prevent the others.
 */
export async function sendCronFailureAlert(context: CronFailureContext): Promise<void> {
  const { jobName, error, severity = 'error', metadata } = context;

  // Step 1 — always log
  try {
    const logPayload = { jobName, ...(metadata ?? {}) };
    if (severity === 'fatal' || severity === 'error') {
      logger.error(`[cron-alert] ${jobName} failed: ${error.message}`, error, logPayload);
    } else {
      logger.warn(`[cron-alert] ${jobName} failed: ${error.message}`, logPayload);
    }
  } catch (logErr) {
    // Last-resort: if the logger itself is broken, write directly to stderr
    // so the failure is at least visible in Vercel function logs.
    process.stderr.write(
      `[cron-alert] logger failed while reporting ${jobName}: ${logErr instanceof Error ? logErr.message : String(logErr)}\n`,
    );
  }

  // Step 2 — Sentry capture (no-op when SENTRY_DSN absent / not initialised)
  try {
    Sentry.withScope((scope) => {
      scope.setTag('cron_job', jobName);
      scope.setTag('alert_severity', severity);
      if (metadata) {
        scope.setContext('metadata', metadata);
      }
      if (severity === 'fatal') {
        scope.setLevel('fatal');
      } else if (severity === 'warn') {
        scope.setLevel('warning');
      }
      Sentry.captureException(error);
    });
  } catch (sentryErr) {
    logger.warn(`[cron-alert] Sentry capture failed for ${jobName}`, {
      detail: sentryErr instanceof Error ? sentryErr.message : String(sentryErr),
    });
  }
}
