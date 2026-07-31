/**
 * Shared cron-failure alert path for apps/admin + apps/server.
 *
 * Apps inject their Sentry SDK (+ optional email) so this module never depends
 * on `@sentry/node` or `@sentry/nextjs`. Logger is always the canonical
 * `@revealui/core/observability/logger` facade.
 *
 * Extracted from the intentional admin/server dual (revealui#835 follow-up)
 * after the 2026-07-31 redundancy audit.
 */

import { logger } from './logger.js';

export interface CronFailureContext {
  jobName: string;
  error: Error;
  severity?: 'warn' | 'error' | 'fatal';
  metadata?: Record<string, unknown>;
}

/** Minimal Sentry surface both Node and Next SDKs satisfy. */
export interface CronFailureSentryScope {
  setTag(key: string, value: string): void;
  setLevel(level: 'fatal' | 'error' | 'warning' | string): void;
  setContext(name: string, context: Record<string, unknown>): void;
}

export interface CronFailureSentryLike {
  withScope(callback: (scope: CronFailureSentryScope) => void): void;
  captureException(error: Error): void;
}

export interface CronFailureEmailPayload {
  to: string;
  subject: string;
  html: string;
  text: string;
}

export interface SendCronFailureAlertOptions {
  /** When omitted, Sentry capture is skipped. */
  sentry?: CronFailureSentryLike;
  /**
   * Destination for the optional email step. When omitted, reads
   * `REVEALUI_ALERT_EMAIL` from `env`. Empty/undefined skips email.
   */
  alertEmail?: string | null;
  /** Required for email delivery when an alert address is present. */
  sendEmail?: (payload: CronFailureEmailPayload) => Promise<void>;
  env?: NodeJS.ProcessEnv;
}

export function buildCronFailureEmailBody(context: CronFailureContext): {
  subject: string;
  html: string;
  text: string;
} {
  const { jobName, error, severity = 'error', metadata } = context;
  const subject = `[CRON FAILURE] ${jobName}: ${error.message}`;
  const metaRows = metadata
    ? Object.entries(metadata)
        .map(
          ([k, v]) =>
            `<tr><td style="padding:2px 8px;font-weight:bold">${k}</td><td style="padding:2px 8px">${String(v)}</td></tr>`,
        )
        .join('')
    : '';
  const metaSection = metaRows
    ? `<h3>Metadata</h3><table style="border-collapse:collapse">${metaRows}</table>`
    : '';
  const metaText = metadata
    ? `\nMetadata:\n${Object.entries(metadata)
        .map(([k, v]) => `  ${k}: ${String(v)}`)
        .join('\n')}`
    : '';

  const html = `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><title>${subject}</title></head>
<body style="font-family:Arial,sans-serif;line-height:1.6;color:#333;max-width:600px;margin:0 auto;padding:20px">
  <h1 style="color:#dc2626">Cron Job Failure</h1>
  <p><strong>Job:</strong> ${jobName}</p>
  <p><strong>Severity:</strong> ${severity}</p>
  <p><strong>Error:</strong> ${error.message}</p>
  ${error.stack ? `<pre style="background:#f5f5f5;padding:12px;overflow:auto;font-size:12px">${error.stack}</pre>` : ''}
  ${metaSection}
  <p style="color:#666;font-size:12px">Automated alert from api.revealui.com — ${new Date().toISOString()}</p>
</body>
</html>`;

  const text = `Cron Job Failure\n\nJob: ${jobName}\nSeverity: ${severity}\nError: ${error.message}${metaText}\n\nTimestamp: ${new Date().toISOString()}`;

  return { subject, html, text };
}

/**
 * Centralized alert path for cron failures. Always logs at the chosen
 * severity. Optionally captures to Sentry and/or sends email via injected
 * adapters.
 *
 * Never throws — each step is independent. A failure in one step is logged
 * and does not prevent the others.
 */
export async function sendCronFailureAlert(
  context: CronFailureContext,
  options: SendCronFailureAlertOptions = {},
): Promise<void> {
  const { jobName, error, severity = 'error', metadata } = context;
  const env = options.env ?? process.env;

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

  // Step 2 — Sentry (skipped when no adapter injected)
  const sentry = options.sentry;
  if (sentry) {
    try {
      sentry.withScope((scope) => {
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
        sentry.captureException(error);
      });
    } catch (sentryErr) {
      logger.warn(`[cron-alert] Sentry capture failed for ${jobName}`, {
        detail: sentryErr instanceof Error ? sentryErr.message : String(sentryErr),
      });
    }
  }

  // Step 3 — optional email
  const alertEmail =
    options.alertEmail !== undefined ? options.alertEmail : env.REVEALUI_ALERT_EMAIL;
  if (!alertEmail || !options.sendEmail) {
    return;
  }
  try {
    const { subject, html, text } = buildCronFailureEmailBody(context);
    await options.sendEmail({ to: alertEmail, subject, html, text });
  } catch (emailErr) {
    logger.warn(`[cron-alert] email delivery failed for ${jobName}`, {
      detail: emailErr instanceof Error ? emailErr.message : String(emailErr),
    });
  }
}
