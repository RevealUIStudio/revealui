/**
 * Sentry Configuration for Error Tracking
 *
 * To enable Sentry:
 * 1. Install: pnpm add @sentry/nextjs --filter admin
 * 2. Set environment variables:
 *    - NEXT_PUBLIC_SENTRY_DSN
 *    - SENTRY_AUTH_TOKEN (for source maps)
 * 3. Create sentry.client.config.ts and sentry.server.config.ts
 */

import { resolveSentryEnvironment } from '@revealui/core/sentry-environment';
import type * as Sentry from '@sentry/nextjs';

export const sentryConfig: Parameters<typeof Sentry.init>[0] = {
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,

  // Set tracesSampleRate to 1.0 to capture 100%
  // of transactions for performance monitoring.
  // We recommend adjusting this value in production
  tracesSampleRate: 0,

  // Replay and tracing stay off until analytics consent (cookie banner).
  // HIPAA profile never turns them back on.
  replaysSessionSampleRate: 0,
  replaysOnErrorSampleRate: 0,

  // Debug mode in development
  debug: process.env.NODE_ENV !== 'production',

  environment: resolveSentryEnvironment({
    SENTRY_ENVIRONMENT: process.env.SENTRY_ENVIRONMENT,
    REVEALUI_DEPLOY_ENV: process.env.REVEALUI_DEPLOY_ENV,
    NEXT_PUBLIC_SENTRY_ENVIRONMENT: process.env.NEXT_PUBLIC_SENTRY_ENVIRONMENT,
    NODE_ENV: process.env.NODE_ENV,
    VERCEL_ENV: process.env.VERCEL_ENV,
    REVEALUI_API_URL: process.env.REVEALUI_API_URL,
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL,
    API_URL: process.env.API_URL,
    REVEALUI_PUBLIC_SERVER_URL: process.env.REVEALUI_PUBLIC_SERVER_URL,
    NEXT_PUBLIC_SERVER_URL: process.env.NEXT_PUBLIC_SERVER_URL,
    VERCEL_PROJECT_PRODUCTION_URL: process.env.VERCEL_PROJECT_PRODUCTION_URL,
    VERCEL_URL: process.env.VERCEL_URL,
    SESSION_COOKIE_DOMAIN: process.env.SESSION_COOKIE_DOMAIN,
    PASSKEY_RP_ID: process.env.PASSKEY_RP_ID,
    PASSKEY_ORIGIN: process.env.PASSKEY_ORIGIN,
    CORS_ORIGIN: process.env.CORS_ORIGIN,
  }),

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
 *    pnpm add @sentry/nextjs --filter admin
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
