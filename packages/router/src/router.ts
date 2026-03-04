import { logger } from '@revealui/core/observability/logger'
import { match as pathMatch } from 'path-to-regexp'
import type { NavigateOptions, Route, RouteMatch, RouteParams, RouterOptions } from './types'

/**
 * RevealUI Router - Lightweight file-based routing with SSR support
 */
export class Router {
  private routes: Route[] = []
  private options: RouterOptions
  private listeners: Set<() => void> = new Set()
  private currentMatch: RouteMatch | null = null

  constructor(options: RouterOptions = {}) {
    this.options = {
      basePath: '',
      ...options,
    }
  }

  /**
   * Register a route
   */
  register(route: Route): void {
    this.routes.push(route)
  }

  /**
   * Register multiple routes
   */
  registerRoutes(routes: Route[]): void {
    routes.forEach((route) => {
      this.register(route)
    })
  }

  /**
   * Match a URL to a route
   */
  match(url: string): RouteMatch | null {
    // Remove base path if present
    const path = this.normalizePath(url)

    // Try to match each route
    for (const route of this.routes) {
      const matcher = pathMatch(route.path, { decode: decodeURIComponent })
      const result = matcher(path)

      if (result) {
        return {
          route,
          params: (result.params as RouteParams) || {},
        }
      }
    }

    return null
  }

  /**
   * Resolve a route with data loading
   */
  async resolve(url: string): Promise<RouteMatch | null> {
    const matched = this.match(url)

    if (!matched) {
      return null
    }

    // Load data if loader exists
    if (matched.route.loader) {
      try {
        matched.data = await matched.route.loader(matched.params)
      } catch (error) {
        logger.error(
          'Route loader error',
          error instanceof Error ? error : new Error(String(error)),
        )
        throw error
      }
    }

    // Store match for SSR (if on server)
    if (typeof window === 'undefined') {
      this.currentMatch = matched
    }

    return matched
  }

  /**
   * Navigate to a URL (client-side only)
   */
  navigate(url: string, options: NavigateOptions = {}): void {
    if (typeof window === 'undefined') {
      return
    }

    const fullUrl = this.options.basePath + url

    if (options.replace) {
      window.history.replaceState(options.state || null, '', fullUrl)
    } else {
      window.history.pushState(options.state || null, '', fullUrl)
    }

    this.notifyListeners()
  }

  /**
   * Go back in history
   */
  back(): void {
    if (typeof window !== 'undefined') {
      window.history.back()
    }
  }

  /**
   * Go forward in history
   */
  forward(): void {
    if (typeof window !== 'undefined') {
      window.history.forward()
    }
  }

  /**
   * Subscribe to route changes
   */
  subscribe(listener: () => void): () => void {
    this.listeners.add(listener)

    // Return unsubscribe function
    return () => {
      this.listeners.delete(listener)
    }
  }

  /**
   * Get current route match
   */
  getCurrentMatch(): RouteMatch | null {
    // On server, return stored match (set by resolve during SSR)
    if (typeof window === 'undefined') {
      return this.currentMatch
    }

    // On client, match against current URL
    return this.match(window.location.pathname)
  }

  /**
   * Get all registered routes
   */
  getRoutes(): Route[] {
    return [...this.routes]
  }

  /**
   * Clear all routes
   */
  clear(): void {
    this.routes = []
  }

  private normalizePath(url: string): string {
    // Remove base path
    let path = url
    if (this.options.basePath && path.startsWith(this.options.basePath)) {
      path = path.slice(this.options.basePath.length)
    }

    // Remove query string and hash
    path = path.split('?')[0].split('#')[0]

    // Ensure leading slash
    if (!path.startsWith('/')) {
      path = `/${path}`
    }

    return path
  }

  private notifyListeners(): void {
    this.listeners.forEach((listener) => {
      listener()
    })
  }

  /**
   * Initialize client-side routing
   */
  initClient(): void {
    if (typeof window === 'undefined') {
      return
    }

    // Handle browser back/forward buttons
    window.addEventListener('popstate', () => {
      this.notifyListeners()
    })

    // Intercept link clicks
    document.addEventListener('click', (e) => {
      const target = (e.target as HTMLElement).closest('a')

      if (!target) return

      const href = target.getAttribute('href')

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
        e.preventDefault()
        this.navigate(href)
      }
    })
  }
}
