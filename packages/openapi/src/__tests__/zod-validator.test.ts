import { Hono } from 'hono';
import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { zValidator } from '../zod-validator.js';

describe('zValidator', () => {
  it('validates JSON body and passes data to handler', async () => {
    const app = new Hono();
    const schema = z.object({ name: z.string() });

    app.post('/test', zValidator('json', schema), (c) => {
      const data = c.req.valid('json');
      return c.json({ received: data.name });
    });

    const res = await app.request('/test', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Alice' }),
    });

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ received: 'Alice' });
  });

  it('returns 400 on invalid JSON body', async () => {
    const app = new Hono();
    const schema = z.object({ name: z.string() });

    app.post('/test', zValidator('json', schema), (c) => {
      return c.json({ ok: true });
    });

    const res = await app.request('/test', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 123 }),
    });

    expect(res.status).toBe(400);
  });

  it('validates query parameters', async () => {
    const app = new Hono();
    const schema = z.object({ page: z.coerce.number() });

    app.get('/test', zValidator('query', schema), (c) => {
      const data = c.req.valid('query');
      return c.json({ page: data.page });
    });

    const res = await app.request('/test?page=3');

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ page: 3 });
  });

  it('validates path parameters', async () => {
    const app = new Hono();
    const schema = z.object({ id: z.string() });

    app.get('/users/:id', zValidator('param', schema), (c) => {
      const data = c.req.valid('param');
      return c.json({ id: data.id });
    });

    const res = await app.request('/users/abc123');

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ id: 'abc123' });
  });

  it('validates headers (case-insensitive key mapping)', async () => {
    const app = new Hono();
    const schema = z.object({ 'x-api-key': z.string() });

    app.get('/test', zValidator('header', schema), (c) => {
      const data = c.req.valid('header');
      return c.json({ key: data['x-api-key'] });
    });

    const res = await app.request('/test', {
      headers: { 'X-API-Key': 'secret123' },
    });

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ key: 'secret123' });
  });

  it('invokes custom hook on validation failure', async () => {
    const app = new Hono();
    const schema = z.object({ name: z.string() });

    app.post(
      '/test',
      zValidator('json', schema, (result, c) => {
        if (!result.success) {
          return c.json({ custom: 'error' }, 422);
        }
      }),
      (c) => {
        return c.json({ ok: true });
      },
    );

    const res = await app.request('/test', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 123 }),
    });

    expect(res.status).toBe(422);
    expect(await res.json()).toEqual({ custom: 'error' });
  });

  it('invokes custom hook on validation success', async () => {
    const app = new Hono();
    const schema = z.object({ name: z.string() });

    app.post(
      '/test',
      zValidator('json', schema, (result, _c) => {
        if (result.success) {
          // Hook does nothing on success  -  falls through to handler
        }
      }),
      (c) => {
        const data = c.req.valid('json');
        return c.json({ received: data.name });
      },
    );

    const res = await app.request('/test', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Bob' }),
    });

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ received: 'Bob' });
  });

  it('returns 400 when required body is missing', async () => {
    const app = new Hono();
    const schema = z.object({ name: z.string() });

    app.post('/test', zValidator('json', schema), (c) => {
      return c.json({ ok: true });
    });

    const res = await app.request('/test', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{}',
    });

    expect(res.status).toBe(400);
  });
});
