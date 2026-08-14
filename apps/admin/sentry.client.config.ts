/**
 * Sentry Client Configuration
 *
 * This file is automatically loaded by Next.js for client-side error tracking.
 * It initializes Sentry for browser errors, unhandled promise rejections,
 * and user interactions.
 */

import * as Sentry from '@sentry/nextjs';
import { sentryConfig } from './src/lib/config/sentry';
import { shouldInitClientSentry } from './src/lib/config/sentry-gate';

// Static member access so Next inlines the value. Do not use process.env[key]
// or resolveComplianceProfile(process.env) in this client file.
if (shouldInitClientSentry(process.env.NEXT_PUBLIC_COMPLIANCE_PROFILE)) {
  Sentry.init({
    ...sentryConfig,

    // Additional client-specific configuration
    integrations: [],

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
}
