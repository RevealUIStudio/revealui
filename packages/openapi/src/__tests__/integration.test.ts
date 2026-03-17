import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { createRoute, OpenAPIHono } from '../index.js';

describe('integration', () => {
  it('full round-trip: define routes → generate OpenAPI doc', async () => {
    const app = new OpenAPIHono();

    const listRoute = createRoute({
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

    const getRoute = createRoute({
      method: 'get',
      path: '/users/{id}',
      tags: ['users'],
      summary: 'Get user',
      request: {
        params: z.object({ id: z.string() }),
      },
      responses: {
        200: {
          content: {
            'application/json': {
              schema: z.object({ id: z.string(), name: z.string() }),
            },
          },
          description: 'Success',
        },
        404: { description: 'Not found' },
      },
    });

    const createUserRoute = createRoute({
      method: 'post',
      path: '/users',
      tags: ['users'],
      summary: 'Create user',
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
      responses: {
        201: {
          content: {
            'application/json': {
              schema: z.object({ id: z.string(), name: z.string() }),
            },
          },
          description: 'Created',
        },
      },
    });

    app.openapi(listRoute, (c) => c.json({ users: ['Alice'] }));
    app.openapi(getRoute, (c) => c.json({ id: '1', name: 'Alice' }));
    app.openapi(createUserRoute, (c) => c.json({ id: '2', name: 'Bob' }, 201));

    const doc = app.getOpenAPIDocument({
      openapi: '3.0.0',
      info: { title: 'Test API', version: '1.0.0' },
    });

    // Verify paths
    expect(Object.keys(doc.paths)).toContain('/users');
    expect(Object.keys(doc.paths)).toContain('/users/{id}');

    // Verify methods
    expect(doc.paths['/users'].get).toBeDefined();
    expect(doc.paths['/users'].post).toBeDefined();
    expect(doc.paths['/users/{id}'].get).toBeDefined();

    // Verify tags
    expect(doc.paths['/users'].get.tags).toEqual(['users']);
  });

  it('nested apps with base paths produce correct spec', async () => {
    const parent = new OpenAPIHono();
    const usersApp = new OpenAPIHono();
    const postsApp = new OpenAPIHono();

    usersApp.openapi(
      createRoute({
        method: 'get',
        path: '/list',
        responses: { 200: { description: 'OK' } },
      }),
      (c) => c.json([]),
    );

    postsApp.openapi(
      createRoute({
        method: 'get',
        path: '/list',
        responses: { 200: { description: 'OK' } },
      }),
      (c) => c.json([]),
    );

    parent.route('/users', usersApp);
    parent.route('/posts', postsApp);

    const doc = parent.getOpenAPIDocument({
      openapi: '3.0.0',
      info: { title: 'Test', version: '1.0.0' },
    });

    expect(doc.paths['/users/list']).toBeDefined();
    expect(doc.paths['/posts/list']).toBeDefined();
  });

  it('request validation end-to-end', async () => {
    const app = new OpenAPIHono();

    app.openapi(
      createRoute({
        method: 'post',
        path: '/items',
        request: {
          body: {
            content: {
              'application/json': {
                schema: z.object({ name: z.string().min(1), count: z.number().int().positive() }),
              },
            },
            required: true,
          },
        },
        responses: { 200: { description: 'OK' } },
      }),
      (c) => {
        const body = c.req.valid('json');
        return c.json({ created: body.name, count: body.count });
      },
    );

    // Valid request
    const validRes = await app.request('/items', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Widget', count: 5 }),
    });
    expect(validRes.status).toBe(200);
    expect(await validRes.json()).toEqual({ created: 'Widget', count: 5 });

    // Invalid request
    const invalidRes = await app.request('/items', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: '', count: -1 }),
    });
    expect(invalidRes.status).toBe(400);
  });

  it('exports match expected public API', async () => {
    const mod = await import('../index.js');
    expect(mod.OpenAPIHono).toBeDefined();
    expect(mod.createRoute).toBeDefined();
    expect(mod.zValidator).toBeDefined();
    expect(mod.$).toBeDefined();
    expect(mod.extendZodWithOpenApi).toBeDefined();
    expect(mod.z).toBeDefined();
  });
});
