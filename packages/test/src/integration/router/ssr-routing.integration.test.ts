/**
 * SSR Routing Integration Tests
 *
 * PURPOSE: Verify server-side rendering routing behavior
 *
 * CRITICAL CONTEXT: SSR routing must work correctly to:
 * - Resolve routes on the server without window object
 * - Execute loaders during SSR
 * - Store match results for hydration
 * - Handle errors on server appropriately
 *
 * TESTS:
 * - Server-side route resolution
 * - Loader execution during SSR
 * - Hydration support
 * - Error handling on server
 * - Navigation state (no-op on server)
 */

import { beforeEach, describe, expect, it } from 'vitest'
import { Router } from '../../../../router/src/router.js'

describe('SSR Routing Integration Tests', () => {
  let router: Router

  beforeEach(() => {
    router = new Router()
  })

  // =============================================================================
  // Server-Side Route Resolution
  // =============================================================================

  describe('Server-Side Route Resolution', () => {
    it('should resolve route and store match for SSR', async () => {
      // Register route with loader
      const mockData = { title: 'SSR Page', content: 'Server-rendered content' }
      router.register({
        path: '/ssr',
        component: () => null,
        loader: async () => mockData,
      })

      // Resolve route (simulating server)
      const match = await router.resolve('/ssr')
      expect(match).not.toBeNull()
      expect(match?.data).toEqual(mockData)

      // Verify getCurrentMatch returns stored match
      const currentMatch = router.getCurrentMatch()
      expect(currentMatch).not.toBeNull()
      expect(currentMatch?.data).toEqual(mockData)
    })

    it('should execute loaders during SSR', async () => {
      let loaderCalled = false

      router.register({
        path: '/page',
        component: () => null,
        loader: async () => {
          loaderCalled = true
          return { loaded: true }
        },
      })

      await router.resolve('/page')
      expect(loaderCalled).toBe(true)
    })
  })

  // =============================================================================
  // Hydration
  // =============================================================================

  describe('Hydration', () => {
    it('should match client URL after hydration', () => {
      // Register route
      router.register({
        path: '/dashboard',
        component: () => null,
      })

      // Match route (client-side behavior simulation)
      const match = router.match('/dashboard')
      expect(match).not.toBeNull()
      expect(match?.route.path).toBe('/dashboard')
    })

    it('should preserve SSR data during hydration', async () => {
      const ssrData = { fromServer: true, content: 'SSR data' }

      router.register({
        path: '/hydrate',
        component: () => null,
        loader: async () => ssrData,
      })

      // SSR: resolve on server
      const ssrMatch = await router.resolve('/hydrate')
      expect(ssrMatch?.data).toEqual(ssrData)

      // Hydration: data should be available
      const currentMatch = router.getCurrentMatch()
      expect(currentMatch?.data).toEqual(ssrData)
    })
  })

  // =============================================================================
  // Error Handling
  // =============================================================================

  describe('Error Handling', () => {
    it('should handle 404 on server', async () => {
      router.register({
        path: '/exists',
        component: () => null,
      })

      // Try to resolve non-existent route
      const match = await router.resolve('/does-not-exist')
      expect(match).toBeNull()
    })

    it('should handle loader errors on server', async () => {
      router.register({
        path: '/error',
        component: () => null,
        loader: async () => {
          throw new Error('Server loader error')
        },
      })

      await expect(router.resolve('/error')).rejects.toThrow('Server loader error')
    })
  })

  // =============================================================================
  // Navigation State
  // =============================================================================

  describe('Navigation State', () => {
    it('should not navigate on server (no-op)', () => {
      router.register({
        path: '/page',
        component: () => null,
      })

      // Navigate should be no-op on server (no window)
      // This shouldn't throw
      expect(() => {
        router.navigate('/page')
      }).not.toThrow()
    })

    it('should not subscribe to history on server', () => {
      // Subscribe should work but have no effect on server
      const listener = () => {}
      const unsubscribe = router.subscribe(listener)

      // Should not throw
      expect(() => unsubscribe()).not.toThrow()
    })
  })
})
