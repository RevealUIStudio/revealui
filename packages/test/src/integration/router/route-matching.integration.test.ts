/**
 * Router Integration Tests
 *
 * PURPOSE: Verify routing system works correctly for navigation and data loading
 *
 * CRITICAL CONTEXT: Router must work correctly to:
 * - Match URLs to correct routes
 * - Extract parameters from dynamic segments
 * - Load data via route loaders
 * - Handle base paths and normalization
 *
 * TESTS:
 * - Route registration and matching
 * - Parameterized routes
 * - Catch-all routes
 * - Route resolution with data loading
 * - Base path handling
 * - Route normalization
 */

import { beforeEach, describe, expect, it } from 'vitest'
import { Router } from '../../../../router/src/router.js'
import type { Route, RouteParams } from '../../../../router/src/types.js'

describe('Router Integration Tests', () => {
  let router: Router

  beforeEach(() => {
    router = new Router()
  })

  // =============================================================================
  // Route Registration and Matching
  // =============================================================================

  describe('Route Registration and Matching', () => {
    it('should match exact path routes', () => {
      // Register route
      router.register({
        path: '/about',
        component: () => null,
      })

      // Match exact path
      const match = router.match('/about')
      expect(match).not.toBeNull()
      expect(match?.route.path).toBe('/about')
      expect(match?.params).toEqual({})
    })

    it('should match parameterized routes', () => {
      // Register parameterized route
      router.register({
        path: '/users/:id',
        component: () => null,
      })

      // Match with parameter
      const match = router.match('/users/123')
      expect(match).not.toBeNull()
      expect(match?.route.path).toBe('/users/:id')
      expect(match?.params.id).toBe('123')
    })

    it('should match catch-all routes', () => {
      // Register catch-all route using path-to-regexp v8 syntax
      // In v8, wildcards must have a name: /*path (one or more) or {/*path} (zero or more)
      router.register({
        path: '/docs/*path',
        component: () => null,
      })

      // Match single segment
      const match1 = router.match('/docs/introduction')
      expect(match1).not.toBeNull()
      expect(match1?.params.path).toEqual(['introduction'])

      // Match multiple segments
      const match2 = router.match('/docs/api/reference/routes')
      expect(match2).not.toBeNull()
      expect(match2?.params.path).toEqual(['api', 'reference', 'routes'])

      // Should not match without any segments after /docs
      const match3 = router.match('/docs')
      expect(match3).toBeNull()
    })

    it('should match optional catch-all routes', () => {
      // Register optional catch-all route (zero or more segments)
      router.register({
        path: '/files{/*path}',
        component: () => null,
      })

      // Match with no segments
      const match1 = router.match('/files')
      expect(match1).not.toBeNull()
      expect(match1?.params.path).toBeUndefined()

      // Match with segments
      const match2 = router.match('/files/images/logo.png')
      expect(match2).not.toBeNull()
      expect(match2?.params.path).toEqual(['images', 'logo.png'])
    })

    it('should match optional segments', () => {
      // Register route with optional segment using path-to-regexp v8 syntax
      // In v8, optional segments use {/segment} syntax
      router.register({
        path: '/files{/:folder}/:file',
        component: () => null,
      })

      // Match without optional segment
      const match1 = router.match('/files/readme.txt')
      expect(match1).not.toBeNull()
      expect(match1?.params.file).toBe('readme.txt')
      expect(match1?.params.folder).toBeUndefined()

      // Match with optional segment
      const match2 = router.match('/files/docs/readme.txt')
      expect(match2).not.toBeNull()
      expect(match2?.params.folder).toBe('docs')
      expect(match2?.params.file).toBe('readme.txt')
    })

    it('should return null for unmatched routes', () => {
      router.register({
        path: '/about',
        component: () => null,
      })

      const match = router.match('/unknown')
      expect(match).toBeNull()
    })
  })

  // =============================================================================
  // Route Resolution with Data Loading
  // =============================================================================

  describe('Route Resolution with Data Loading', () => {
    it('should call loader and include data in match result', async () => {
      const mockData = { title: 'Test Page', content: 'Test content' }

      router.register({
        path: '/test',
        component: () => null,
        loader: async () => mockData,
      })

      const match = await router.resolve('/test')
      expect(match).not.toBeNull()
      expect(match?.data).toEqual(mockData)
    })

    it('should pass params to loader', async () => {
      let capturedParams: RouteParams | null = null

      router.register({
        path: '/users/:id',
        component: () => null,
        loader: async (params) => {
          capturedParams = params
          return { userId: params.id }
        },
      })

      const match = await router.resolve('/users/456')
      expect(match).not.toBeNull()
      expect(capturedParams?.id).toBe('456')
      expect(match?.data).toEqual({ userId: '456' })
    })

    it('should handle loader errors gracefully', async () => {
      router.register({
        path: '/error',
        component: () => null,
        loader: async () => {
          throw new Error('Loader failed')
        },
      })

      await expect(router.resolve('/error')).rejects.toThrow('Loader failed')
    })
  })

  // =============================================================================
  // Base Path Handling
  // =============================================================================

  describe('Base Path Handling', () => {
    it('should strip base path before matching', () => {
      // Create router with base path
      const routerWithBase = new Router({ basePath: '/app' })

      routerWithBase.register({
        path: '/dashboard',
        component: () => null,
      })

      // Match URL with base path
      const match = routerWithBase.match('/app/dashboard')
      expect(match).not.toBeNull()
      expect(match?.route.path).toBe('/dashboard')
    })
  })

  // =============================================================================
  // Route Normalization
  // =============================================================================

  describe('Route Normalization', () => {
    it('should strip query strings before matching', () => {
      router.register({
        path: '/users',
        component: () => null,
      })

      // Match URL with query string
      const match = router.match('/users?sort=name&order=asc')
      expect(match).not.toBeNull()
      expect(match?.route.path).toBe('/users')
    })

    it('should strip hash before matching', () => {
      router.register({
        path: '/users',
        component: () => null,
      })

      // Match URL with hash
      const match = router.match('/users#section')
      expect(match).not.toBeNull()
      expect(match?.route.path).toBe('/users')
    })

    it('should add leading slash if missing', () => {
      router.register({
        path: '/users/:id',
        component: () => null,
      })

      // Match URL without leading slash
      const match = router.match('users/123')
      expect(match).not.toBeNull()
      expect(match?.params.id).toBe('123')
    })
  })
})
