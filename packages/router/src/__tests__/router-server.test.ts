// @vitest-environment node
import { describe, expect, it, vi } from 'vitest';

vi.mock('@revealui/utils/logger', () => ({
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

describe('Router (server-side)', () => {
  describe('resolve stores match for getCurrentMatch', () => {
    it('stores and updates match across multiple resolves', async () => {
      const router = new Router();
      router.register(createRoute('/first'));
      router.register(createRoute('/second'));
      await router.resolve('/first');
      expect(router.getCurrentMatch()?.route.path).toBe('/first');
      await router.resolve('/second');
      expect(router.getCurrentMatch()?.route.path).toBe('/second');
    });

    it('returns the last resolved match', async () => {
      const router = new Router();
      router.register(createRoute('/'));
      await router.resolve('/');
      const match = router.getCurrentMatch();
      expect(match).not.toBeNull();
      expect(match?.route.path).toBe('/');
    });
  });

  describe('navigate is a noop on server', () => {
    it('does not throw', () => {
      const router = new Router();
      expect(() => router.navigate('/somewhere')).not.toThrow();
    });

    it('does not throw with replace', () => {
      const router = new Router();
      expect(() => router.navigate('/somewhere', { replace: true })).not.toThrow();
    });
  });

  describe('back and forward are noops on server', () => {
    it('back does not throw', () => {
      const router = new Router();
      expect(() => router.back()).not.toThrow();
    });

    it('forward does not throw', () => {
      const router = new Router();
      expect(() => router.forward()).not.toThrow();
    });
  });

  describe('initClient is a noop on server', () => {
    it('does not throw', () => {
      const router = new Router();
      expect(() => router.initClient()).not.toThrow();
    });
  });
});
