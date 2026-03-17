import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { createRoute } from '../create-route.js';

describe('createRoute', () => {
  it('preserves all route config properties', () => {
    const route = createRoute({
      method: 'get',
      path: '/users',
      tags: ['users'],
      summary: 'List users',
      description: 'Returns all users',
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

    expect(route.method).toBe('get');
    expect(route.path).toBe('/users');
    expect(route.tags).toEqual(['users']);
    expect(route.summary).toBe('List users');
    expect(route.description).toBe('Returns all users');
    expect(route.responses).toBeDefined();
  });

  it('converts {param} to :param in getRoutingPath', () => {
    const route = createRoute({
      method: 'get',
      path: '/users/{id}',
      responses: { 200: { description: 'OK' } },
    });

    expect(route.getRoutingPath()).toBe('/users/:id');
  });

  it('converts multiple params in getRoutingPath', () => {
    const route = createRoute({
      method: 'get',
      path: '/orgs/{orgId}/members/{userId}',
      responses: { 200: { description: 'OK' } },
    });

    expect(route.getRoutingPath()).toBe('/orgs/:orgId/members/:userId');
  });

  it('returns path unchanged when no params', () => {
    const route = createRoute({
      method: 'get',
      path: '/health',
      responses: { 200: { description: 'OK' } },
    });

    expect(route.getRoutingPath()).toBe('/health');
  });

  it('makes getRoutingPath non-enumerable', () => {
    const route = createRoute({
      method: 'get',
      path: '/users/{id}',
      responses: { 200: { description: 'OK' } },
    });

    expect(Object.keys(route)).not.toContain('getRoutingPath');
  });

  it('getRoutingPath does not appear in JSON serialization', () => {
    const route = createRoute({
      method: 'get',
      path: '/users/{id}',
      responses: { 200: { description: 'OK' } },
    });

    const json = JSON.parse(JSON.stringify(route));
    expect(json.getRoutingPath).toBeUndefined();
  });

  it('preserves request config with params and body', () => {
    const route = createRoute({
      method: 'post',
      path: '/users/{id}',
      request: {
        params: z.object({ id: z.string() }),
        body: {
          content: {
            'application/json': {
              schema: z.object({ name: z.string() }),
            },
          },
        },
      },
      responses: { 201: { description: 'Created' } },
    });

    expect(route.request).toBeDefined();
    expect(route.request?.params).toBeDefined();
    expect(route.request?.body).toBeDefined();
  });
});
