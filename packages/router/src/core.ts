/**
 * RSC-safe + client-safe core: Router class + types only.
 * Does not import React context/hooks (those live in `./components`).
 * Use this from dual-mode route tables shared by server and browser entries.
 */

export { RSC_ACCEPT, resolveRscClientUrl } from './negotiate';
export { Router } from './router';
export type {
  ActionMiddleware,
  ActionMiddlewareContext,
  Location,
  MiddlewareContext,
  NavigateOptions,
  NavigationStatus,
  Route,
  RouteMatch,
  RouteMeta,
  RouteMiddleware,
  RouteParams,
  RouterMode,
  RouterOptions,
  RouterRscOptions,
  RscPayloadLoader,
} from './types';
