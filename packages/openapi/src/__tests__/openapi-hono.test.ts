import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { createRoute } from '../create-route.js';
import { OpenAPIHono } from '../openapi-hono.js';

describe('OpenAPIHono', () => {
  it('creates an instance with an empty registry', () => {
    const app = new OpenAPIHono();
    expect(app.openAPIRegistry).toBeDefined();
    expect(app.openAPIRegistry.definitions).toEqual([]);
  });

  it('registers a route in the registry via .openapi()', () => {
    const app = new OpenAPIHono();
    const route = createRoute({
      method: 'get',
      path: '/test',
      responses: { 200: { description: 'OK' } },
    });

    app.openapi(route, (c) => c.json({ ok: true }));

    const registered = app.openAPIRegistry.definitions.filter((d) => d.type === 'route');
    expect(registered).toHaveLength(1);
  });

  it('does not register route when hide is true', () => {
    const app = new OpenAPIHono();
    const route = createRoute({
      method: 'get',
      path: '/hidden',
      hide: true,
      responses: { 200: { description: 'OK' } },
    });

    app.openapi(route, (c) => c.json({ ok: true }));

    const registered = app.openAPIRegistry.definitions.filter((d) => d.type === 'route');
    expect(registered).toHaveLength(0);
  });

  it('validates query params from route config', async () => {
    const app = new OpenAPIHono();
    const route = createRoute({
      method: 'get',
      path: '/test',
      request: {
        query: z.object({ page: z.coerce.number() }),
      },
      responses: { 200: { description: 'OK' } },
    });

    app.openapi(route, (c) => {
      const { page } = c.req.valid('query');
      return c.json({ page });
    });

    const res = await app.request('/test?page=5');
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ page: 5 });
  });

  it('returns 400 on invalid query params', async () => {
    const app = new OpenAPIHono();
    const route = createRoute({
      method: 'get',
      path: '/test',
      request: {
        query: z.object({ page: z.coerce.number().min(1) }),
      },
      responses: { 200: { description: 'OK' } },
    });

    app.openapi(route, (c) => c.json({ ok: true }));

    const res = await app.request('/test?page=0');
    expect(res.status).toBe(400);
  });

  it('validates JSON body from route config', async () => {
    const app = new OpenAPIHono();
    const route = createRoute({
      method: 'post',
      path: '/test',
      request: {
        body: {
          content: {
            'application/json': {
              schema: z.object({ name: z.string() }),
            },
          },
          required: true,
        },
      },
      responses: { 200: { description: 'OK' } },
    });

    app.openapi(route, (c) => {
      const body = c.req.valid('json');
      return c.json({ received: body.name });
    });

    const res = await app.request('/test', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Alice' }),
    });

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ received: 'Alice' });
  });

  it('skips body validation when content-type absent and body not required', async () => {
    const app = new OpenAPIHono();
    const route = createRoute({
      method: 'post',
      path: '/test',
      request: {
        body: {
          content: {
            'application/json': {
              schema: z.object({ name: z.string() }),
            },
          },
          // required is NOT set (defaults to false)
        },
      },
      responses: { 200: { description: 'OK' } },
    });

    app.openapi(route, (c) => {
      return c.json({ ok: true });
    });

    // Send request with no content-type and no body
    const res = await app.request('/test', { method: 'POST' });
    expect(res.status).toBe(200);
  });

  it('generates OpenAPI 3.0 document via .doc()', async () => {
    const app = new OpenAPIHono();
    const route = createRoute({
      method: 'get',
      path: '/users',
      tags: ['users'],
      summary: 'List users',
      responses: {
        200: {
          content: {
            'application/json': {
              schema: z.object({ users: z.array(z.string()) }),
            },
          },
          description: 'Success',
        },
      },
    });

    app.openapi(route, (c) => c.json({ users: [] }));
    app.doc('/openapi.json', { openapi: '3.0.0', info: { title: 'Test', version: '1.0.0' } });

    const res = await app.request('/openapi.json');
    expect(res.status).toBe(200);

    const doc = await res.json();
    expect(doc.openapi).toBe('3.0.0');
    expect(doc.info.title).toBe('Test');
    expect(doc.paths['/users']).toBeDefined();
    expect(doc.paths['/users'].get).toBeDefined();
    expect(doc.paths['/users'].get.tags).toEqual(['users']);
  });

  it('merges sub-app registries via .route()', async () => {
    const parent = new OpenAPIHono();
    const child = new OpenAPIHono();

    const childRoute = createRoute({
      method: 'get',
      path: '/items',
      responses: { 200: { description: 'OK' } },
    });

    child.openapi(childRoute, (c) => c.json({ items: [] }));
    parent.route('/api', child);

    parent.doc('/openapi.json', {
      openapi: '3.0.0',
      info: { title: 'Test', version: '1.0.0' },
    });

    const res = await parent.request('/openapi.json');
    const doc = await res.json();

    expect(doc.paths['/api/items']).toBeDefined();
  });

  it('works with non-OpenAPIHono sub-app', async () => {
    const { Hono } = await import('hono');
    const parent = new OpenAPIHono();
    const child = new Hono();

    child.get('/plain', (c) => c.json({ ok: true }));

    // Should not throw — Hono sub-app works, just no registry merge
    parent.route('/legacy', child);

    expect(parent.openAPIRegistry.definitions).toHaveLength(0);
  });

  it('preserves basePath in generated spec', async () => {
    const app = new OpenAPIHono().basePath('/api/v1');

    const route = createRoute({
      method: 'get',
      path: '/health',
      responses: { 200: { description: 'OK' } },
    });

    app.openapi(route, (c) => c.json({ status: 'ok' }));
    app.doc('/openapi.json', { openapi: '3.0.0', info: { title: 'Test', version: '1.0.0' } });

    const res = await app.request('/api/v1/openapi.json');
    const doc = await res.json();

    expect(doc.paths['/api/v1/health']).toBeDefined();
  });

  it('applies defaultHook to all routes', async () => {
    const app = new OpenAPIHono({
      defaultHook: (result, c) => {
        if (!result.success) {
          return c.json({ defaultError: true }, 422);
        }
      },
    });

    const route = createRoute({
      method: 'post',
      path: '/test',
      request: {
        body: {
          content: {
            'application/json': {
              schema: z.object({ name: z.string() }),
            },
          },
          required: true,
        },
      },
      responses: { 200: { description: 'OK' } },
    });

    app.openapi(route, (c) => c.json({ ok: true }));

    const res = await app.request('/test', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 123 }),
    });

    expect(res.status).toBe(422);
    expect(await res.json()).toEqual({ defaultError: true });
  });

  it('applies per-route middleware before validators', async () => {
    const app = new OpenAPIHono();
    const order: string[] = [];

    const route = createRoute({
      method: 'get',
      path: '/test',
      middleware: [
        // biome-ignore lint/suspicious/noExplicitAny: test middleware with flexible typing
        async (_c: any, next: any) => {
          order.push('middleware');
          await next();
        },
        // biome-ignore lint/suspicious/noExplicitAny: RouteConfig middleware accepts flexible typing
      ] as any,
      request: {
        query: z.object({ q: z.string() }),
      },
      responses: { 200: { description: 'OK' } },
    });

    app.openapi(route, (c) => {
      order.push('handler');
      return c.json({ order });
    });

    await app.request('/test?q=hello');

    expect(order).toEqual(['middleware', 'handler']);
  });

  // ---------------------------------------------------------------------------
  // OpenAPI 3.1 document generation
  // ---------------------------------------------------------------------------

  it('generates OpenAPI 3.1 document via .doc31()', async () => {
    const app = new OpenAPIHono();
    const route = createRoute({
      method: 'get',
      path: '/items',
      responses: {
        200: {
          content: {
            'application/json': {
              schema: z.object({ items: z.array(z.string()) }),
            },
          },
          description: 'Success',
        },
      },
    });

    app.openapi(route, (c) => c.json({ items: [] }));
    app.doc31('/openapi31.json', {
      openapi: '3.1.0',
      info: { title: 'Test v31', version: '2.0.0' },
    });

    const res = await app.request('/openapi31.json');
    expect(res.status).toBe(200);

    const doc = await res.json();
    expect(doc.openapi).toBe('3.1.0');
    expect(doc.info.title).toBe('Test v31');
    expect(doc.paths['/items']).toBeDefined();
  });

  it('getOpenAPI31Document returns spec object directly', () => {
    const app = new OpenAPIHono();
    const route = createRoute({
      method: 'get',
      path: '/test',
      responses: { 200: { description: 'OK' } },
    });

    app.openapi(route, (c) => c.json({ ok: true }));

    const doc = app.getOpenAPI31Document({
      openapi: '3.1.0',
      info: { title: 'Direct', version: '1.0.0' },
    });

    expect(doc.openapi).toBe('3.1.0');
    expect(doc.info.title).toBe('Direct');
    expect(doc.paths?.['/test']).toBeDefined();
  });

  // ---------------------------------------------------------------------------
  // Header validation
  // ---------------------------------------------------------------------------

  it('validates headers from route config', async () => {
    const app = new OpenAPIHono();
    const route = createRoute({
      method: 'get',
      path: '/test',
      request: {
        headers: z.object({
          'x-api-key': z.string().min(10),
        }),
      },
      responses: { 200: { description: 'OK' } },
    });

    app.openapi(route, (c) => {
      const headers = c.req.valid('header');
      return c.json({ key: headers['x-api-key'] });
    });

    // Valid header
    const valid = await app.request('/test', {
      headers: { 'x-api-key': 'abcdefghij' },
    });
    expect(valid.status).toBe(200);

    // Invalid header (too short)
    const invalid = await app.request('/test', {
      headers: { 'x-api-key': 'short' },
    });
    expect(invalid.status).toBe(400);
  });

  // ---------------------------------------------------------------------------
  // Path parameter validation
  // ---------------------------------------------------------------------------

  it('validates path params from route config', async () => {
    const app = new OpenAPIHono();
    const route = createRoute({
      method: 'get',
      path: '/users/{id}',
      request: {
        params: z.object({
          id: z.string().min(1),
        }),
      },
      responses: { 200: { description: 'OK' } },
    });

    app.openapi(route, (c) => {
      const { id } = c.req.valid('param');
      return c.json({ userId: id });
    });

    const res = await app.request('/users/user-123');
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ userId: 'user-123' });
  });

  // ---------------------------------------------------------------------------
  // Cookie validation
  // ---------------------------------------------------------------------------

  it('validates cookies from route config', async () => {
    const app = new OpenAPIHono();
    const route = createRoute({
      method: 'get',
      path: '/test',
      request: {
        cookies: z.object({
          session: z.string().min(1),
        }),
      },
      responses: { 200: { description: 'OK' } },
    });

    app.openapi(route, (c) => {
      const cookies = c.req.valid('cookie');
      return c.json({ session: cookies.session });
    });

    const valid = await app.request('/test', {
      headers: { Cookie: 'session=abc123' },
    });
    expect(valid.status).toBe(200);
  });

  // ---------------------------------------------------------------------------
  // Form data validation
  // ---------------------------------------------------------------------------

  it('validates form body from route config', async () => {
    const app = new OpenAPIHono();
    const route = createRoute({
      method: 'post',
      path: '/submit',
      request: {
        body: {
          content: {
            'application/x-www-form-urlencoded': {
              schema: z.object({ name: z.string() }),
            },
          },
          required: true,
        },
      },
      responses: { 200: { description: 'OK' } },
    });

    app.openapi(route, (c) => {
      const form = c.req.valid('form');
      return c.json({ name: form.name });
    });

    const body = new URLSearchParams({ name: 'Alice' });
    const res = await app.request('/submit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
    });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ name: 'Alice' });
  });

  // ---------------------------------------------------------------------------
  // Doc generation with configure function
  // ---------------------------------------------------------------------------

  it('doc() accepts a configure function for OpenAPI object', async () => {
    const app = new OpenAPIHono();
    const route = createRoute({
      method: 'get',
      path: '/test',
      responses: { 200: { description: 'OK' } },
    });

    app.openapi(route, (c) => c.json({ ok: true }));
    app.doc('/openapi.json', (c) => ({
      openapi: '3.0.0',
      info: { title: 'Dynamic', version: '1.0.0' },
    }));

    const res = await app.request('/openapi.json');
    const doc = await res.json();
    expect(doc.info.title).toBe('Dynamic');
  });
});
