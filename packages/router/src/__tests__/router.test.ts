import { afterEach, describe, expect, it, vi } from 'vitest';

// Mock the logger to avoid cross-package dependency issues in tests
vi.mock('../../../core/src/observability/logger.js', () => ({
  logger: {
    error: vi.fn(),
    warn: vi.fn(),
    info: vi.fn(),
    debug: vi.fn(),
  },
}));

import { Router } from '../router.js';
import type { Route } from '../types.js';

const DummyComponent = () => null;

function createRoute(path: string, overrides?: Partial<Route>): Route {
  return {
    path,
    component: DummyComponent,
    ...overrides,
  };
}

afterEach(() => {
  // Reset jsdom URL so navigate tests don't leak state
  window.history.pushState(null, '', '/');
});

describe('Router', () => {
  describe('register and getRoutes', () => {
    it('registers a single route', () => {
      const router = new Router();
      router.register(createRoute('/'));
      expect(router.getRoutes()).toHaveLength(1);
    });

    it('registers multiple routes', () => {
      const router = new Router();
      router.registerRoutes([createRoute('/'), createRoute('/about'), createRoute('/posts/:id')]);
      expect(router.getRoutes()).toHaveLength(3);
    });

    it('returns a copy of routes (not the internal array)', () => {
      const router = new Router();
      router.register(createRoute('/'));
      const routes = router.getRoutes();
      routes.push(createRoute('/extra'));
      expect(router.getRoutes()).toHaveLength(1);
    });
  });

  describe('match', () => {
    it('matches root path', () => {
      const router = new Router();
      router.register(createRoute('/'));
      const result = router.match('/');
      expect(result).not.toBeNull();
      expect(result?.route.path).toBe('/');
    });

    it('matches exact paths', () => {
      const router = new Router();
      router.register(createRoute('/about'));
      const result = router.match('/about');
      expect(result).not.toBeNull();
      expect(result?.route.path).toBe('/about');
    });

    it('matches parameterized paths and extracts params', () => {
      const router = new Router();
      router.register(createRoute('/posts/:id'));
      const result = router.match('/posts/42');
      expect(result).not.toBeNull();
      expect(result?.params.id).toBe('42');
    });

    it('returns null for unmatched paths', () => {
      const router = new Router();
      router.register(createRoute('/about'));
      expect(router.match('/contact')).toBeNull();
    });

    it('strips query strings before matching', () => {
      const router = new Router();
      router.register(createRoute('/search'));
      const result = router.match('/search?q=test');
      expect(result).not.toBeNull();
    });

    it('strips hash fragments before matching', () => {
      const router = new Router();
      router.register(createRoute('/page'));
      const result = router.match('/page#section');
      expect(result).not.toBeNull();
    });

    it('removes basePath prefix', () => {
      const router = new Router({ basePath: '/app' });
      router.register(createRoute('/dashboard'));
      const result = router.match('/app/dashboard');
      expect(result).not.toBeNull();
      expect(result?.route.path).toBe('/dashboard');
    });
  });

  describe('resolve', () => {
    it('matches and returns route without loader', async () => {
      const router = new Router();
      router.register(createRoute('/'));
      const result = await router.resolve('/');
      expect(result).not.toBeNull();
      expect(result?.data).toBeUndefined();
    });

    it('matches and runs loader', async () => {
      const router = new Router();
      router.register(
        createRoute('/posts/:id', {
          loader: async (params) => ({ title: `Post ${params.id}` }),
        }),
      );
      const result = await router.resolve('/posts/5');
      expect(result).not.toBeNull();
      expect(result?.data).toEqual({ title: 'Post 5' });
    });

    it('returns null for unmatched paths', async () => {
      const router = new Router();
      const result = await router.resolve('/nowhere');
      expect(result).toBeNull();
    });

    it('re-throws loader errors', async () => {
      const router = new Router();
      router.register(
        createRoute('/error', {
          loader: async () => {
            throw new Error('Loader failed');
          },
        }),
      );
      await expect(router.resolve('/error')).rejects.toThrow('Loader failed');
    });
  });

  describe('clear', () => {
    it('removes all routes', () => {
      const router = new Router();
      router.registerRoutes([createRoute('/'), createRoute('/about')]);
      router.clear();
      expect(router.getRoutes()).toHaveLength(0);
    });
  });

  describe('path pattern matching', () => {
    it('matches multiple named params', () => {
      const router = new Router();
      router.register(createRoute('/users/:userId/posts/:postId'));
      const result = router.match('/users/alice/posts/42');
      expect(result).not.toBeNull();
      expect(result?.params.userId).toBe('alice');
      expect(result?.params.postId).toBe('42');
    });

    it('matches wildcard paths', () => {
      const router = new Router();
      router.register(createRoute('/files/*path'));
      const result = router.match('/files/docs/readme.md');
      expect(result).not.toBeNull();
      expect(result?.params.path).toEqual(['docs', 'readme.md']);
    });

    it('matches wildcard with single segment', () => {
      const router = new Router();
      router.register(createRoute('/files/*path'));
      const result = router.match('/files/readme.md');
      expect(result).not.toBeNull();
      expect(result?.params.path).toEqual(['readme.md']);
    });

    it('matches optional segments', () => {
      const router = new Router();
      router.register(createRoute('/docs{/:section}'));
      expect(router.match('/docs')).not.toBeNull();
      const withSection = router.match('/docs/guide');
      expect(withSection).not.toBeNull();
      expect(withSection?.params.section).toBe('guide');
    });

    it('decodes URI components in params', () => {
      const router = new Router();
      router.register(createRoute('/search/:query'));
      const result = router.match('/search/hello%20world');
      expect(result).not.toBeNull();
      expect(result?.params.query).toBe('hello world');
    });

    it('returns first match when multiple routes could match', () => {
      const router = new Router();
      router.register(createRoute('/posts/new'));
      router.register(createRoute('/posts/:id'));
      const result = router.match('/posts/new');
      expect(result?.route.path).toBe('/posts/new');
    });

    it('handles paths with special regex characters', () => {
      const router = new Router();
      router.register(createRoute('/api/v1.0/users'));
      const result = router.match('/api/v1.0/users');
      expect(result).not.toBeNull();
    });

    it('does not match partial paths', () => {
      const router = new Router();
      router.register(createRoute('/about'));
      expect(router.match('/about/team')).toBeNull();
    });

    it('handles trailing slash differences', () => {
      const router = new Router();
      router.register(createRoute('/about'));
      // Without trailing slash matches
      expect(router.match('/about')).not.toBeNull();
      // With trailing slash does not match (strict)
      expect(router.match('/about/')).toBeNull();
    });

    it('handles empty path after basePath removal', () => {
      const router = new Router({ basePath: '/app' });
      router.register(createRoute('/'));
      const result = router.match('/app');
      expect(result).not.toBeNull();
    });
  });

  describe('subscribe', () => {
    it('returns an unsubscribe function', () => {
      const router = new Router();
      const listener = vi.fn();
      const unsubscribe = router.subscribe(listener);
      expect(typeof unsubscribe).toBe('function');
      unsubscribe();
    });

    it('does not call listener after unsubscribe', () => {
      const router = new Router();
      const listener = vi.fn();
      const unsubscribe = router.subscribe(listener);
      unsubscribe();
      // Trigger a resolve to potentially notify  -  no notification expected
      expect(listener).not.toHaveBeenCalled();
    });

    it('supports multiple listeners without error', () => {
      const router = new Router();
      const listener1 = vi.fn();
      const listener2 = vi.fn();
      const unsub1 = router.subscribe(listener1);
      const unsub2 = router.subscribe(listener2);

      // Both return valid unsubscribe functions
      expect(typeof unsub1).toBe('function');
      expect(typeof unsub2).toBe('function');

      // Cleanup
      unsub1();
      unsub2();
    });

    it('only unsubscribes the specific listener', () => {
      const router = new Router();
      const listener1 = vi.fn();
      const listener2 = vi.fn();
      const unsub1 = router.subscribe(listener1);
      const unsub2 = router.subscribe(listener2);

      // Unsubscribe listener1 only
      unsub1();

      // Unsubscribing again should not throw
      unsub1();

      // listener2 unsubscribe should still work
      unsub2();
    });
  });

  describe('resolve', () => {
    it('passes params to loader', async () => {
      const loader = vi.fn().mockResolvedValue({ ok: true });
      const router = new Router();
      router.register(createRoute('/users/:id', { loader }));
      await router.resolve('/users/123');
      expect(loader).toHaveBeenCalledWith({ id: '123' });
    });
  });

  describe('getOptions', () => {
    it('returns default options when none provided', () => {
      const router = new Router();
      expect(router.getOptions().basePath).toBe('');
    });

    it('returns provided options', () => {
      const notFound = () => null;
      const router = new Router({ basePath: '/app', notFound });
      const opts = router.getOptions();
      expect(opts.basePath).toBe('/app');
      expect(opts.notFound).toBe(notFound);
    });
  });

  describe('navigate (client-side)', () => {
    it('calls history.pushState on navigate', () => {
      const router = new Router();
      router.register(createRoute('/about'));
      const pushSpy = vi.spyOn(window.history, 'pushState');
      router.navigate('/about');
      expect(pushSpy).toHaveBeenCalledWith(null, '', '/about');
      pushSpy.mockRestore();
    });

    it('calls history.replaceState when replace is true', () => {
      const router = new Router();
      router.register(createRoute('/about'));
      const replaceSpy = vi.spyOn(window.history, 'replaceState');
      router.navigate('/about', { replace: true });
      expect(replaceSpy).toHaveBeenCalledWith(null, '', '/about');
      replaceSpy.mockRestore();
    });

    it('passes state to history', () => {
      const router = new Router();
      router.register(createRoute('/about'));
      const pushSpy = vi.spyOn(window.history, 'pushState');
      router.navigate('/about', { state: { from: 'home' } });
      expect(pushSpy).toHaveBeenCalledWith({ from: 'home' }, '', '/about');
      pushSpy.mockRestore();
    });

    it('prepends basePath to URL', () => {
      const router = new Router({ basePath: '/app' });
      router.register(createRoute('/about'));
      const pushSpy = vi.spyOn(window.history, 'pushState');
      router.navigate('/about');
      expect(pushSpy).toHaveBeenCalledWith(null, '', '/app/about');
      pushSpy.mockRestore();
    });

    it('notifies listeners after navigation', () => {
      const router = new Router();
      router.register(createRoute('/about'));
      const listener = vi.fn();
      router.subscribe(listener);
      router.navigate('/about');
      expect(listener).toHaveBeenCalledOnce();
    });

    it('updates getCurrentMatch after navigation', () => {
      const router = new Router();
      router.register(createRoute('/about'));
      router.navigate('/about');
      const match = router.getCurrentMatch();
      expect(match).not.toBeNull();
      expect(match?.route.path).toBe('/about');
    });
  });

  describe('listener notifications', () => {
    it('notifies all subscribers on navigate', () => {
      const router = new Router();
      router.register(createRoute('/a'));
      const listener1 = vi.fn();
      const listener2 = vi.fn();
      router.subscribe(listener1);
      router.subscribe(listener2);
      router.navigate('/a');
      expect(listener1).toHaveBeenCalledOnce();
      expect(listener2).toHaveBeenCalledOnce();
    });

    it('does not notify unsubscribed listener', () => {
      const router = new Router();
      router.register(createRoute('/a'));
      const listener = vi.fn();
      const unsub = router.subscribe(listener);
      unsub();
      router.navigate('/a');
      expect(listener).not.toHaveBeenCalled();
    });

    it('only unsubscribes the targeted listener', () => {
      const router = new Router();
      router.register(createRoute('/a'));
      const listener1 = vi.fn();
      const listener2 = vi.fn();
      const unsub1 = router.subscribe(listener1);
      router.subscribe(listener2);
      unsub1();
      router.navigate('/a');
      expect(listener1).not.toHaveBeenCalled();
      expect(listener2).toHaveBeenCalledOnce();
    });
  });

  describe('getCurrentMatch (client-side caching)', () => {
    it('returns stable reference for same pathname', () => {
      const router = new Router();
      router.register(createRoute('/'));
      const match1 = router.getCurrentMatch();
      const match2 = router.getCurrentMatch();
      expect(match1).toBe(match2);
    });

    it('returns new match when pathname changes', () => {
      const router = new Router();
      router.register(createRoute('/'));
      router.register(createRoute('/about'));
      const match1 = router.getCurrentMatch();
      router.navigate('/about');
      const match2 = router.getCurrentMatch();
      expect(match1?.route.path).toBe('/');
      expect(match2?.route.path).toBe('/about');
    });
  });

  describe('initClient and dispose', () => {
    afterEach(() => {
      // biome-ignore lint/suspicious/noExplicitAny: test cleanup for HMR guard
      (globalThis as any).__revealui_router_initialized = false;
    });

    it('sets up popstate listener', () => {
      const router = new Router();
      router.register(createRoute('/'));
      const addSpy = vi.spyOn(window, 'addEventListener');
      router.initClient();
      expect(addSpy).toHaveBeenCalledWith('popstate', expect.any(Function));
      addSpy.mockRestore();
      router.dispose();
    });

    it('sets up document click listener', () => {
      const router = new Router();
      const addSpy = vi.spyOn(document, 'addEventListener');
      router.initClient();
      expect(addSpy).toHaveBeenCalledWith('click', expect.any(Function));
      addSpy.mockRestore();
      router.dispose();
    });

    it('prevents duplicate initialization (HMR guard)', () => {
      const router = new Router();
      const addSpy = vi.spyOn(window, 'addEventListener');
      router.initClient();
      const callCount = addSpy.mock.calls.length;
      router.initClient();
      expect(addSpy.mock.calls.length).toBe(callCount);
      addSpy.mockRestore();
      router.dispose();
    });

    it('dispose removes event listeners', () => {
      const router = new Router();
      const removeSpy = vi.spyOn(window, 'removeEventListener');
      const docRemoveSpy = vi.spyOn(document, 'removeEventListener');
      router.initClient();
      router.dispose();
      expect(removeSpy).toHaveBeenCalledWith('popstate', expect.any(Function));
      expect(docRemoveSpy).toHaveBeenCalledWith('click', expect.any(Function));
      removeSpy.mockRestore();
      docRemoveSpy.mockRestore();
    });

    it('dispose clears all listeners', () => {
      const router = new Router();
      router.register(createRoute('/a'));
      const listener = vi.fn();
      router.subscribe(listener);
      router.initClient();
      router.dispose();
      // After dispose, navigating should not notify (listeners cleared)
      // Need to re-init since dispose clears HMR guard
      router.initClient();
      router.navigate('/a');
      expect(listener).not.toHaveBeenCalled();
    });

    it('dispose resets HMR guard so initClient can be called again', () => {
      const router = new Router();
      const addSpy = vi.spyOn(window, 'addEventListener');
      router.initClient();
      router.dispose();
      router.initClient();
      const popstateCalls = addSpy.mock.calls.filter((c) => c[0] === 'popstate');
      expect(popstateCalls).toHaveLength(2);
      addSpy.mockRestore();
      router.dispose();
    });
  });

  describe('ReDoS protection', () => {
    it('throws on overly long patterns', () => {
      const router = new Router();
      const longPath = `/${'a'.repeat(2100)}`;
      router.register(createRoute(longPath));
      expect(() => router.match(longPath)).toThrow(/exceeds 2048 characters/);
    });
  });

  describe('normalizePath edge cases', () => {
    it('handles URL with both query and hash', () => {
      const router = new Router();
      router.register(createRoute('/page'));
      const result = router.match('/page?foo=bar#section');
      expect(result).not.toBeNull();
    });

    it('handles basePath that does not match', () => {
      const router = new Router({ basePath: '/app' });
      router.register(createRoute('/other'));
      // Path doesn't start with basePath, so normalization keeps it
      const result = router.match('/other');
      expect(result).not.toBeNull();
    });

    it('adds leading slash to bare paths', () => {
      const router = new Router({ basePath: '/app' });
      router.register(createRoute('/'));
      // After removing /app from /app, we get empty string → normalized to /
      const result = router.match('/app');
      expect(result).not.toBeNull();
    });
  });
});
