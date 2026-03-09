import { logger } from '@revealui/core/observability/logger'
import type { NavigateOptions, Route, RouteMatch, RouteParams, RouterOptions } from './types'

// ---------------------------------------------------------------------------
// Hand-rolled path matcher — replaces `path-to-regexp`.
// Supports: exact paths, named params (:id), wildcards (*path),
// and optional segments ({/...}).
// ---------------------------------------------------------------------------

interface PathKey {
  name: string
  wildcard: boolean
}

function compilePathPattern(pattern: string): { regex: RegExp; keys: PathKey[] } {
  const keys: PathKey[] = []
  let src = '^'
  let i = 0
  while (i < pattern.length) {
    // biome-ignore lint/style/noNonNullAssertion: index bounds-checked by loop condition
    const ch = pattern[i]!
    if (ch === '{') {
      src += '(?:'
      i++
    } else if (ch === '}') {
      src += ')?'
      i++
    } else if (ch === ':') {
      i++
      let name = ''
      // biome-ignore lint/style/noNonNullAssertion: index bounds-checked by loop condition
      while (i < pattern.length && /\w/.test(pattern[i]!)) name += pattern[i++]
      keys.push({ name, wildcard: false })
      src += '([^/]+)'
    } else if (ch === '*') {
      i++
      let name = ''
      // biome-ignore lint/style/noNonNullAssertion: index bounds-checked by loop condition
      while (i < pattern.length && /\w/.test(pattern[i]!)) name += pattern[i++]
      keys.push({ name: name || '0', wildcard: true })
      src += '(.+)'
    } else {
      src += ch.replace(/[.+?^$|()[\]\\]/g, '\\$&')
      i++
    }
  }
  src += '$'
  return { regex: new RegExp(src), keys }
}

function pathMatch(
  pattern: string,
  options: { decode?: (s: string) => string } = {},
): (path: string) => { params: Record<string, string | string[]> } | false {
  const { regex, keys } = compilePathPattern(pattern)
  const decode = options.decode ?? ((s) => s)
  return (path: string) => {
    const m = regex.exec(path)
    if (!m) return false
    const params: Record<string, string | string[]> = {}
    for (let j = 0; j < keys.length; j++) {
      // biome-ignore lint/style/noNonNullAssertion: index bounds-checked by loop condition
      const key = keys[j]!
      const val = m[j + 1]
      if (val === undefined) continue
      params[key.name] = key.wildcard ? val.split('/').map(decode) : decode(val)
    }
    return { params }
  }
}

/**
 * RevealUI Router - Lightweight file-based routing with SSR support
 */
export class Router {
  private routes: Route[] = []
  private options: RouterOptions
  private listeners: Set<() => void> = new Set()
  private currentMatch: RouteMatch | null = null
  private lastPathname: string | null = null

  constructor(options: RouterOptions = {}) {
    this.options = {
      basePath: '',
      ...options,
    }
  }

  /**
   * Get router options
   */
  getOptions(): RouterOptions {
    return this.options
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

    // Store resolved match for getCurrentMatch (SSR and resolve-based flows)
    this.currentMatch = matched

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

    // Update cached match so useSyncExternalStore gets a stable reference
    this.lastPathname = window.location.pathname
    this.currentMatch = this.match(window.location.pathname)

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
    if (typeof window === 'undefined') {
      return this.currentMatch
    }

    // Return cached match if pathname hasn't changed (stable reference for useSyncExternalStore)
    const pathname = window.location.pathname
    if (pathname !== this.lastPathname) {
      this.lastPathname = pathname
      this.currentMatch = this.match(pathname)
    }

    return this.currentMatch
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
   * Initialize client-side routing.
   * Uses a global flag to prevent duplicate event listeners on HMR re-invocation.
   */
  initClient(): void {
    if (typeof window === 'undefined') {
      return
    }

    // biome-ignore lint/suspicious/noExplicitAny: global HMR guard
    const g = globalThis as any
    if (g.__revealui_router_initialized) return
    g.__revealui_router_initialized = true

    // Handle browser back/forward buttons
    window.addEventListener('popstate', () => {
      this.lastPathname = window.location.pathname
      this.currentMatch = this.match(window.location.pathname)
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
