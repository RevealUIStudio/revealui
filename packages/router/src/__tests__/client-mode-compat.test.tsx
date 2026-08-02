/**
 * T9 / D16 — client-mode backward-compat guard (0.3.x SPA surface).
 *
 * Live consumers: apps/docs, apps/marketing, agency (client SPA).
 * RSC dual-mode must not change default `new Router()` behavior:
 * - mode stays `'client'`
 * - navigate does not run loaders or middleware
 * - scroll-to-top on hashless navigate (0.3.10 / 2026-06-23)
 * - scrollRestoration stays `'auto'` after initClient
 * - 0.3.x public package exports remain present
 */
import { cleanup, render, screen } from '@testing-library/react';
import { act } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('@revealui/utils/logger', () => ({
  logger: {
    error: vi.fn(),
    warn: vi.fn(),
    info: vi.fn(),
    debug: vi.fn(),
  },
}));

import * as RouterPackage from '../index.js';
import {
  Link,
  RouterProvider,
  Routes,
  useData,
  useLocation,
  useNavigate,
  useParams,
  useRouter,
  useSearchParams,
} from '../index.js';
import { Router } from '../router.js';
import type { Route } from '../types.js';

afterEach(() => {
  cleanup();
  window.history.pushState(null, '', '/');
  // Allow re-init between tests (dispose clears the global HMR guard).
  const r = new Router();
  r.dispose();
});

function Page({ params }: { params?: Record<string, string>; data?: unknown }): React.ReactNode {
  return <div data-testid="page">page:{params?.id ?? 'home'}</div>;
}

function createRoute(path: string, overrides?: Partial<Route>): Route {
  return { path, component: Page, ...overrides };
}

