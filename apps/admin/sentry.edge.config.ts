import * as Sentry from '@sentry/nextjs';
import { sentryConfig } from './src/lib/config/sentry';
import { shouldInitSentryFromEnv } from './src/lib/config/sentry-gate';

if (shouldInitSentryFromEnv(process.env)) {
  Sentry.init({
    ...sentryConfig,
    // Disable replay on edge (client-only feature)
    replaysSessionSampleRate: 0,
    replaysOnErrorSampleRate: 0,
  });
}
