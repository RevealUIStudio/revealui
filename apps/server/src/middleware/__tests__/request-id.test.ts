import { Hono } from 'hono';
import { describe, expect, it } from 'vitest';

import { requestIdMiddleware } from '../request-id.js';

type TestVariables = { requestId: string };

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------
describe('requestIdMiddleware', () => {
  it('generates a UUID when no x-request-id header is present', async () => {
    const app = new Hono<{ Variables: TestVariables }>();
    app.use('*', requestIdMiddleware());
    app.get('/test', (c) => c.json({ requestId: c.get('requestId') }));

    const res = await app.request('/test');

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.requestId).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
    );
  });

  it('uses existing x-request-id header when present', async () => {
    const app = new Hono<{ Variables: TestVariables }>();
    app.use('*', requestIdMiddleware());
    app.get('/test', (c) => c.json({ requestId: c.get('requestId') }));

    const res = await app.request('/test', {
      headers: { 'x-request-id': 'incoming-req-42' },
    });

    const body = await res.json();
    expect(body.requestId).toBe('incoming-req-42');
  });

  it('sets X-Request-ID response header to match context value', async () => {
    const app = new Hono<{ Variables: TestVariables }>();
    app.use('*', requestIdMiddleware());
    app.get('/test', (c) => c.json({ ok: true }));

    const res = await app.request('/test', {
      headers: { 'x-request-id': 'correlated-123' },
    });

    expect(res.headers.get('X-Request-ID')).toBe('correlated-123');
  });

  it('sets X-Request-ID response header with generated UUID', async () => {
    const app = new Hono<{ Variables: TestVariables }>();
    app.use('*', requestIdMiddleware());
    app.get('/test', (c) => c.json({ ok: true }));

    const res = await app.request('/test');

    const headerValue = res.headers.get('X-Request-ID');
    expect(headerValue).toBeTruthy();
    expect(headerValue).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
  });

  it('generates unique IDs for different requests', async () => {
    const app = new Hono<{ Variables: TestVariables }>();
    app.use('*', requestIdMiddleware());
    app.get('/test', (c) => c.json({ requestId: c.get('requestId') }));

    const res1 = await app.request('/test');
    const res2 = await app.request('/test');

    const body1 = await res1.json();
    const body2 = await res2.json();
    expect(body1.requestId).not.toBe(body2.requestId);
  });

  it('makes request ID available to downstream middleware', async () => {
    const app = new Hono<{ Variables: TestVariables }>();
    app.use('*', requestIdMiddleware());
    app.use('*', async (c, next) => {
      // Downstream middleware should be able to read the request ID
      c.header('X-Downstream-Check', c.get('requestId'));
      await next();
    });
    app.get('/test', (c) => c.json({ ok: true }));

    const res = await app.request('/test', {
      headers: { 'x-request-id': 'downstream-test' },
    });

    expect(res.headers.get('X-Downstream-Check')).toBe('downstream-test');
  });
});
