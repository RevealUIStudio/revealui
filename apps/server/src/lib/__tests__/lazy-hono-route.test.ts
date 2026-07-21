import { Hono } from 'hono';
import { describe, expect, it, vi } from 'vitest';
import { createLazyHonoRoute } from '../lazy-hono-route.js';

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
});
