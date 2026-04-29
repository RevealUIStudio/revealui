/**
 * Edge-compatible email sender for the API service.
 *
 * Thin wrapper over `@revealui/services/email` that preserves the
 * server's historical void-returning + throw-in-prod API. The shared
 * implementation lives in packages/services/src/email and is also used
 * by apps/admin (which exposes its own wrapper that returns the richer
 * { success, error? } shape).
 *
 * Required env vars are documented at packages/services/src/email/index.ts.
 *
 * GAP-138 closure: this used to be a ~210-line parallel implementation of
 * the Gmail JWT flow (see git history). The shared package owns it now.
 */

import { logger } from '@revealui/core/observability/logger';
import {
  type EmailOptions,
  sanitizeEmailHeader,
  sendEmail as sharedSendEmail,
} from '@revealui/services/email';

export type { EmailOptions };
export { sanitizeEmailHeader };

/**
 * Send an email via the configured provider.
 *
 * Behavior preserved from the pre-GAP-138 implementation:
 *   - In `NODE_ENV=production`, throws on any non-success result so
 *     callers (OTP flows, webhook emails) surface delivery failures.
 *   - In dev / test, returns silently when no provider is configured
 *     (the shared package's own logger.warn already documents the miss).
 *
 * Inject the server's observability logger into the shared retry path so
 * Hono request-correlation IDs land in the right sink.
 */
export async function sendEmail(options: EmailOptions): Promise<void> {
  const result = await sharedSendEmail(options, { logger });
  if (!result.success && process.env.NODE_ENV === 'production') {
    throw new Error(result.error || 'Email delivery failed');
  }
}
