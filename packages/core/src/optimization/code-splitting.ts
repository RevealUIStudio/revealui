/**
 * Code Splitting Utilities
 *
 * Helpers for dynamic imports, lazy loading, and code splitting
 */

import { type ComponentType, type LazyExoticComponent, lazy } from 'react'

/**
 * Lazy load component with retry logic
 */
export interface LazyLoadOptions {
  maxRetries?: number
  retryDelay?: number
  fallback?: ComponentType
}

export function lazyWithRetry<TProps = Record<string, unknown>>(
  importFn: () => Promise<{ default: ComponentType<TProps> }>,
  options: LazyLoadOptions = {},
): LazyExoticComponent<ComponentType<TProps>> {
  const { maxRetries = 3, retryDelay = 1000 } = options

  return lazy(() => {
    return new Promise<{ default: ComponentType<TProps> }>((resolve, reject) => {
      let retries = 0

      const attemptImport = () => {
        importFn()
          .then(resolve)
          .catch((error) => {
            if (retries < maxRetries) {
              retries++
              console.warn(`Import failed, retrying (${retries}/${maxRetries})...`)
              setTimeout(attemptImport, retryDelay)
            } else {
              console.error('Import failed after max retries:', error)
              reject(error)
            }
          })
      }

      attemptImport()
    })
  })
}

/**
 * Preload component
 */
export function preloadComponent<T = unknown>(importFn: () => Promise<T>): Promise<T> {
  return importFn()
}

/**
 * Lazy load with prefetch on hover
 */
export function lazyWithPrefetch<TProps = Record<string, unknown>>(
  importFn: () => Promise<{ default: ComponentType<TProps> }>,
): {
  Component: LazyExoticComponent<ComponentType<TProps>>
  prefetch: () => void
} {
  let importPromise: Promise<{ default: ComponentType<TProps> }> | null = null

  const prefetch = () => {
    if (!importPromise) {
      importPromise = importFn()
    }
    return importPromise
  }

  const Component = lazy(() => {
    if (!importPromise) {
      importPromise = importFn()
    }
    return importPromise
  })

  return { Component, prefetch }
}

/**
 * Route-based code splitting helper
 */
export interface RouteConfig<TProps = Record<string, unknown>> {
  path: string
  component: () => Promise<{ default: ComponentType<TProps> }>
  preload?: boolean
}

export function createRoutes(configs: RouteConfig[]) {
  return configs.map((config) => ({
    path: config.path,
    Component: lazy(config.component),
    preload: config.preload ? () => config.component() : undefined,
  }))
}

/**
 * Chunk naming helper
 */
export function createChunkName(name: string): string {
  return name.replace(/[^a-zA-Z0-9]/g, '-').toLowerCase()
}

/**
 * Dynamic import with webpack magic comments
 */
export function lazyWithChunkName<TProps = Record<string, unknown>>(
  chunkName: string,
  importFn: () => Promise<{ default: ComponentType<TProps> }>,
): LazyExoticComponent<ComponentType<TProps>> {
  // In production, webpack will use the magic comment in the actual import
  // This is a runtime helper for consistency
  return lazy(importFn)
}

/**
 * Prefetch multiple components
 */
export function prefetchComponents<T = unknown>(importFns: Array<() => Promise<T>>): Promise<T[]> {
  return Promise.all(importFns.map((fn) => fn()))
}

/**
 * Idle callback prefetch
 */
export function prefetchOnIdle(importFn: () => Promise<unknown>): void {
  if ('requestIdleCallback' in window) {
    window.requestIdleCallback(() => importFn())
  } else {
    // Fallback for browsers without requestIdleCallback
    setTimeout(() => importFn(), 1)
  }
}

/**
 * Intersection observer prefetch
 */
export function prefetchOnVisible(
  element: HTMLElement | null,
  importFn: () => Promise<unknown>,
  options?: IntersectionObserverInit,
): () => void {
  if (!element || typeof IntersectionObserver === 'undefined') {
    return () => {}
  }

  const observer = new IntersectionObserver((entries) => {
    for (const entry of entries) {
      if (entry.isIntersecting) {
        importFn()
        observer.disconnect()
      }
    }
  }, options)

  observer.observe(element)

  return () => observer.disconnect()
}

/**
 * Media query based loading
 */
export function loadOnMediaQuery(query: string, importFn: () => Promise<unknown>): () => void {
  if (typeof window === 'undefined') {
    return () => {}
  }

  const mediaQuery = window.matchMedia(query)

  const handleChange = (e: MediaQueryListEvent | MediaQueryList) => {
    if (e.matches) {
      importFn()
    }
  }

  // Check initial state
  if (mediaQuery.matches) {
    importFn()
  }

  // Listen for changes
  mediaQuery.addEventListener('change', handleChange)

  return () => mediaQuery.removeEventListener('change', handleChange)
}

/**
 * Load on interaction (click, hover, focus)
 */
export function loadOnInteraction(
  element: HTMLElement | null,
  importFn: () => Promise<unknown>,
  events: string[] = ['mouseenter', 'focus'],
): () => void {
  if (!element) {
    return () => {}
  }

  let loaded = false

  const handleInteraction = () => {
    if (!loaded) {
      loaded = true
      importFn()
      cleanup()
    }
  }

  const cleanup = () => {
    for (const event of events) {
      element.removeEventListener(event, handleInteraction)
    }
  }

  for (const event of events) {
    element.addEventListener(event, handleInteraction, { once: true })
  }

  return cleanup
}

