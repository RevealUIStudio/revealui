/**
 * Sentry Client Configuration
 *
 * This file is automatically loaded by Next.js for client-side error tracking.
 * It initializes Sentry for browser errors, unhandled promise rejections,
 * and user interactions.
 */

import * as Sentry from '@sentry/nextjs';
import { sentryConfig } from './src/lib/config/sentry';

Sentry.init({
  ...sentryConfig,

  // Additional client-specific configuration
  integrations: [
    // Sentry.replayIntegration() is automatically added by Next.js if replaysSessionSampleRate is set
    Sentry.browserTracingIntegration(),
    Sentry.replayIntegration({
      maskAllText: true,
      blockAllMedia: true,
    }),
  ],

  // Capture breadcrumbs for better debugging context
  beforeBreadcrumb(breadcrumb) {
    // Filter out sensitive breadcrumbs
    if (breadcrumb.category === 'console' && breadcrumb.level === 'log') {
      // Don't send console-log breadcrumbs to reduce noise
      return null;
    }

    return breadcrumb;
  },
});