describe('T9 client-mode 0.3.x public API compat', () => {
  describe('package export surface (SPA consumers)', () => {
    it('exports Router and React primitives used by docs/marketing', () => {
      expect(typeof RouterPackage.Router).toBe('function');
      expect(typeof RouterPackage.RouterProvider).toBe('function');
      expect(typeof RouterPackage.Routes).toBe('function');
      expect(typeof RouterPackage.Link).toBe('function');
      expect(typeof RouterPackage.Navigate).toBe('function');
      expect(typeof RouterPackage.useRouter).toBe('function');
      expect(typeof RouterPackage.useNavigate).toBe('function');
      expect(typeof RouterPackage.useParams).toBe('function');
      expect(typeof RouterPackage.useData).toBe('function');
      expect(typeof RouterPackage.useMatch).toBe('function');
      expect(typeof RouterPackage.useLocation).toBe('function');
      expect(typeof RouterPackage.useSearchParams).toBe('function');
    });

    it('does not export RSC-only server helpers from the main entry', () => {
      // Those live under @revealui/router/server and /server-ssr — SPA bundles
      // must not be forced to pull them from the default import path.
      const pkg = RouterPackage as Record<string, unknown>;
      expect(pkg.renderRequest).toBeUndefined();
      expect(pkg.createSSRHandler).toBeUndefined();
      expect(pkg.getRequest).toBeUndefined();
      expect(pkg.redirect).toBeUndefined();
      expect(pkg.notFound).toBeUndefined();
    });
  });

  describe('default Router instance (no rsc option)', () => {
    it('defaults to client mode with no rsc options', () => {
      const router = new Router();
      expect(router.mode).toBe('client');
      expect(router.getOptions().rsc).toBeUndefined();
      expect(router.getOptions().basePath).toBe('');
    });

    it('negotiate always returns html in client mode', () => {
      const router = new Router();
      const rscReq = new Request('http://localhost/about', {
        headers: { accept: 'text/x-component' },
      });
      expect(router.negotiate(rscReq)).toBe('html');
      expect(router.routingPathname(rscReq)).toBe('/about');
    });

    it('registers, matches, and resolves named params like 0.3.x', async () => {
      const loader = vi.fn().mockResolvedValue({ title: 'Post 9' });
      const router = new Router();
      router.register(createRoute('/posts/:id', { loader }));

      const match = router.match('/posts/9');
      expect(match?.params).toEqual({ id: '9' });
      expect(match?.data).toBeUndefined();

      const resolved = await router.resolve('/posts/9');
      expect(loader).toHaveBeenCalledWith({ id: '9' });
      expect(resolved?.data).toEqual({ title: 'Post 9' });
    });

    it('supports registerRoutes batch registration', () => {
      const router = new Router();
      router.registerRoutes([createRoute('/'), createRoute('/about')]);
      expect(router.getRoutes()).toHaveLength(2);
      expect(router.match('/about')?.route.path).toBe('/about');
    });
  });

  describe('0.3.x navigate contract (SPA path — no loaders/middleware)', () => {
    it('navigate does not run loaders or middleware', () => {
      const loader = vi.fn().mockResolvedValue({ n: 1 });
      const middleware = vi.fn().mockReturnValue(true);
      const router = new Router();
      router.register(createRoute('/about', { loader, middleware: [middleware] }));

      router.navigate('/about');

      expect(loader).not.toHaveBeenCalled();
      expect(middleware).not.toHaveBeenCalled();
      expect(router.getCurrentMatch()?.route.path).toBe('/about');
      expect(router.getCurrentMatch()?.data).toBeUndefined();
    });

    it('navigate uses pushState by default and replaceState when replace', () => {
      const router = new Router();
      router.register(createRoute('/about'));
      const pushSpy = vi.spyOn(window.history, 'pushState');
      const replaceSpy = vi.spyOn(window.history, 'replaceState');

      router.navigate('/about');
      expect(pushSpy).toHaveBeenCalledWith(null, '', '/about');

      router.navigate('/about', { replace: true, state: { from: 't9' } });
      expect(replaceSpy).toHaveBeenCalledWith({ from: 't9' }, '', '/about');

      pushSpy.mockRestore();
      replaceSpy.mockRestore();
    });

    it('notifies subscribers on navigate', () => {
      const router = new Router();
      router.register(createRoute('/about'));
      const listener = vi.fn();
      const unsub = router.subscribe(listener);
      router.navigate('/about');
      expect(listener).toHaveBeenCalledOnce();
      unsub();
      router.navigate('/');
      expect(listener).toHaveBeenCalledOnce();
    });
  });

  describe('scroll behavior (0.3.10 / 2026-06-23)', () => {
    it('scrolls to top on hashless client navigation', () => {
      const router = new Router();
      router.register(createRoute('/about'));
      const scrollSpy = vi.spyOn(window, 'scrollTo').mockImplementation(() => {});
      router.navigate('/about');
      expect(scrollSpy).toHaveBeenCalledWith(0, 0);
      scrollSpy.mockRestore();
    });

    it('does not scroll when navigating to a hash anchor', () => {
      const router = new Router();
      router.register(createRoute('/about'));
      const scrollSpy = vi.spyOn(window, 'scrollTo').mockImplementation(() => {});
      router.navigate('/about#section');
      expect(scrollSpy).not.toHaveBeenCalled();
      scrollSpy.mockRestore();
    });

    it('initClient forces history.scrollRestoration to auto', () => {
      const router = new Router();
      window.history.scrollRestoration = 'manual';
      router.initClient();
      expect(window.history.scrollRestoration).toBe('auto');
      router.dispose();
    });
  });

  describe('React SPA composition (docs/marketing shape)', () => {
    it('RouterProvider + Routes + Link render and navigate without RSC', async () => {
      const router = new Router();
      router.register(createRoute('/'));
      router.register(createRoute('/about'));
      router.seedCurrentMatch(router.match('/'));

      function App(): React.ReactNode {
        return (
          <RouterProvider router={router}>
            <nav>
              <Link to="/about">About</Link>
            </nav>
            <Routes />
          </RouterProvider>
        );
      }

      render(<App />);
      expect(screen.getByTestId('page').textContent).toBe('page:home');

      const scrollSpy = vi.spyOn(window, 'scrollTo').mockImplementation(() => {});
      await act(async () => {
        screen.getByRole('link', { name: 'About' }).click();
      });
      expect(router.getCurrentMatch()?.route.path).toBe('/about');
      // Same page component for both routes; path change is the contract.
      expect(scrollSpy).toHaveBeenCalledWith(0, 0);
      scrollSpy.mockRestore();
    });

    it('hooks resolve against the current client match', () => {
      function ProbePage(): React.ReactNode {
        const r = useRouter();
        const params = useParams<{ id: string }>();
        const data = useData<{ title: string }>();
        const loc = useLocation();
        const search = useSearchParams();
        const navigate = useNavigate();
        return (
          <div>
            <span data-testid="mode">{r.mode}</span>
            <span data-testid="id">{params.id}</span>
            <span data-testid="data">{data?.title}</span>
            <span data-testid="path">{loc.pathname}</span>
            <span data-testid="q">{search.get('q')}</span>
            <button type="button" onClick={() => navigate('/')}>
              go
            </button>
          </div>
        );
      }

      const router = new Router();
      router.register({
        path: '/posts/:id',
        component: ProbePage,
      });
      // URL first so seedCurrentMatch locks lastPathname to the live path
      // (getCurrentMatch re-matches and drops data if pathname drifts).
      window.history.pushState(null, '', '/posts/42?q=1');
      const match = router.match('/posts/42');
      if (!match) throw new Error('expected match');
      match.data = { title: 'seeded' };
      router.seedCurrentMatch(match);

      render(
        <RouterProvider router={router}>
          <Routes />
        </RouterProvider>,
      );

      expect(screen.getByTestId('mode').textContent).toBe('client');
      expect(screen.getByTestId('id').textContent).toBe('42');
      expect(screen.getByTestId('data').textContent).toBe('seeded');
      expect(screen.getByTestId('path').textContent).toBe('/posts/42');
      expect(screen.getByTestId('q').textContent).toBe('1');
    });
  });
});
