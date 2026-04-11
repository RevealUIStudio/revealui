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
 * Router configuration options
 */
export interface RouterOptions {
  /** Base URL path */
  basePath?: string;
  /** 404 component */
  notFound?: ComponentType;
  /** Error boundary component */
  errorBoundary?: ComponentType<{ error: Error }>;
}

/**
 * Navigation options
 */
export interface NavigateOptions<TState = unknown> {
  /** Replace current history entry instead of pushing */
  replace?: boolean;
  /** State to pass with navigation */
  state?: TState;
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
