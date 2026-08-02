/**
 * Server-only router (2.3.1–2.3.4). Not imported from the browser entry.
 * Owns useAction session gate, real SessionPage, and error dogfood loaders.
 */

import type { Router } from '@revealui/router/core';
import { notFound } from '@revealui/router/server';
import { createAppRouter, type DemoPage } from './app-router.ts';
import { requireSessionForProtectedActions } from './auth/require-session.ts';
import { HomePage } from './pages/home.tsx';
import { AppLayout } from './pages/layout.tsx';
import { NotFoundPage } from './pages/not-found.tsx';
import { SessionPage } from './pages/session.tsx';

export function createServerAppRouter(): Router {
  const router = createAppRouter({
    sessionPage: SessionPage as unknown as DemoPage,
  });

  // Phase 2.3.1: protected JS actions fail closed without dogfood session.
  // useAction is Router API (D2.d), not a React hook — Biome rules-of-hooks false positive.
  // biome-ignore lint/correctness/useHookAtTopLevel: Router.useAction mutation middleware
  router.useAction(requireSessionForProtectedActions);

  registerServerErrorRoutes(router);
  return router;
}

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
