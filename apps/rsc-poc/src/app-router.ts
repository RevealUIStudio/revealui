/**
 * Client-safe route table for the RSC POC.
 *
 * Browser entry imports this module — it must NOT pull
 * `@revealui/router/server`, session ALS, or async server pages.
 * Server-only wiring (useAction, real SessionPage, error loaders) lives in
 * `app-router.server.ts`.
 */
import { Router } from '@revealui/router/core';
import type { ComponentType } from 'react';
import { ActionsPage } from './pages/actions.tsx';
import { CounterPage } from './pages/counter.tsx';
import { ErrorsPage } from './pages/errors.tsx';
import { HomePage } from './pages/home.tsx';
import { AppLayout } from './pages/layout.tsx';
import { NotFoundPage } from './pages/not-found.tsx';

/** Demo pages take no props; router still passes params/data (ignored). */
export type DemoPage = ComponentType<{ params?: Record<string, string>; data?: unknown }>;

/**
 * Placeholder for server-only SessionPage on the client. Soft-nav uses RSC
 * payload for the real tree; match only needs a stable path entry.
 */
function SessionRouteStub(): React.ReactNode {
  return null;
}

export interface CreateAppRouterOptions {
  /** Override /session page (server passes real SessionPage). */
  sessionPage?: DemoPage;
}

/**
 * Shared path registration. Browser uses SessionRouteStub; server injects
 * the real async SessionPage so match is not double-registered.
 */
export function createAppRouter(options: CreateAppRouterOptions = {}): Router {
  const router = new Router({
    rsc: {},
    notFound: NotFoundPage,
  });

  const sessionPage = options.sessionPage ?? (SessionRouteStub as DemoPage);

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
    component: sessionPage,
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
