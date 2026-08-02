/**
 * Server-side cron failure alert helper.
 *
 * Thin adapter over `@revealui/core/observability/cron-failure-alert`
 * (shared with apps/admin). Injects the Node Sentry SDK and the app email
 * transport when `REVEALUI_ALERT_EMAIL` is set.
 */

import {
  type CronFailureContext,
  type CronFailureSentryLike,
  sendCronFailureAlert as sendCronFailureAlertCore,
} from '@revealui/core/observability/cron-failure-alert';
import * as Sentry from '@sentry/node';
import { sendEmail } from './email.js';

export type { CronFailureContext };

/**
 * Centralized alert path for cron failures. Always logs at the chosen
 * severity. When SENTRY_DSN is present, captures to Sentry. When
 * REVEALUI_ALERT_EMAIL is present, sends a structured email via the
 * existing email service.
 *
 * Never throws — each step is independent.
 */
export async function sendCronFailureAlert(context: CronFailureContext): Promise<void> {
  // Node SDK is structurally compatible (withScope + captureException).
  await sendCronFailureAlertCore(context, {
    sentry: Sentry as unknown as CronFailureSentryLike,
    sendEmail: async (payload) => {
      await sendEmail(payload);
    },
  });
}
