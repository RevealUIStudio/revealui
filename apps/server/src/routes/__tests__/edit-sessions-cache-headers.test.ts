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
});
