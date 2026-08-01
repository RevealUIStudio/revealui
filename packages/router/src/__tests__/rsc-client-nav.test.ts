/**
 * Phase 2.2.3 — RSC client navigation (ADR D3).
 * Client mode must stay byte-compatible; RSC mode fetches via pluggable loader.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { resolveRscClientUrl } from '../negotiate.js';
import { Router } from '../router.js';
import type { Route } from '../types.js';

afterEach(() => {
  window.history.pushState(null, '', '/');
  const r = new Router();
  r.dispose();
});

function createRoute(path: string): Route {
  return { path, component: () => null };
}

describe('resolveRscClientUrl', () => {
  it('uses same-origin path when no endpoint', () => {
    expect(resolveRscClientUrl('/about', '?q=1', {}, 'http://x')).toBe('http://x/about?q=1');
  });

  it('prefixes endpoint escape hatch', () => {
    expect(resolveRscClientUrl('/posts/1', '', { endpoint: '/.rsc' }, 'http://x')).toBe(
      'http://x/.rsc/posts/1',
    );
    expect(resolveRscClientUrl('/', '', { endpoint: '/.rsc' }, 'http://x')).toBe('http://x/.rsc');
  });
});

describe('RSC client navigation (2.2.3)', () => {
  it('does not fetch in client mode', async () => {
    const loader = vi.fn().mockResolvedValue({ root: 'x' });
    const router = new Router();
    router.setRscPayloadLoader(loader);
    router.register(createRoute('/about'));
    router.navigate('/about');
    await Promise.resolve();
    expect(loader).not.toHaveBeenCalled();
    expect(router.getNavigationStatus()).toBe('idle');
  });

  it('fetches payload on navigate in rsc mode', async () => {
    const payload = { root: 'about-page' };
    const loader = vi.fn().mockResolvedValue(payload);
    const router = new Router({ rsc: {} });
    router.setRscPayloadLoader(loader);
    router.register(createRoute('/'));
    router.register(createRoute('/about'));
    router.applyRscPayload({ root: 'home' });

    const rscListener = vi.fn();
    router.subscribeRsc(rscListener);

    router.navigate('/about');
    expect(router.getNavigationStatus()).toBe('loading');
    expect(rscListener).toHaveBeenCalled();

    await vi.waitFor(() => {
      expect(router.getNavigationStatus()).toBe('idle');
    });
    expect(loader).toHaveBeenCalledOnce();
    const [url, signal] = loader.mock.calls[0] as [string, AbortSignal];
    expect(url).toContain('/about');
    expect(signal).toBeInstanceOf(AbortSignal);
    expect(router.getRscPayload()).toEqual(payload);
  });

  it('aborts prior fetch when a newer navigate starts (D3 token)', async () => {
    let resolveFirst: (v: unknown) => void = () => {};
    const first = new Promise((resolve) => {
      resolveFirst = resolve;
    });
    const loader = vi
      .fn()
      .mockImplementationOnce((_url: string, signal: AbortSignal) => {
        return new Promise((resolve, reject) => {
          signal.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError')));
          first.then(resolve);
        });
      })
      .mockResolvedValueOnce({ root: 'second' });

    const router = new Router({ rsc: {} });
    router.setRscPayloadLoader(loader);
    router.register(createRoute('/a'));
    router.register(createRoute('/b'));
    router.applyRscPayload({ root: 'home' });

    router.navigate('/a');
    router.navigate('/b');
    resolveFirst({ root: 'first' });

    await vi.waitFor(() => {
      expect(router.getRscPayload()).toEqual({ root: 'second' });
    });
    expect(loader).toHaveBeenCalledTimes(2);
    expect(router.getNavigationStatus()).toBe('idle');
  });

  it('records navigation error from loader failure', async () => {
    const loader = vi.fn().mockRejectedValue(new Error('flight failed'));
    const router = new Router({ rsc: {} });
    router.setRscPayloadLoader(loader);
    router.register(createRoute('/about'));
    router.applyRscPayload({ root: 'home' });

    router.navigate('/about');
    await vi.waitFor(() => {
      expect(router.getNavigationStatus()).toBe('error');
    });
    expect(router.getNavigationError()?.message).toBe('flight failed');
  });

  it('skipRscFetch leaves payload untouched', async () => {
    const loader = vi.fn().mockResolvedValue({ root: 'new' });
    const router = new Router({ rsc: {} });
    router.setRscPayloadLoader(loader);
    router.register(createRoute('/about'));
    router.applyRscPayload({ root: 'home' });

    router.navigate('/about', { skipRscFetch: true });
    await Promise.resolve();
    expect(loader).not.toHaveBeenCalled();
    expect(router.getRscPayload()).toEqual({ root: 'home' });
    expect(router.getCurrentMatch()?.route.path).toBe('/about');
  });

  it('popstate triggers RSC refresh after initClient', async () => {
    const loader = vi.fn().mockResolvedValue({ root: 'from-pop' });
    const router = new Router({ rsc: {} });
    router.setRscPayloadLoader(loader);
    router.register(createRoute('/'));
    router.register(createRoute('/about'));
    router.applyRscPayload({ root: 'home' });
    router.initClient();

    window.history.pushState(null, '', '/about');
    window.dispatchEvent(new PopStateEvent('popstate'));

    await vi.waitFor(() => {
      expect(loader).toHaveBeenCalled();
    });
    expect(router.getCurrentMatch()?.route.path).toBe('/about');
    router.dispose();
  });

  it('does not re-fetch when path+search unchanged (hash-only)', async () => {
    const loader = vi.fn().mockResolvedValue({ root: 'x' });
    const router = new Router({ rsc: {} });
    router.setRscPayloadLoader(loader);
    router.register(createRoute('/about'));
    router.applyRscPayload({ root: 'home' });
    // Seed fetch key as if we already have /about payload
    window.history.pushState(null, '', '/about');
    router.applyRscPayload({ root: 'about' });
    loader.mockClear();

    router.navigate('/about#section');
    await Promise.resolve();
    expect(loader).not.toHaveBeenCalled();
    expect(router.getRscPayload()).toEqual({ root: 'about' });
  });
});
