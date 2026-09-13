import '@fontsource-variable/inter';
import '@fontsource-variable/inter-tight';
import '@fontsource-variable/jetbrains-mono';
import './index.css';

import { Router, RouterProvider } from '@revealui/router';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { ConsentGatedTelemetry } from './components/ConsentGatedTelemetry';
import { initAnalytics } from './lib/analytics';
import { isHipaaComplianceProfile } from './lib/compliance';
import { initEditMode } from './lib/edit-mode';
import { initSentry } from './lib/sentry';

// Initialise Sentry before mounting. No-op if VITE_SENTRY_DSN is absent.
if (!isHipaaComplianceProfile()) {
  initSentry();
}
// Initialise analytics sinks. Umami pageviews stay dormant without
// VITE_UMAMI_URL + VITE_UMAMI_WEBSITE_ID. The Plausible-compatible path stays
// dormant without VITE_ANALYTICS_DOMAIN. Both skip DNT, HIPAA, and no-consent.
initAnalytics();
// Enter visual edit mode only when the URL carries an edit token. No-op otherwise.
initEditMode();

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error('Root element not found');
}

export const router = new Router();
router.initClient();

createRoot(rootElement).render(
  <StrictMode>
    <RouterProvider router={router}>
      <ConsentGatedTelemetry>
        <App />
      </ConsentGatedTelemetry>
    </RouterProvider>
  </StrictMode>,
);
