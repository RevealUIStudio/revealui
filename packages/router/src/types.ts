import type { ComponentType, ReactNode } from 'react';

/**
 * Middleware function  -  runs before route resolution.
 * Return `true` to continue, `false` to abort, or a redirect path string.
 */
export type RouteMiddleware = (
  context: MiddlewareContext,
) => boolean | string | Promise<boolean | string>;

/**
 * Context passed to middleware functions
 */
export interface MiddlewareContext {
  /** Current URL pathname */
  pathname: string;
  /** Matched route params (if available at this stage) */
  params: RouteParams;
  /** Route metadata */
  meta?: RouteMeta;
}

/**
 * Context for server-action middleware (ADR D2.d / Phase 2.3.1).
 * Extends navigation middleware context with mutation identity.
 */
export interface ActionMiddlewareContext extends MiddlewareContext {
  /** Opaque RSDW action id when POST carries `x-rsc-action`. */
  actionId?: string | null;
  /** True for progressive form POST (no x-rsc-action). */
  formAction?: boolean;
}

/**
 * Middleware for mutations (`useAction`). Same control flow as route middleware.
 */
export type ActionMiddleware = (
  context: ActionMiddlewareContext,
) => boolean | string | Promise<boolean | string>;

/**
 * Route configuration
 */
export interface Route<TData = unknown, TProps = Record<string, unknown>> {
  /** Route path pattern (e.g., '/', '/about', '/posts/:id') */
  path: string;
  /** Component to render for this route */
  component: ComponentType<TProps>;
  /** Optional layout component */
  layout?: ComponentType<{ children: ReactNode }>;
  /** Optional data loader function */
  loader?: (params: RouteParams) => Promise<TData> | TData;
  /** Optional metadata */
  meta?: RouteMeta;
  /** Optional middleware that runs before this route's loader */
  middleware?: RouteMiddleware[];
  /** Nested child routes  -  children inherit parent's layout and middleware */
  children?: Route[];
}

/**
 * Route parameters extracted from URL
 */
export interface RouteParams {
  [key: string]: string;
}

/**
 * Route metadata (for SEO, etc.)
 */
export interface RouteMeta {
  title?: string;
  description?: string;
  [key: string]: unknown;
}

/**
 * Matched route result
 */
export interface RouteMatch<TData = unknown> {
  route: Route<TData>;
  params: RouteParams;
  data?: TData;
}

/**
 * Dual-mode selector for GAP-194 Phase 2.2 (`@revealui/router` 0.4).
 * - `undefined` / omit → `'client'` (0.3.x behavior, default)
 * - `{ endpoint?: string }` → `'rsc'` (server-driven; endpoint is CDN-Vary escape hatch)
 */
export interface RouterRscOptions {
  /**
   * Optional URL prefix for RSC payloads when content negotiation via
   * `Accept: text/x-component` is unsafe (CDN ignores `Vary: accept`).
   * Default path is same-URL negotiation per ADR D1.
   */
  endpoint?: string;
}

/**
 * Router configuration options
 */
export interface RouterOptions {
  /** Base URL path */
  basePath?: string;
  /** 404 component */
  notFound?: ComponentType;
  /** Error boundary component */
  errorBoundary?: ComponentType<{ error: Error }>;
  /**
   * Opt into RSC mode (ADR D1 / L3). Omitted or `undefined` keeps client mode
   * byte-compatible with 0.3.x SPA consumers (marketing, docs, agency).
   */
  rsc?: RouterRscOptions;
  /**
   * Pluggable fetch for server-action transport (ADR D9). Defaults to
   * `globalThis.fetch` when RSC mode is active.
   */
  serverActionTransport?: typeof fetch;
}

/** Runtime mode derived from `RouterOptions.rsc`. */
export type RouterMode = 'client' | 'rsc';

/**
 * Client RSC navigation status (Phase 2.2.3 / ADR D3).
 * `'idle'` when no in-flight payload fetch; `'loading'` while fetching;
 * `'error'` after a failed fetch (see `Router.getNavigationError()`).
 */
export type NavigationStatus = 'idle' | 'loading' | 'error';

/**
 * Pluggable RSC payload loader (ADR D11 — router stays free of RSDW/plugin-rsc).
 * Called on soft navigation in `'rsc'` mode with an absolute URL and abort signal.
 * New navigations abort the previous signal (D3 `currentNavigationToken`).
 */
export type RscPayloadLoader<T = unknown> = (url: string, signal: AbortSignal) => Promise<T>;

/**
 * Navigation options
 */
export interface NavigateOptions<TState = unknown> {
  /** Replace current history entry instead of pushing */
  replace?: boolean;
  /** State to pass with navigation */
  state?: TState;
  /**
   * Skip RSC payload fetch after history update (RSC mode only).
   * Used when a server action already returned a fresh payload via `applyRscPayload`.
   */
  skipRscFetch?: boolean;
}

/**
 * Current location state
 */
export interface Location {
  /** URL pathname (e.g., '/about') */
  pathname: string;
  /** Query string including leading '?' (e.g., '?q=test') or empty string */
  search: string;
  /** Hash fragment including leading '#' (e.g., '#section') or empty string */
  hash: string;
}
