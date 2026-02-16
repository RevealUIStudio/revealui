import { describe, expect, it, vi } from 'vitest'

// Mock the logger to avoid cross-package dependency issues in tests
vi.mock('../../../core/src/observability/logger.js', () => ({
  logger: {
    error: vi.fn(),
    warn: vi.fn(),
    info: vi.fn(),
    debug: vi.fn(),
  },
}))

import { Router } from '../router.js'
import type { Route } from '../types.js'

const DummyComponent = () => null

function createRoute(path: string, overrides?: Partial<Route>): Route {
  return {
    path,
    component: DummyComponent,
    ...overrides,
  }
}

describe('Router', () => {
  describe('register and getRoutes', () => {
    it('registers a single route', () => {
      const router = new Router()
      router.register(createRoute('/'))
      expect(router.getRoutes()).toHaveLength(1)
    })

    it('registers multiple routes', () => {
      const router = new Router()
      router.registerRoutes([createRoute('/'), createRoute('/about'), createRoute('/posts/:id')])
      expect(router.getRoutes()).toHaveLength(3)
    })

    it('returns a copy of routes (not the internal array)', () => {
      const router = new Router()
      router.register(createRoute('/'))
      const routes = router.getRoutes()
      routes.push(createRoute('/extra'))
      expect(router.getRoutes()).toHaveLength(1)
    })
  })

  describe('match', () => {
    it('matches root path', () => {
      const router = new Router()
      router.register(createRoute('/'))
      const result = router.match('/')
      expect(result).not.toBeNull()
      expect(result?.route.path).toBe('/')
    })

    it('matches exact paths', () => {
      const router = new Router()
      router.register(createRoute('/about'))
      const result = router.match('/about')
      expect(result).not.toBeNull()
      expect(result?.route.path).toBe('/about')
    })

    it('matches parameterized paths and extracts params', () => {
      const router = new Router()
      router.register(createRoute('/posts/:id'))
      const result = router.match('/posts/42')
      expect(result).not.toBeNull()
      expect(result?.params.id).toBe('42')
    })

    it('returns null for unmatched paths', () => {
      const router = new Router()
      router.register(createRoute('/about'))
      expect(router.match('/contact')).toBeNull()
    })

    it('strips query strings before matching', () => {
      const router = new Router()
      router.register(createRoute('/search'))
      const result = router.match('/search?q=test')
      expect(result).not.toBeNull()
    })

    it('strips hash fragments before matching', () => {
      const router = new Router()
      router.register(createRoute('/page'))
      const result = router.match('/page#section')
      expect(result).not.toBeNull()
    })

    it('removes basePath prefix', () => {
      const router = new Router({ basePath: '/app' })
      router.register(createRoute('/dashboard'))
      const result = router.match('/app/dashboard')
      expect(result).not.toBeNull()
      expect(result?.route.path).toBe('/dashboard')
    })
  })

  describe('resolve', () => {
    it('matches and returns route without loader', async () => {
      const router = new Router()
      router.register(createRoute('/'))
      const result = await router.resolve('/')
      expect(result).not.toBeNull()
      expect(result?.data).toBeUndefined()
    })

    it('matches and runs loader', async () => {
      const router = new Router()
      router.register(
        createRoute('/posts/:id', {
          loader: async (params) => ({ title: `Post ${params.id}` }),
        }),
      )
      const result = await router.resolve('/posts/5')
      expect(result).not.toBeNull()
      expect(result?.data).toEqual({ title: 'Post 5' })
    })

    it('returns null for unmatched paths', async () => {
      const router = new Router()
      const result = await router.resolve('/nowhere')
      expect(result).toBeNull()
    })

    it('re-throws loader errors', async () => {
      const router = new Router()
      router.register(
        createRoute('/error', {
          loader: async () => {
            throw new Error('Loader failed')
          },
        }),
      )
      await expect(router.resolve('/error')).rejects.toThrow('Loader failed')
    })
  })

  describe('clear', () => {
    it('removes all routes', () => {
      const router = new Router()
      router.registerRoutes([createRoute('/'), createRoute('/about')])
      router.clear()
      expect(router.getRoutes()).toHaveLength(0)
    })
  })

  describe('subscribe', () => {
    it('returns an unsubscribe function', () => {
      const router = new Router()
      const listener = vi.fn()
      const unsubscribe = router.subscribe(listener)
      expect(typeof unsubscribe).toBe('function')
      unsubscribe()
    })
  })

  describe('getCurrentMatch (server-side)', () => {
    it('returns null when no match has been resolved', () => {
      const router = new Router()
      expect(router.getCurrentMatch()).toBeNull()
    })

    it('returns the last resolved match on server', async () => {
      const router = new Router()
      router.register(createRoute('/'))
      await router.resolve('/')
      const match = router.getCurrentMatch()
      expect(match).not.toBeNull()
      expect(match?.route.path).toBe('/')
    })
  })
})
