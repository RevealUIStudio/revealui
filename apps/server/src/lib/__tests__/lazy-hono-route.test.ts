import { Hono } from 'hono';
import { describe, expect, it, vi } from 'vitest';
import { createLazyHonoRoute, mountRelativeUrl } from '../lazy-hono-route.js';

describe('createLazyHonoRoute', () => {
  it('does not call the loader until a request hits the proxy', async () => {
    const loader = vi.fn(async () => {
      const app = new Hono();
      app.get('/', (c) => c.text('lazy-ok'));
      return { default: app };
    });

    const proxy = createLazyHonoRoute(loader);
    expect(loader).not.toHaveBeenCalled();

    const res = await proxy.request('/');
    expect(res.status).toBe(200);
    expect(await res.text()).toBe('lazy-ok');
    expect(loader).toHaveBeenCalledTimes(1);

    // Second request reuses the cached sub-app
    const res2 = await proxy.request('/');
    expect(await res2.text()).toBe('lazy-ok');
    expect(loader).toHaveBeenCalledTimes(1);
  });

  it('rewrites absolute mount paths so child GET / matches under app.route', async () => {
    const child = new Hono();
    child.get('/', (c) => c.text(`og:${c.req.query('title') ?? 'default'}`));

    const parent = new Hono();
    parent.route(
      '/api/og',
      createLazyHonoRoute(async () => ({ default: child })),
    );

    const res = await parent.request('/api/og?title=Hello');
    expect(res.status).toBe(200);
    expect(await res.text()).toBe('og:Hello');

    const bare = await parent.request('/api/og');
    expect(bare.status).toBe(200);
    expect(await bare.text()).toBe('og:default');
  });

  it('rewrites nested remaining paths under the mount base', async () => {
    const child = new Hono();
    child.get('/preview', (c) => c.text('preview-ok'));

    const parent = new Hono();
    parent.route(
      '/api/og',
      createLazyHonoRoute(async () => ({ default: child })),
    );

    const res = await parent.request('/api/og/preview');
    expect(res.status).toBe(200);
    expect(await res.text()).toBe('preview-ok');
  });
});

describe('mountRelativeUrl', () => {
  it('strips the matched basePath and keeps the query string', async () => {
    const probe = new Hono();
    let seen: string | undefined;
    probe.all('*', (c) => {
      seen = mountRelativeUrl(c).toString();
      return c.text('ok');
    });

    const parent = new Hono();
    parent.route('/api/og', probe);
    await parent.request('https://api.example.com/api/og?title=Studio');

    expect(seen).toBe('https://api.example.com/?title=Studio');
  });
});
