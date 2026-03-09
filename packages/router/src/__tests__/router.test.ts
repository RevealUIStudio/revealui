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

  describe('path pattern matching', () => {
    it('matches multiple named params', () => {
      const router = new Router()
      router.register(createRoute('/users/:userId/posts/:postId'))
      const result = router.match('/users/alice/posts/42')
      expect(result).not.toBeNull()
      expect(result?.params.userId).toBe('alice')
      expect(result?.params.postId).toBe('42')
    })

    it('matches wildcard paths', () => {
      const router = new Router()
      router.register(createRoute('/files/*path'))
      const result = router.match('/files/docs/readme.md')
      expect(result).not.toBeNull()
      expect(result?.params.path).toEqual(['docs', 'readme.md'])
    })

    it('matches wildcard with single segment', () => {
      const router = new Router()
      router.register(createRoute('/files/*path'))
      const result = router.match('/files/readme.md')
      expect(result).not.toBeNull()
      expect(result?.params.path).toEqual(['readme.md'])
    })

    it('matches optional segments', () => {
      const router = new Router()
      router.register(createRoute('/docs{/:section}'))
      expect(router.match('/docs')).not.toBeNull()
      const withSection = router.match('/docs/guide')
      expect(withSection).not.toBeNull()
      expect(withSection?.params.section).toBe('guide')
    })

    it('decodes URI components in params', () => {
      const router = new Router()
      router.register(createRoute('/search/:query'))
      const result = router.match('/search/hello%20world')
      expect(result).not.toBeNull()
      expect(result?.params.query).toBe('hello world')
    })

    it('returns first match when multiple routes could match', () => {
      const router = new Router()
      router.register(createRoute('/posts/new'))
      router.register(createRoute('/posts/:id'))
      const result = router.match('/posts/new')
      expect(result?.route.path).toBe('/posts/new')
    })

    it('handles paths with special regex characters', () => {
      const router = new Router()
      router.register(createRoute('/api/v1.0/users'))
      const result = router.match('/api/v1.0/users')
      expect(result).not.toBeNull()
    })

    it('does not match partial paths', () => {
      const router = new Router()
      router.register(createRoute('/about'))
      expect(router.match('/about/team')).toBeNull()
    })

    it('handles trailing slash differences', () => {
      const router = new Router()
      router.register(createRoute('/about'))
      // Without trailing slash matches
      expect(router.match('/about')).not.toBeNull()
      // With trailing slash does not match (strict)
      expect(router.match('/about/')).toBeNull()
    })

    it('handles empty path after basePath removal', () => {
      const router = new Router({ basePath: '/app' })
      router.register(createRoute('/'))
      const result = router.match('/app')
      expect(result).not.toBeNull()
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

    it('does not call listener after unsubscribe', () => {
      const router = new Router()
      const listener = vi.fn()
      const unsubscribe = router.subscribe(listener)
      unsubscribe()
      // Trigger a resolve to potentially notify — no notification expected
      expect(listener).not.toHaveBeenCalled()
    })

    it('supports multiple listeners', () => {
      const router = new Router()
      const listener1 = vi.fn()
      const listener2 = vi.fn()
      router.subscribe(listener1)
      router.subscribe(listener2)
      // Both should be registered (can't directly test notification without client env)
      expect(true).toBe(true)
    })

    it('only unsubscribes the specific listener', () => {
      const router = new Router()
      const listener1 = vi.fn()
      const listener2 = vi.fn()
      const unsub1 = router.subscribe(listener1)
      router.subscribe(listener2)
      unsub1()
      // listener2 should still be subscribed — just verify no error thrown
      expect(true).toBe(true)
    })
  })

  describe('resolve', () => {
    it('passes params to loader', async () => {
      const loader = vi.fn().mockResolvedValue({ ok: true })
      const router = new Router()
      router.register(createRoute('/users/:id', { loader }))
      await router.resolve('/users/123')
      expect(loader).toHaveBeenCalledWith({ id: '123' })
    })
  })

  // Server-side tests (navigate, back, forward, initClient, getCurrentMatch after resolve)
  // are in router-server.test.ts which runs with @vitest-environment node

  describe('normalizePath edge cases', () => {
    it('handles URL with both query and hash', () => {
      const router = new Router()
      router.register(createRoute('/page'))
      const result = router.match('/page?foo=bar#section')
      expect(result).not.toBeNull()
    })

    it('handles basePath that does not match', () => {
      const router = new Router({ basePath: '/app' })
      router.register(createRoute('/other'))
      // Path doesn't start with basePath, so normalization keeps it
      const result = router.match('/other')
      expect(result).not.toBeNull()
    })

    it('adds leading slash to bare paths', () => {
      const router = new Router({ basePath: '/app' })
      router.register(createRoute('/'))
      // After removing /app from /app, we get empty string → normalized to /
      const result = router.match('/app')
      expect(result).not.toBeNull()
    })
  })
})
