import { Hono } from 'hono';
import { describe, expect, it } from 'vitest';

import { createPaywall } from '../../core/paywall.js';
import { createHonoMiddleware } from '../hono.js';

const paywall = createPaywall();
const { requireFeature, requireLicense, requireResource } = createHonoMiddleware(paywall);

function createApp() {
  const app = new Hono<{ Variables: { tier: string } }>();

  // Simulate entitlements middleware setting the tier
  app.use('*', async (c, next) => {
    const tier = c.req.header('x-test-tier') ?? 'free';
    c.set('tier', tier);
    return next();
  });

  return app;
}

describe('requireFeature', () => {
  it('allows requests when feature is enabled', async () => {
    const app = createApp();
    app.use('/ai/*', requireFeature('ai'));
    app.get('/ai/tasks', (c) => c.json({ ok: true }));

    const res = await app.request('/ai/tasks', {
      headers: { 'x-test-tier': 'pro' },
    });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
  });

  it('denies requests when feature is not enabled', async () => {
    const app = createApp();
    app.use('/ai/*', requireFeature('ai'));
    app.get('/ai/tasks', (c) => c.json({ ok: true }));

    const res = await app.request('/ai/tasks', {
      headers: { 'x-test-tier': 'free' },
    });
    expect(res.status).toBe(403);

    const body = await res.json();
    expect(body.error).toContain('AI Agents');
    expect(body.requiredTier).toBe('pro');
    expect(body.upgradeUrl).toBe('/billing');
  });

  it('sets X-Paywall headers on denial', async () => {
    const app = createApp();
    app.use('/ai/*', requireFeature('ai'));
    app.get('/ai/tasks', (c) => c.json({ ok: true }));

    const res = await app.request('/ai/tasks', {
      headers: { 'x-test-tier': 'free' },
    });
    expect(res.headers.get('X-Paywall-Feature')).toBe('ai');
    expect(res.headers.get('X-Paywall-Required-Tier')).toBe('pro');
  });

  it('supports 402 status code for x402 flows', async () => {
    const app = createApp();
    app.use('/ai/*', requireFeature('ai', { statusCode: 402 }));
    app.get('/ai/tasks', (c) => c.json({ ok: true }));

    const res = await app.request('/ai/tasks', {
      headers: { 'x-test-tier': 'free' },
    });
    expect(res.status).toBe(402);

    const body = await res.json();
    expect(body.code).toBe('HTTP_402');
  });

  it('supports custom upgrade URL', async () => {
    const app = createApp();
    app.use('/ai/*', requireFeature('ai', { upgradeUrl: '/pricing' }));
    app.get('/ai/tasks', (c) => c.json({ ok: true }));

    const res = await app.request('/ai/tasks', {
      headers: { 'x-test-tier': 'free' },
    });
    const body = await res.json();
    expect(body.upgradeUrl).toBe('/pricing');
  });

  it('supports custom tier resolver', async () => {
    const app = new Hono();
    const mw = createHonoMiddleware(paywall);
    app.use(
      '/ai/*',
      mw.requireFeature('ai', {
        resolveTier: (c) => c.req.header('x-custom-tier') ?? 'free',
      }),
    );
    app.get('/ai/tasks', (c) => c.json({ ok: true }));

    const res = await app.request('/ai/tasks', {
      headers: { 'x-custom-tier': 'enterprise' },
    });
    expect(res.status).toBe(200);
  });
});

describe('requireLicense', () => {
  it('allows requests at or above the required tier', async () => {
    const app = createApp();
    app.use('/admin/*', requireLicense('pro'));
    app.get('/admin/settings', (c) => c.json({ ok: true }));

    const res = await app.request('/admin/settings', {
      headers: { 'x-test-tier': 'pro' },
    });
    expect(res.status).toBe(200);
  });

  it('allows higher tiers', async () => {
    const app = createApp();
    app.use('/admin/*', requireLicense('pro'));
    app.get('/admin/settings', (c) => c.json({ ok: true }));

    const res = await app.request('/admin/settings', {
      headers: { 'x-test-tier': 'enterprise' },
    });
    expect(res.status).toBe(200);
  });

  it('denies requests below the required tier', async () => {
    const app = createApp();
    app.use('/admin/*', requireLicense('pro'));
    app.get('/admin/settings', (c) => c.json({ ok: true }));

    const res = await app.request('/admin/settings', {
      headers: { 'x-test-tier': 'free' },
    });
    expect(res.status).toBe(403);

    const body = await res.json();
    expect(body.error).toContain('pro');
    expect(body.requiredTier).toBe('pro');
  });

  it('sets X-Paywall-Required-Tier header on denial', async () => {
    const app = createApp();
    app.use('/admin/*', requireLicense('max'));
    app.get('/admin/settings', (c) => c.json({ ok: true }));

    const res = await app.request('/admin/settings', {
      headers: { 'x-test-tier': 'free' },
    });
    expect(res.headers.get('X-Paywall-Required-Tier')).toBe('max');
  });
});

describe('requireResource', () => {
  it('allows requests under the limit', async () => {
    const app = createApp();
    app.use(
      '/sites',
      requireResource('sites', () => 0),
    );
    app.post('/sites', (c) => c.json({ ok: true }));

    const res = await app.request('/sites', {
      method: 'POST',
      headers: { 'x-test-tier': 'free' },
    });
    expect(res.status).toBe(200);
  });

  it('denies requests at the limit', async () => {
    const app = createApp();
    // Free tier limit for sites is 1
    app.use(
      '/sites',
      requireResource('sites', () => 1),
    );
    app.post('/sites', (c) => c.json({ ok: true }));

    const res = await app.request('/sites', {
      method: 'POST',
      headers: { 'x-test-tier': 'free' },
    });
    expect(res.status).toBe(403);

    const body = await res.json();
    expect(body.error).toContain('sites');
    expect(body.error).toContain('1/1');
    expect(body.resource).toBe('sites');
    expect(body.limit).toBe(1);
    expect(body.usage).toBe(1);
  });

  it('supports async usage resolvers', async () => {
    const app = createApp();
    app.use(
      '/sites',
      requireResource('sites', async () => 3),
    );
    app.post('/sites', (c) => c.json({ ok: true }));

    const res = await app.request('/sites', {
      method: 'POST',
      headers: { 'x-test-tier': 'free' },
    });
    expect(res.status).toBe(403);
  });

  it('enterprise is never over limit', async () => {
    const app = createApp();
    app.use(
      '/sites',
      requireResource('sites', () => 999_999),
    );
    app.post('/sites', (c) => c.json({ ok: true }));

    const res = await app.request('/sites', {
      method: 'POST',
      headers: { 'x-test-tier': 'enterprise' },
    });
    expect(res.status).toBe(200);
  });
});
