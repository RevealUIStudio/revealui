/**
 * Shared route table for the RSC POC (GAP-194 T8).
 * Server and browser each call `createAppRouter()` — class instances are not
 * serialized across the RSC boundary; both sides register the same paths.
 */
import { Router } from '@revealui/router/core';
import type { ComponentType } from 'react';
import { ActionsPage } from './pages/actions.tsx';
import { CounterPage } from './pages/counter.tsx';
import { HomePage } from './pages/home.tsx';
import { AppLayout } from './pages/layout.tsx';
import { NotFoundPage } from './pages/not-found.tsx';

/** Demo pages take no props; router still passes params/data (ignored). */
type DemoPage = ComponentType<{ params?: Record<string, string>; data?: unknown }>;

export function createAppRouter(): Router {
  const router = new Router({
    rsc: {},
    notFound: NotFoundPage,
  });

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

  return router;
}
