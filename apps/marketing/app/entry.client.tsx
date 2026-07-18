import '@fontsource-variable/inter';
import '@fontsource-variable/inter-tight';
import '@fontsource-variable/jetbrains-mono';
import './index.css';

import { Router, RouterProvider } from '@revealui/router';
import { SpeedInsights } from '@vercel/speed-insights/react';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { initAnalytics } from './lib/analytics';
import { initEditMode } from './lib/edit-mode';
import { initSentry } from './lib/sentry';

// Initialise Sentry before mounting. No-op if VITE_SENTRY_DSN is absent.
initSentry();
// Initialise analytics sink. No-op if VITE_ANALYTICS_DOMAIN is absent or DNT is enabled.
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
      <App />
      <SpeedInsights />
    </RouterProvider>
  </StrictMode>,
);