/**
 * Split vendors into separate chunks
 */
export interface VendorChunkConfig {
  name: string
  test: RegExp
  priority?: number
}

export const VENDOR_CHUNK_CONFIGS: VendorChunkConfig[] = [
  {
    name: 'react-vendors',
    test: /[\\/]node_modules[\\/](react|react-dom|react-router|react-router-dom)[\\/]/,
    priority: 10,
  },
  {
    name: 'ui-vendors',
    test: /[\\/]node_modules[\\/](@radix-ui|@headlessui|framer-motion)[\\/]/,
    priority: 9,
  },
  {
    name: 'utils-vendors',
    test: /[\\/]node_modules[\\/](lodash|date-fns|classnames|clsx)[\\/]/,
    priority: 8,
  },
  {
    name: 'vendors',
    test: /[\\/]node_modules[\\/]/,
    priority: 5,
  },
]

/**
 * Generate webpack splitChunks config
 */
export function generateSplitChunksConfig(customChunks: VendorChunkConfig[] = []) {
  const chunks = [...VENDOR_CHUNK_CONFIGS, ...customChunks]

  const cacheGroups: Record<string, unknown> = {}

  for (const chunk of chunks) {
    cacheGroups[chunk.name] = {
      test: chunk.test,
      priority: chunk.priority || 5,
      reuseExistingChunk: true,
      enforce: true,
    }
  }

  return {
    chunks: 'all',
    maxInitialRequests: 25,
    maxAsyncRequests: 25,
    minSize: 20000,
    cacheGroups,
  }
}

/**
 * Module concatenation helper
 */
export function shouldConcatenateModule(modulePath: string): boolean {
  // Don't concatenate node_modules by default
  if (modulePath.includes('node_modules')) {
    return false
  }

  // Concatenate ES modules
  return modulePath.endsWith('.js') || modulePath.endsWith('.ts')
}

/**
 * Tree shaking helper - mark side effects
 */
export function markPureCall(fn: Function): Function {
  // This is for documentation purposes
  // Actual tree shaking is done by bundler
  return fn
}

/**
 * Analyze module dependencies
 */
export interface ModuleDependency {
  name: string
  size: number
  children: ModuleDependency[]
}

export function analyzeModuleDependencies(modulePath: string): ModuleDependency | null {
  // This would need bundler integration
  // Placeholder for now
  return null
}

/**
 * Critical CSS helper
 */
export function extractCriticalCSS(html: string): string {
  // This would need a CSS parser
  // Placeholder for now
  return ''
}

/**
 * Inline critical scripts
 */
export function shouldInlineScript(scriptPath: string, size: number): boolean {
  // Inline if:
  // 1. Critical script (runtime, polyfills)
  // 2. Small size (<5KB)
  const isCritical = scriptPath.includes('runtime') || scriptPath.includes('polyfill')
  const isSmall = size < 5 * 1024

  return isCritical || isSmall
}

/**
 * Bundle budget checker
 */
export interface BundleBudget {
  maxSize: number
  maxInitialSize: number
  maxAsyncSize: number
  maxCSSSize: number
}

export const DEFAULT_BUDGETS: BundleBudget = {
  maxSize: 500 * 1024, // 500KB total
  maxInitialSize: 200 * 1024, // 200KB initial
  maxAsyncSize: 100 * 1024, // 100KB per async chunk
  maxCSSSize: 50 * 1024, // 50KB CSS
}

export interface BudgetViolation {
  type: 'total' | 'initial' | 'async' | 'css'
  actual: number
  budget: number
  exceeded: number
}

export function checkBundleBudgets(
  stats: {
    totalSize: number
    initialSize: number
    asyncSizes: number[]
    cssSize: number
  },
  budgets: BundleBudget = DEFAULT_BUDGETS,
): BudgetViolation[] {
  const violations: BudgetViolation[] = []

  if (stats.totalSize > budgets.maxSize) {
    violations.push({
      type: 'total',
      actual: stats.totalSize,
      budget: budgets.maxSize,
      exceeded: stats.totalSize - budgets.maxSize,
    })
  }

  if (stats.initialSize > budgets.maxInitialSize) {
    violations.push({
      type: 'initial',
      actual: stats.initialSize,
      budget: budgets.maxInitialSize,
      exceeded: stats.initialSize - budgets.maxInitialSize,
    })
  }

  for (const asyncSize of stats.asyncSizes) {
    if (asyncSize > budgets.maxAsyncSize) {
      violations.push({
        type: 'async',
        actual: asyncSize,
        budget: budgets.maxAsyncSize,
        exceeded: asyncSize - budgets.maxAsyncSize,
      })
    }
  }

  if (stats.cssSize > budgets.maxCSSSize) {
    violations.push({
      type: 'css',
      actual: stats.cssSize,
      budget: budgets.maxCSSSize,
      exceeded: stats.cssSize - budgets.maxCSSSize,
    })
  }

  return violations
}
