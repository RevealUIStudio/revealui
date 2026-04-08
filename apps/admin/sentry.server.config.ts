/**
 * Sentry Server Configuration
 *
 * This file is automatically loaded by Next.js for server-side error tracking.
 * It initializes Sentry for API route errors, server-side rendering errors,
 * and middleware errors.
 */

import * as Sentry from '@sentry/nextjs';
import { sentryConfig } from './src/lib/config/sentry';

Sentry.init({
  ...sentryConfig,

  // Additional server-specific configuration
  integrations: [
    // HTTP integration for tracking API calls
    Sentry.httpIntegration(),
    // Node profiling for performance insights
    Sentry.nodeProfilingIntegration(),
  ],

  // Profile sample rate (only in production)
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
    // Call the base beforeSend from sentryConfig
    const filteredEvent = sentryConfig.beforeSend?.(event, hint);
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
