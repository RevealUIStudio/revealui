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
 *
 * Pro boundary: `@revealui/services` is an optional peer dep, so we
 * dynamic-import via getServicesEmail() and fall through gracefully when
 * the package is absent (per 8c19db537). Static top-level imports here
 * would crash module resolution at server startup whenever the runtime
 * image doesn't ship @revealui/services.
 */

import { logger } from '@revealui/core/observability/logger';
import type { EmailOptions } from '@revealui/services/email';
import { getServicesEmail } from './services-loader.js';

export type { EmailOptions };

/**
 * Strip CR and LF from email header values to prevent header injection.
 *
 * Inlined locally (rather than re-exporting from `@revealui/services/email`)
 * so callers don't trigger a dynamic load just to sanitize a header. The
 * implementation matches the shared one exactly — see the test cases in
 * `__tests__/email.test.ts`.
 */
export function sanitizeEmailHeader(value: string): string {
  return value.replaceAll('\r', '').replaceAll('\n', '');
}

/**
 * Send an email via the configured provider.
 *
 * Behavior preserved from the pre-GAP-138 implementation:
 *   - In `NODE_ENV=production`, throws on any non-success result so
 *     callers (OTP flows, webhook emails) surface delivery failures.
 *   - In dev / test, returns silently when no provider is configured
 *     (the shared package's own logger.warn already documents the miss).
 *
 * Pro boundary: when `@revealui/services` is not installed, behaves the
 * same as a missing provider — silent no-op in dev, throws in production.
 *
 * Inject the server's observability logger into the shared retry path so
 * Hono request-correlation IDs land in the right sink.
 */
export async function sendEmail(options: EmailOptions): Promise<void> {
  const services = await getServicesEmail();
  if (!services) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('Email send failed: @revealui/services not installed');
    }
    logger.warn('@revealui/services/email unavailable — email send skipped');
    return;
  }
  const result = await services.sendEmail(options, { logger });
  if (!result.success && process.env.NODE_ENV === 'production') {
    throw new Error(result.error || 'Email delivery failed');
  }
}
