import { Hono } from 'hono';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Mock dependencies
// ---------------------------------------------------------------------------
const mockDb = { select: vi.fn(), insert: vi.fn(), update: vi.fn() };

vi.mock('@revealui/db', () => ({
  getClient: vi.fn(() => mockDb),
}));

import { getClient } from '@revealui/db';
import { dbMiddleware } from '../db.js';

const mockedGetClient = vi.mocked(getClient);

beforeEach(() => {
  vi.clearAllMocks();
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------
describe('dbMiddleware', () => {
  it('sets db on context', async () => {
    // biome-ignore lint/suspicious/noExplicitAny: test helper  -  Hono Variables type requires loose typing
    const app = new Hono<{ Variables: { db: any } }>();
    app.use('*', dbMiddleware());
    app.get('/test', (c) => {
      const db = c.get('db');
      return c.json({ hasDb: db != null });
    });

    const res = await app.request('/test');

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.hasDb).toBe(true);
  });

  it('calls getClient to obtain database instance', async () => {
    // biome-ignore lint/suspicious/noExplicitAny: test helper
    const app = new Hono<{ Variables: { db: any } }>();
    app.use('*', dbMiddleware());
    app.get('/test', (c) => c.json({ ok: true }));

    await app.request('/test');

    expect(mockedGetClient).toHaveBeenCalledOnce();
  });

  it('provides the same client returned by getClient', async () => {
    const customDb = { custom: true };
    // biome-ignore lint/suspicious/noExplicitAny: test mock  -  partial DB shape
    mockedGetClient.mockReturnValue(customDb as any);

    // biome-ignore lint/suspicious/noExplicitAny: test helper
    const app = new Hono<{ Variables: { db: any } }>();
    app.use('*', dbMiddleware());
    app.get('/test', (c) => {
      const db = c.get('db');
      return c.json({ custom: db.custom });
    });

    const res = await app.request('/test');

    const body = await res.json();
    expect(body.custom).toBe(true);
  });

  it('calls next() after setting db', async () => {
    const nextReached = vi.fn();

    // biome-ignore lint/suspicious/noExplicitAny: test helper
    const app = new Hono<{ Variables: { db: any } }>();
    app.use('*', dbMiddleware());
    app.use('*', async (_c, next) => {
      nextReached();
      await next();
    });
    app.get('/test', (c) => c.json({ ok: true }));

    await app.request('/test');

    expect(nextReached).toHaveBeenCalledOnce();
  });
});
