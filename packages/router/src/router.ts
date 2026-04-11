import { logger } from '@revealui/utils/logger';
import type React from 'react';
import { createElement } from 'react';
import type {
  MiddlewareContext,
  NavigateOptions,
  Route,
  RouteMatch,
  RouteMiddleware,
  RouteParams,
  RouterOptions,
} from './types';

declare global {
  var __revealui_router_initialized: boolean | undefined;
}

// ---------------------------------------------------------------------------
// Hand-rolled path matcher  -  replaces `path-to-regexp`.
// Supports: exact paths, named params (:id), wildcards (*path),
// and optional segments ({/...}).
// ---------------------------------------------------------------------------

interface PathKey {
  name: string;
  wildcard: boolean;
}

/** Maximum pattern length to prevent ReDoS from malicious/misconfigured routes */
const MAX_PATTERN_LENGTH = 2048;

function compilePathPattern(pattern: string): { regex: RegExp; keys: PathKey[] } {
  if (pattern.length > MAX_PATTERN_LENGTH) {
    throw new Error(`Route pattern exceeds ${MAX_PATTERN_LENGTH} characters`);
  }
  const keys: PathKey[] = [];
  let src = '^';
  let i = 0;
  while (i < pattern.length) {
    // biome-ignore lint/style/noNonNullAssertion: index bounds-checked by loop condition
    const ch = pattern[i]!;
    if (ch === '{') {
      src += '(?:';
      i++;
    } else if (ch === '}') {
      src += ')?';
      i++;
    } else if (ch === ':') {
      i++;
      let name = '';
      // biome-ignore lint/style/noNonNullAssertion: index bounds-checked by loop condition
      while (i < pattern.length && /\w/.test(pattern[i]!)) name += pattern[i++];
      keys.push({ name, wildcard: false });
      src += '([^/]+)';
    } else if (ch === '*') {
      i++;
      let name = '';
      // biome-ignore lint/style/noNonNullAssertion: index bounds-checked by loop condition
      while (i < pattern.length && /\w/.test(pattern[i]!)) name += pattern[i++];
      keys.push({ name: name || '0', wildcard: true });
      src += '(.+)';
    } else {
      src += ch.replace(/[.+?^$|()[\]\\]/g, '\\$&');
      i++;
    }
  }
  src += '$';
  return { regex: new RegExp(src), keys };
}

/** Cache compiled patterns to avoid recompilation on every match() call */
const patternCache = new Map<string, { regex: RegExp; keys: PathKey[] }>();

function getCompiledPattern(pattern: string): { regex: RegExp; keys: PathKey[] } {
  let compiled = patternCache.get(pattern);
  if (!compiled) {
    compiled = compilePathPattern(pattern);
    patternCache.set(pattern, compiled);
  }
  return compiled;
}

function pathMatch(
  pattern: string,
  options: { decode?: (s: string) => string } = {},
): (path: string) => { params: Record<string, string | string[]> } | false {
  const { regex, keys } = getCompiledPattern(pattern);
  const decode = options.decode ?? ((s) => s);
  return (path: string) => {
    const m = regex.exec(path);
    if (!m) return false;
    const params: Record<string, string | string[]> = {};
    for (let j = 0; j < keys.length; j++) {
      // biome-ignore lint/style/noNonNullAssertion: index bounds-checked by loop condition
      const key = keys[j]!;
      const val = m[j + 1];
      if (val === undefined) continue;
      params[key.name] = key.wildcard ? val.split('/').map(decode) : decode(val);
    }
    return { params };
  };
}

/**
 * File-based router for React apps with SSR, data loaders, and middleware.
 *
 * Works with Vite, Hono, or any React setup. Supports named params (:id),
 * wildcards (*path), optional segments ({/...}), nested routes with composable
 * layouts, and a middleware chain (global + per-route).
 */
export class Router {
  private routes: Route[] = [];
  private flatRoutes: Route[] = [];
  private globalMiddleware: RouteMiddleware[] = [];
  private options: RouterOptions;
  private listeners: Set<() => void> = new Set();
  private currentMatch: RouteMatch | null = null;
  private lastPathname: string | null = null;
  private popstateHandler: (() => void) | null = null;
  private clickHandler: ((e: MouseEvent) => void) | null = null;

