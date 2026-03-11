/**
 * Sentry Configuration for Error Tracking
 *
 * To enable Sentry:
 * 1. Install: pnpm add @sentry/nextjs --filter cms
 * 2. Set environment variables:
 *    - NEXT_PUBLIC_SENTRY_DSN
 *    - SENTRY_AUTH_TOKEN (for source maps)
 * 3. Create sentry.client.config.ts and sentry.server.config.ts
 */

import type * as Sentry from '@sentry/nextjs';

export const sentryConfig: Parameters<typeof Sentry.init>[0] = {
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,

  // Set tracesSampleRate to 1.0 to capture 100%
  // of transactions for performance monitoring.
  // We recommend adjusting this value in production
  tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,

  // Capture Replay for 10% of all sessions,
  // plus for 100% of sessions with an error
  replaysSessionSampleRate: 0.1,
  replaysOnErrorSampleRate: 1.0,

  // Debug mode in development
  debug: process.env.NODE_ENV !== 'production',

  environment: process.env.NODE_ENV || 'development',

  // Ignore common non-critical errors
  ignoreErrors: [
    // Browser extensions
    /extensions\//i,
    /^Non-Error promise rejection captured/i,
    // Network errors
    /NetworkError/i,
    /Failed to fetch/i,
  ],

  beforeSend(event: Sentry.ErrorEvent, _hint?: Sentry.EventHint): Sentry.ErrorEvent | null {
    // Don't send events in development
    if (process.env.NODE_ENV !== 'production') {
      // In development, events are logged but not sent to Sentry
      return null;
    }

    // Filter out sensitive data
    const request = event.request;
    if (request) {
      if (request.cookies) {
        request.cookies = undefined;
      }

      // Redact authorization headers
      if (request.headers) {
        request.headers = Object.keys(request.headers).reduce(
          (acc, key) => {
            if (key.toLowerCase() === 'authorization') {
              acc[key] = '[Redacted]';
            } else {
              const headerValue = request.headers?.[key];
              if (headerValue) {
                acc[key] = headerValue;
              }
            }
            return acc;
          },
          {} as Record<string, string>,
        );
      }
    }

    return event;
  },
};

/**
 * Instructions to complete Sentry setup:
 *
 * 1. Install Sentry SDK:
 *    pnpm add @sentry/nextjs --filter cms
 *
 * 2. Create sentry.client.config.ts:
 *    import * as Sentry from "@sentry/nextjs"
 *    import { sentryConfig } from "./src/lib/config/sentry"
 *    Sentry.init(sentryConfig)
 *
 * 3. Create sentry.server.config.ts:
 *    import * as Sentry from "@sentry/nextjs"
 *    import { sentryConfig } from "./src/lib/config/sentry"
 *    Sentry.init(sentryConfig)
 *
 * 4. Update next.config.mjs:
 *    import { withSentryConfig } from "@sentry/nextjs"
 *    export default withSentryConfig(
 *      withRevealUI(nextConfig),
 *      { silent: true }
 *    )
 *
 * 5. Add to .env.template:
 *    NEXT_PUBLIC_SENTRY_DSN=https://your-sentry-dsn
 *    SENTRY_AUTH_TOKEN=your-sentry-auth-token
 */
