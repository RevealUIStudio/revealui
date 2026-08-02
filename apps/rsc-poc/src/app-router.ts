/**
 * Shared route table for the RSC POC (GAP-194 T8 + 2.3.1 auth dogfood).
 * Server and browser each call `createAppRouter()` — class instances are not
 * serialized across the RSC boundary; both sides register the same paths.
 */
import { Router } from '@revealui/router/core';
import type { ComponentType } from 'react';
import { requireSessionForProtectedActions } from './auth/require-session.ts';
import { ActionsPage } from './pages/actions.tsx';
import { CounterPage } from './pages/counter.tsx';
import { ErrorsPage } from './pages/errors.tsx';
import { HomePage } from './pages/home.tsx';
import { AppLayout } from './pages/layout.tsx';
import { NotFoundPage } from './pages/not-found.tsx';
import { SessionPage } from './pages/session.tsx';

/** Demo pages take no props; router still passes params/data (ignored). */
type DemoPage = ComponentType<{ params?: Record<string, string>; data?: unknown }>;

export function createAppRouter(): Router {
  const router = new Router({
    rsc: {},
    notFound: NotFoundPage,
  });

  // Phase 2.3.1: protected JS actions fail closed without dogfood session.
  // useAction is Router API (D2.d), not a React hook — Biome rules-of-hooks false positive.
  // biome-ignore lint/correctness/useHookAtTopLevel: Router.useAction mutation middleware
  router.useAction(requireSessionForProtectedActions);

  router.register({
    path: '/',
    component: HomePage as DemoPage,
    layout: AppLayout,
    meta: { title: 'Home — RSC POC' },
  });
  router.register({
    path: '/counter',
    component: CounterPage as DemoPage,
    layout: AppLayout,
    meta: { title: 'Counter — RSC POC' },
  });
  router.register({
    path: '/actions',
    component: ActionsPage as DemoPage,
    layout: AppLayout,
    meta: { title: 'Actions — RSC POC' },
  });
  router.register({
    path: '/session',
    component: SessionPage as DemoPage,
    layout: AppLayout,
    meta: { title: 'Session — RSC POC' },
  });
  router.register({
    path: '/errors',
    component: ErrorsPage as DemoPage,
    layout: AppLayout,
    meta: { title: 'Errors — RSC POC' },
  });

  return router;
}