  constructor(options: RouterOptions = {}) {
    this.options = {
      basePath: '',
      ...options,
    };
  }

  /**
   * Add global middleware that runs before all routes.
   */
  use(...middleware: RouteMiddleware[]): void {
    this.globalMiddleware.push(...middleware);
  }

  /**
   * Get router options
   */
  getOptions(): RouterOptions {
    return this.options;
  }

  /**
   * Register a route. Nested children are flattened with combined paths,
   * middleware, and layout chains.
   */
  register(route: Route): void {
    this.routes.push(route);
    this.flattenRoute(route, '', [], undefined);
  }

  /**
   * Register multiple routes
   */
  registerRoutes(routes: Route[]): void {
    routes.forEach((route) => {
      this.register(route);
    });
  }

  /**
   * Flatten nested routes into the flat lookup table.
   * Children inherit parent path prefix, middleware, and layout.
   */
  private flattenRoute(
    route: Route,
    parentPath: string,
    parentMiddleware: RouteMiddleware[],
    parentLayout: Route['layout'],
  ): void {
    const fullPath = joinPaths(parentPath, route.path);
    const combinedMiddleware = [...parentMiddleware, ...(route.middleware ?? [])];
    // Child layout wraps inside parent layout
    const effectiveLayout =
      parentLayout && route.layout
        ? wrapLayouts(parentLayout, route.layout)
        : (route.layout ?? parentLayout);

    // Register this route if it has a component (layout-only routes may not)
    if (route.component) {
      this.flatRoutes.push({
        ...route,
        path: fullPath,
        middleware: combinedMiddleware.length > 0 ? combinedMiddleware : undefined,
        layout: effectiveLayout,
        children: undefined, // Already flattened
      });
    }

    // Recursively flatten children
    if (route.children) {
      for (const child of route.children) {
        this.flattenRoute(child, fullPath, combinedMiddleware, effectiveLayout);
      }
    }
  }

  /**
   * Match a URL to a route.
   * Checks flattened routes first (includes nested), then falls back to top-level.
   */
  match(url: string): RouteMatch | null {
    // Remove base path if present
    const path = this.normalizePath(url);

    // Check flattened routes (includes nested children)
    const allRoutes = this.flatRoutes.length > 0 ? this.flatRoutes : this.routes;

    // Try to match each route
    for (const route of allRoutes) {
      const matcher = pathMatch(route.path, { decode: decodeURIComponent });
      const result = matcher(path);

      if (result) {
        return {
          route,
          params: (result.params as RouteParams) || {},
        };
      }
    }

    return null;
  }

  /**
   * Resolve a route with middleware execution and data loading.
   *
   * Middleware chain: global middleware → route middleware → loader.
   * If any middleware returns `false`, resolution is aborted (returns null).
   * If any middleware returns a string, navigation is redirected to that path.
   */
  async resolve(url: string): Promise<RouteMatch | null> {
    const matched = this.match(url);

    if (!matched) {
      return null;
    }

    // Run middleware chain (global + route-specific)
    const allMiddleware = [...this.globalMiddleware, ...(matched.route.middleware ?? [])];

    if (allMiddleware.length > 0) {
      const context: MiddlewareContext = {
        pathname: this.normalizePath(url),
        params: matched.params,
        meta: matched.route.meta,
      };

      for (const mw of allMiddleware) {
        const result = await mw(context);
        if (result === false) {
          return null; // Middleware blocked
        }
        if (typeof result === 'string') {
          // Middleware requested redirect
          this.navigate(result);
          return null;
        }
      }
    }

    // Load data if loader exists
    if (matched.route.loader) {
      try {
        matched.data = await matched.route.loader(matched.params);
      } catch (error) {
        logger.error(
          'Route loader error',
          error instanceof Error ? error : new Error(String(error)),
        );
        throw error;
      }
    }

    // Store resolved match for getCurrentMatch (SSR and resolve-based flows)
    this.currentMatch = matched;

    return matched;
  }

  /**
   * Navigate to a URL (client-side only)
   */
  navigate(url: string, options: NavigateOptions = {}): void {
    if (typeof window === 'undefined') {
      return;
    }

    const fullUrl = this.options.basePath + url;

    if (options.replace) {
      window.history.replaceState(options.state || null, '', fullUrl);
    } else {
      window.history.pushState(options.state || null, '', fullUrl);
    }

    // Update cached match so useSyncExternalStore gets a stable reference
    this.lastPathname = window.location.pathname;
    this.currentMatch = this.match(window.location.pathname);

    this.notifyListeners();
  }

