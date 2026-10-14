/**
 * Content cache strategy A (1s freshness) header wiring.
 *
 * Proves the exact mounts index.ts applies: published-content GET reads carry
 * `s-maxage=1` (+ a small stale-while-revalidate), while edit-session routes
 * carry `no-store` because they expose auth'd drafts.
 */

import { Hono } from 'hono';
import { describe, expect, it } from 'vitest';
import { noStoreCacheMiddleware, publicCacheMiddleware } from '../../middleware/cache-control.js';

function buildApp() {
  const app = new Hono();
  const publishedContentCache = publicCacheMiddleware({ sMaxAge: 1, staleWhileRevalidate: 5 });
  app.use('/api/content/pages/*', publishedContentCache);
  app.use('/api/content/globals/*', publishedContentCache);
  app.use('/api/content/posts/*', publishedContentCache);
  app.use('/api/content/sessions', noStoreCacheMiddleware());
  app.use('/api/content/sessions/*', noStoreCacheMiddleware());

  app.get('/api/content/pages/:id', (c) => c.json({ ok: true }));
  app.get('/api/content/globals/:slug', (c) => c.json({ ok: true }));
  app.get('/api/content/posts/:id', (c) => c.json({ ok: true }));
  app.get('/api/content/sessions', (c) => c.json({ ok: true }));
  app.get('/api/content/sessions/:id', (c) => c.json({ ok: true }));
  return app;
}

describe('content cache headers', () => {
  it('published-content GET reads carry s-maxage=1', async () => {
    const app = buildApp();
    for (const url of [
      '/api/content/pages/abc',
      '/api/content/globals/header',
      '/api/content/posts/xyz',
    ]) {
      const res = await app.request(url);
      const cacheControl = res.headers.get('cache-control') ?? '';
      expect(cacheControl).toContain('s-maxage=1');
      expect(cacheControl).toContain('stale-while-revalidate=5');
      expect(cacheControl).toContain('public');
    }
  });

  it('edit-session routes carry no-store', async () => {
    const app = buildApp();
    for (const url of ['/api/content/sessions', '/api/content/sessions/abc']) {
      const res = await app.request(url);
      expect(res.headers.get('cache-control')).toBe('no-store');
    }
  });

  it.each(['Authorization', 'Cookie'])(
    'does not share-cache requests carrying %s',
    async (header) => {
      const response = await buildApp().request('/api/content/posts/xyz', {
        headers: { [header]: 'synthetic-session' },
      });
      expect(response.headers.get('Cache-Control')).toBe('no-store');
    },
  );

  it('preserves explicit route cache policy and declines responses that set cookies', async () => {
    const app = new Hono();
    app.use('*', publicCacheMiddleware({ sMaxAge: 60 }));
    app.get('/private', (c) => {
      c.header('Cache-Control', 'no-store');
      return c.json({ ok: true });
    });
    app.get('/session', (c) => {
      c.header('Set-Cookie', 'synthetic-session=value');
      return c.json({ ok: true });
    });
    expect((await app.request('/private')).headers.get('Cache-Control')).toBe('no-store');
    expect((await app.request('/session')).headers.get('Cache-Control')).toBe('no-store');
  });
});
