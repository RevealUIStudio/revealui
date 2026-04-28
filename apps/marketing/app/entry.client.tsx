import '@fontsource-variable/geist';
import '@fontsource-variable/geist-mono';
import './index.css';

import { Router, RouterProvider } from '@revealui/router';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { SpeedInsights } from '@vercel/speed-insights/react';
import { App } from './App';

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
