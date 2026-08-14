/**
 * Sentry Server Configuration
 *
 * This file is automatically loaded by Next.js for server-side error tracking.
 * It initializes Sentry for API route errors, server-side rendering errors,
 * and middleware errors.
 */

import * as Sentry from '@sentry/nextjs';
import { sentryConfig } from './src/lib/config/sentry';
import { shouldInitSentryFromEnv } from './src/lib/config/sentry-gate';

if (shouldInitSentryFromEnv(process.env)) {
  Sentry.init({
    ...sentryConfig,

    // Additional server-specific configuration
    integrations: [
      // HTTP integration for tracking API calls
      Sentry.httpIntegration(),
      // Node profiling moved out of @sentry/nextjs in v10. Re-enable by
      // installing @sentry/profiling-node and importing nodeProfilingIntegration
      // from there. Disabled for now — profiling is opt-in optimization, not a
      // baseline requirement.
    ],

    // profilesSampleRate stays defined for when nodeProfilingIntegration is
    // re-introduced; currently inert because no profiling integration is loaded.
    profilesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 0,

    // Additional server context
    initialScope: {
      tags: {
        runtime: 'node',
        server: 'nextjs',
      },
    },

    // Capture all unhandled rejections
    beforeSend(event, hint) {
      // Call the base beforeSend from sentryConfig. Sentry's BeforeSend type
      // widens to `Event | PromiseLike<Event | null> | null`; our shared
      // sentryConfig.beforeSend is synchronous (see src/lib/config/sentry.ts),
      // so narrow back to the sync ErrorEvent union.
      const filteredEvent = sentryConfig.beforeSend?.(event, hint) as
        | Sentry.ErrorEvent
        | null
        | undefined;
      if (!filteredEvent) return null;

      // Add server-specific context
      if (filteredEvent.contexts) {
        filteredEvent.contexts.runtime = {
          name: 'node',
          version: process.version,
        };
      }

      return filteredEvent;
    },
  });
}
