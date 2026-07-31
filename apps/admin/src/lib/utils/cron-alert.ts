/**
 * Admin-side cron failure alert helper.
 *
 * Thin adapter over `@revealui/core/observability/cron-failure-alert`
 * (shared with apps/server). Injects the Next.js Sentry SDK. Email fan-out
 * is not wired on admin today (no server-equivalent transport); add via the
 * core `sendEmail` option when that path exists.
 */

import {
  type CronFailureContext,
  type CronFailureSentryLike,
  sendCronFailureAlert as sendCronFailureAlertCore,
} from '@revealui/core/observability/cron-failure-alert';
import * as Sentry from '@sentry/nextjs';

export type { CronFailureContext };

/**
 * Centralized alert path for admin cron failures. Always logs at the chosen
 * severity. When Sentry is initialised, captures with tags + severity scope.
 *
 * Never throws — each step is independent.
 */
export async function sendCronFailureAlert(context: CronFailureContext): Promise<void> {
  // Next.js SDK is structurally compatible (withScope + captureException).
  await sendCronFailureAlertCore(context, {
    sentry: Sentry as unknown as CronFailureSentryLike,
  });
}
