/**
 * Server-only route extensions (2.3.2). Not imported from the browser entry.
 */

import type { Router } from '@revealui/router/core';
import { notFound } from '@revealui/router/server';
import { HomePage } from './pages/home.tsx';
import { AppLayout } from './pages/layout.tsx';
import { NotFoundPage } from './pages/not-found.tsx';

export function registerServerErrorRoutes(router: Router): void {
  router.register({
    path: '/errors/not-found',
    component: NotFoundPage,
    layout: AppLayout,
    meta: { title: 'Forced notFound' },
    loader: () => {
      notFound();
    },
  });
  router.register({
    path: '/errors/boom',
    component: HomePage,
    layout: AppLayout,
    meta: { title: 'Forced loader boom' },
    loader: () => {
      // Intentional throw for 2.3.2 shell + 2.3.3 onError capture (console sink).
      throw new Error('dogfood loader explosion');
    },
  });
}
