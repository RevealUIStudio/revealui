import type { ComponentType, ReactNode } from 'react'

/**
 * Route configuration
 */
export interface Route {
  /** Route path pattern (e.g., '/', '/about', '/posts/:id') */
  path: string
  /** Component to render for this route */
  component: ComponentType<any>
  /** Optional layout component */
  layout?: ComponentType<{ children: ReactNode }>
  /** Optional data loader function */
  loader?: (params: RouteParams) => Promise<any> | any
  /** Optional metadata */
  meta?: RouteMeta
}

/**
 * Route parameters extracted from URL
 */
export interface RouteParams {
  [key: string]: string
}

/**
 * Route metadata (for SEO, etc.)
 */
export interface RouteMeta {
  title?: string
  description?: string
  [key: string]: any
}

/**
 * Matched route result
 */
export interface RouteMatch {
  route: Route
  params: RouteParams
  data?: any
}

/**
 * Router configuration options
 */
export interface RouterOptions {
  /** Base URL path */
  basePath?: string
  /** 404 component */
  notFound?: ComponentType
  /** Error boundary component */
  errorBoundary?: ComponentType<{ error: Error }>
}

/**
 * Navigation options
 */
export interface NavigateOptions {
  /** Replace current history entry instead of pushing */
  replace?: boolean
  /** State to pass with navigation */
  state?: any
}
