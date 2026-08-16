/**
 * Task Tester POSTs `/a2a`. Entitlements used to run before optional auth, so
 * `c.get('user')` was empty and features.ai defaulted to false — a fake
 * "not entitled" 403 for the founder Pro account (GAP-360 walk).
 */
import { Hono } from 'hono';
import { describe, expect, it } from 'vitest';

interface Vars {
  user?: { id: string };
  entitlements?: { features: { ai: boolean } };
}

describe('A2A entitlement middleware order', () => {
  it('Hono /a2a/* matches POST /a2a', async () => {
    const app = new Hono();
    const seen: string[] = [];
    app.use('/a2a/*', async (_c, next) => {
      seen.push('star');
      await next();
    });
    app.post('/a2a', (c) => c.json({ ok: true }));

    const res = await app.request('http://localhost/a2a', { method: 'POST' });
    expect(res.status).toBe(200);
    expect(seen).toEqual(['star']);
  });

  it('entitlements-before-auth attach free features even after the route sets user', async () => {
    const app = new Hono<{ Variables: Vars }>();
    app.use('/a2a/*', async (c, next) => {
      const user = c.get('user');
      c.set('entitlements', { features: { ai: Boolean(user) } });
      await next();
    });
    app.use('/a2a/*', async (c, next) => {
      c.set('user', { id: 'founder' });
      await next();
    });
    app.post('/a2a', (c) =>
      c.json({
        ai: c.get('entitlements')?.features.ai ?? false,
        user: c.get('user')?.id ?? null,
      }),
    );

    const body = (await (await app.request('http://localhost/a2a', { method: 'POST' })).json()) as {
      ai: boolean;
      user: string | null;
    };
    expect(body.user).toBe('founder');
    expect(body.ai).toBe(false);
  });

  it('auth-then-entitlements attach ai for the session user', async () => {
    const app = new Hono<{ Variables: Vars }>();
    app.use('/a2a/*', async (c, next) => {
      c.set('user', { id: 'founder' });
      await next();
    });
    app.use('/a2a/*', async (c, next) => {
      const user = c.get('user');
      c.set('entitlements', { features: { ai: Boolean(user) } });
      await next();
    });
    app.post('/a2a', (c) =>
      c.json({
        ai: c.get('entitlements')?.features.ai ?? false,
        user: c.get('user')?.id ?? null,
      }),
    );

    const body = (await (await app.request('http://localhost/a2a', { method: 'POST' })).json()) as {
      ai: boolean;
      user: string | null;
    };
    expect(body.user).toBe('founder');
    expect(body.ai).toBe(true);
  });
});