  /**
   * Go back in history
   */
  back(): void {
    if (typeof window !== 'undefined') {
      window.history.back();
    }
  }

  /**
   * Go forward in history
   */
  forward(): void {
    if (typeof window !== 'undefined') {
      window.history.forward();
    }
  }

  /**
   * Subscribe to route changes
   */
  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);

    // Return unsubscribe function
    return () => {
      this.listeners.delete(listener);
    };
  }

  /**
   * Get current route match
   */
  getCurrentMatch(): RouteMatch | null {
    if (typeof window === 'undefined') {
      return this.currentMatch;
    }

    // Return cached match if pathname hasn't changed (stable reference for useSyncExternalStore)
    const pathname = window.location.pathname;
    if (pathname !== this.lastPathname) {
      this.lastPathname = pathname;
      this.currentMatch = this.match(pathname);
    }

    return this.currentMatch;
  }

  /**
   * Get all registered routes
   */
  getRoutes(): Route[] {
    return [...this.routes];
  }

  /**
   * Clear all routes and middleware
   */
  clear(): void {
    this.routes = [];
    this.flatRoutes = [];
    this.globalMiddleware = [];
  }

  private normalizePath(url: string): string {
    // Remove base path
    let path = url;
    if (this.options.basePath && path.startsWith(this.options.basePath)) {
      path = path.slice(this.options.basePath.length);
    }

    // Remove query string and hash
    path = path.split('?')[0].split('#')[0];

    // Ensure leading slash
    if (!path.startsWith('/')) {
      path = `/${path}`;
    }

    return path;
  }

  private notifyListeners(): void {
    this.listeners.forEach((listener) => {
      listener();
    });
  }

  /**
   * Initialize client-side routing.
   * Uses a global flag to prevent duplicate event listeners on HMR re-invocation.
   */
  initClient(): void {
    if (typeof window === 'undefined') {
      return;
    }

    if (globalThis.__revealui_router_initialized) return;
    globalThis.__revealui_router_initialized = true;

    // Handle browser back/forward buttons
    this.popstateHandler = () => {
      this.lastPathname = window.location.pathname;
      this.currentMatch = this.match(window.location.pathname);
      this.notifyListeners();
    };
    window.addEventListener('popstate', this.popstateHandler);

    // Intercept link clicks
    this.clickHandler = (e: MouseEvent) => {
      const target = (e.target as HTMLElement).closest('a');

      if (!target) return;

      const href = target.getAttribute('href');

      // Only handle internal links
      if (
        href?.startsWith('/') &&
        !target.hasAttribute('target') &&
        !target.hasAttribute('download') &&
        !e.metaKey &&
        !e.ctrlKey &&
        !e.shiftKey &&
        !e.altKey
      ) {
        e.preventDefault();
        this.navigate(href);
      }
    };
    document.addEventListener('click', this.clickHandler);
  }

  /**
   * Clean up client-side event listeners.
   * Call this before unmounting or during HMR teardown.
   */
  dispose(): void {
    if (typeof window === 'undefined') return;

    if (this.popstateHandler) {
      window.removeEventListener('popstate', this.popstateHandler);
      this.popstateHandler = null;
    }
    if (this.clickHandler) {
      document.removeEventListener('click', this.clickHandler);
      this.clickHandler = null;
    }

    this.listeners.clear();

    globalThis.__revealui_router_initialized = false;
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Join parent and child path segments, avoiding double slashes */
function joinPaths(parent: string, child: string): string {
  if (!parent || parent === '/') return child;
  if (!child || child === '/') return parent;
  return `${parent.replace(/\/$/, '')}/${child.replace(/^\//, '')}`;
}

/** Compose two layout components so the child renders inside the parent */
function wrapLayouts(
  Parent: React.ComponentType<{ children: React.ReactNode }>,
  Child: React.ComponentType<{ children: React.ReactNode }>,
): React.ComponentType<{ children: React.ReactNode }> {
  const WrappedLayout = ({ children }: { children: React.ReactNode }) =>
    createElement(Parent, null, createElement(Child, null, children));
  return WrappedLayout;
}
