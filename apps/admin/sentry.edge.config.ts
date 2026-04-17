import * as Sentry from '@sentry/nextjs';

import { sentryConfig } from './src/lib/config/sentry';

Sentry.init({
  ...sentryConfig,
  // Disable replay on edge (client-only feature)
  replaysSessionSampleRate: 0,
  replaysOnErrorSampleRate: 0,
});
