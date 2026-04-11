/**
 * Native OpenAPI Implementation Tests
 *
 * Tests for the zero-dependency Zod → OpenAPI pipeline:
 * - Zod extension (.openapi() metadata)
 * - Registry (route/schema collection)
 * - Zod → JSON Schema converter
 * - Document generators (V3 + V31)
 */

import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { NativeOpenApiGeneratorV3, NativeOpenApiGeneratorV31 } from '../native/generator.js';
import { NativeOpenAPIRegistry } from '../native/registry.js';
import {
  extendZodWithOpenApi,
  getOpenApiMetadata,
  setOpenApiMetadata,
} from '../native/zod-extension.js';
import { zodToJsonSchema } from '../native/zod-to-schema.js';

// Extend Zod once for all tests
extendZodWithOpenApi(z);

// =============================================================================
// Zod Extension
// =============================================================================

describe('Zod Extension', () => {
  it('adds .openapi() method to Zod schemas', () => {
    const schema = z.string().openapi({ description: 'A name' });
    const meta = getOpenApiMetadata(schema);
    expect(meta?.description).toBe('A name');
  });

  it('supports multiple metadata fields', () => {
    const schema = z.number().openapi({
      description: 'User age',
      example: 25,
      deprecated: true,
      format: 'int32',
    });
    const meta = getOpenApiMetadata(schema);
    expect(meta?.example).toBe(25);
    expect(meta?.deprecated).toBe(true);
    expect(meta?.format).toBe('int32');
  });

  it('supports refId for $ref generation', () => {
    const schema = z.object({ id: z.string() }).openapi({ refId: 'User' });
    const meta = getOpenApiMetadata(schema);
    expect(meta?.refId).toBe('User');
  });

  it('returns undefined for schemas without metadata', () => {
    const schema = z.string();
    expect(getOpenApiMetadata(schema)).toBeUndefined();
  });

  it('setOpenApiMetadata works directly', () => {
    const schema = z.boolean();
    setOpenApiMetadata(schema, { description: 'Active flag' });
    expect(getOpenApiMetadata(schema)?.description).toBe('Active flag');
  });

  it('extendZodWithOpenApi is idempotent', () => {
    // Should not throw or duplicate
    extendZodWithOpenApi(z);
    extendZodWithOpenApi(z);
    const schema = z.string().openapi({ description: 'test' });
    expect(getOpenApiMetadata(schema)?.description).toBe('test');
  });
});

// =============================================================================
// Registry
// =============================================================================

describe('NativeOpenAPIRegistry', () => {
  it('starts with empty definitions', () => {
    const registry = new NativeOpenAPIRegistry();
    expect(registry.definitions).toHaveLength(0);
  });

  it('registerPath adds a route definition', () => {
    const registry = new NativeOpenAPIRegistry();
    registry.registerPath({
      method: 'get',
      path: '/users',
      responses: { 200: { description: 'Success' } },
    });
    expect(registry.definitions).toHaveLength(1);
    expect(registry.definitions[0].type).toBe('route');
  });

  it('register adds a schema definition', () => {
    const registry = new NativeOpenAPIRegistry();
    registry.register('User', z.object({ id: z.string() }));
    expect(registry.definitions).toHaveLength(1);
    expect(registry.definitions[0].type).toBe('schema');
  });

  it('registerComponent adds a component definition', () => {
    const registry = new NativeOpenAPIRegistry();
    registry.registerComponent('securitySchemes', 'BearerAuth', {
      type: 'http',
      scheme: 'bearer',
    });
    expect(registry.definitions).toHaveLength(1);
    expect(registry.definitions[0].type).toBe('component');
  });

  it('registerWebhook adds a webhook definition', () => {
    const registry = new NativeOpenAPIRegistry();
    registry.registerWebhook({
      method: 'post',
      path: '/webhooks/order',
      responses: { 200: { description: 'Received' } },
    });
    expect(registry.definitions).toHaveLength(1);
    expect(registry.definitions[0].type).toBe('webhook');
  });

  it('registerParameter adds a parameter definition', () => {
    const registry = new NativeOpenAPIRegistry();
    registry.registerParameter('PageParam', z.number().int().min(1));
    expect(registry.definitions).toHaveLength(1);
    expect(registry.definitions[0].type).toBe('parameter');
  });

  it('accumulates multiple definitions', () => {
    const registry = new NativeOpenAPIRegistry();
    registry.registerPath({ method: 'get', path: '/a', responses: {} });
    registry.registerPath({ method: 'post', path: '/b', responses: {} });
    registry.register('Schema1', z.string());
    expect(registry.definitions).toHaveLength(3);
  });
});

// =============================================================================
// Zod → JSON Schema Converter
// =============================================================================

describe('zodToJsonSchema', () => {
  describe('primitives', () => {
    it('converts z.string()', () => {
      expect(zodToJsonSchema(z.string())).toEqual({ type: 'string' });
    });

    it('converts z.number()', () => {
      expect(zodToJsonSchema(z.number())).toEqual({ type: 'number' });
    });

    it('converts z.boolean()', () => {
      expect(zodToJsonSchema(z.boolean())).toEqual({ type: 'boolean' });
    });

    it('converts z.null()', () => {
      expect(zodToJsonSchema(z.null())).toEqual({ type: 'null' });
    });

    it('converts z.date() to string format date-time', () => {
      expect(zodToJsonSchema(z.date())).toEqual({ type: 'string', format: 'date-time' });
    });

    it('converts z.bigint() to integer format int64', () => {
      expect(zodToJsonSchema(z.bigint())).toEqual({ type: 'integer', format: 'int64' });
    });
  });

  describe('string constraints', () => {
    it('min/max length', () => {
      const schema = z.string().min(3).max(50);
      const result = zodToJsonSchema(schema);
      expect(result.minLength).toBe(3);
      expect(result.maxLength).toBe(50);
    });

    it('email format', () => {
      expect(zodToJsonSchema(z.string().email())).toMatchObject({ format: 'email' });
    });

    it('url format', () => {
      expect(zodToJsonSchema(z.string().url())).toMatchObject({ format: 'uri' });
    });

    it('uuid format', () => {
      expect(zodToJsonSchema(z.string().uuid())).toMatchObject({ format: 'uuid' });
    });

    it('datetime format', () => {
      expect(zodToJsonSchema(z.string().datetime())).toMatchObject({ format: 'date-time' });
    });
  });

  describe('number constraints', () => {
    it('integer', () => {
      expect(zodToJsonSchema(z.number().int())).toMatchObject({ type: 'integer' });
    });

    it('min/max', () => {
      const result = zodToJsonSchema(z.number().min(0).max(100));
      expect(result.minimum).toBe(0);
      expect(result.maximum).toBe(100);
    });

    it('multipleOf', () => {
      expect(zodToJsonSchema(z.number().multipleOf(5))).toMatchObject({ multipleOf: 5 });
    });
  });

  describe('literals and enums', () => {
    it('string literal', () => {
      expect(zodToJsonSchema(z.literal('active'))).toEqual({ type: 'string', const: 'active' });
    });

    it('number literal', () => {
      expect(zodToJsonSchema(z.literal(42))).toEqual({ type: 'number', const: 42 });
    });

    it('boolean literal', () => {
      expect(zodToJsonSchema(z.literal(true))).toEqual({ type: 'boolean', const: true });
    });

    it('z.enum()', () => {
      const result = zodToJsonSchema(z.enum(['active', 'inactive', 'pending']));
      expect(result.type).toBe('string');
      expect(result.enum).toEqual(['active', 'inactive', 'pending']);
    });
  });

  describe('arrays', () => {
    it('basic array', () => {
      const result = zodToJsonSchema(z.array(z.string()));
      expect(result.type).toBe('array');
      expect(result.items).toEqual({ type: 'string' });
    });

    it('min/max items', () => {
      const result = zodToJsonSchema(z.array(z.number()).min(1).max(10));
      expect(result.minItems).toBe(1);
      expect(result.maxItems).toBe(10);
    });
  });

  describe('objects', () => {
    it('simple object', () => {
      const schema = z.object({ name: z.string(), age: z.number() });
      const result = zodToJsonSchema(schema);
      expect(result.type).toBe('object');
      expect(result.properties?.name).toEqual({ type: 'string' });
      expect(result.properties?.age).toEqual({ type: 'number' });
      expect(result.required).toEqual(['name', 'age']);
    });

    it('optional fields are not required', () => {
      const schema = z.object({ name: z.string(), bio: z.string().optional() });
      const result = zodToJsonSchema(schema);
      expect(result.required).toEqual(['name']);
    });

    it('fields with defaults are not required', () => {
      const schema = z.object({ role: z.string().default('viewer') });
      const result = zodToJsonSchema(schema);
      expect(result.required).toBeUndefined();
      expect(result.properties?.role?.default).toBe('viewer');
    });
  });

  describe('unions and intersections', () => {
    it('z.union() produces oneOf', () => {
      const schema = z.union([z.string(), z.number()]);
      const result = zodToJsonSchema(schema);
      expect(result.oneOf).toHaveLength(2);
      expect(result.oneOf?.[0]).toEqual({ type: 'string' });
      expect(result.oneOf?.[1]).toEqual({ type: 'number' });
    });

    it('z.intersection() produces allOf', () => {
      const schema = z.intersection(z.object({ a: z.string() }), z.object({ b: z.number() }));
      const result = zodToJsonSchema(schema);
      expect(result.allOf).toHaveLength(2);
    });
  });

  describe('nullable and optional', () => {
    it('nullable adds nullable: true', () => {
      const result = zodToJsonSchema(z.string().nullable());
      expect(result.nullable).toBe(true);
      expect(result.type).toBe('string');
    });

    it('optional unwraps to inner type', () => {
      const result = zodToJsonSchema(z.string().optional());
      expect(result.type).toBe('string');
    });
  });

  describe('records', () => {
    it('z.record() produces object with additionalProperties', () => {
      const result = zodToJsonSchema(z.record(z.string(), z.number()));
      expect(result.type).toBe('object');
      expect(result.additionalProperties).toEqual({ type: 'number' });
    });
  });

  describe('OpenAPI metadata integration', () => {
    it('applies description from .openapi()', () => {
      const schema = z.string().openapi({ description: 'User email' });
      const result = zodToJsonSchema(schema);
      expect(result.description).toBe('User email');
    });

    it('applies format override from .openapi()', () => {
      const schema = z.string().openapi({ format: 'password' });
      const result = zodToJsonSchema(schema);
      expect(result.format).toBe('password');
    });

    it('applies example from .openapi()', () => {
      const schema = z.number().openapi({ example: 42 });
      const result = zodToJsonSchema(schema);
      expect(result.example).toBe(42);
    });

    it('applies Zod .describe() as fallback description', () => {
      const schema = z.string().describe('A test field');
      const result = zodToJsonSchema(schema);
      expect(result.description).toBe('A test field');
    });
  });

  describe('effects and wrappers', () => {
    it('z.coerce.number() unwraps to number', () => {
      const result = zodToJsonSchema(z.coerce.number());
      expect(result.type).toBe('number');
    });

    it('z.string().default() includes default value', () => {
      const result = zodToJsonSchema(z.string().default('hello'));
      expect(result.type).toBe('string');
      expect(result.default).toBe('hello');
    });
  });
});

// =============================================================================
// Document Generator  -  V3
// =============================================================================

describe('NativeOpenApiGeneratorV3', () => {
  const baseConfig = {
    openapi: '3.0.0',
    info: { title: 'Test API', version: '1.0.0' },
  };

  it('generates minimal document with no definitions', () => {
    const gen = new NativeOpenApiGeneratorV3([]);
    const doc = gen.generateDocument(baseConfig);

    expect(doc.openapi).toBe('3.0.0');
    expect(doc.info).toEqual({ title: 'Test API', version: '1.0.0' });
    expect(doc.paths).toEqual({});
    expect(doc.components).toBeUndefined();
  });

  it('preserves config fields (servers, tags, security)', () => {
    const gen = new NativeOpenApiGeneratorV3([]);
    const doc = gen.generateDocument({
      ...baseConfig,
      servers: [{ url: 'https://api.example.com' }],
      tags: [{ name: 'users', description: 'User operations' }],
      security: [{ BearerAuth: [] }],
    });

    expect(doc.servers).toEqual([{ url: 'https://api.example.com' }]);
    expect(doc.tags).toEqual([{ name: 'users', description: 'User operations' }]);
    expect(doc.security).toEqual([{ BearerAuth: [] }]);
  });

  describe('routes', () => {
    it('generates path with GET method', () => {
      const registry = new NativeOpenAPIRegistry();
      registry.registerPath({
        method: 'get',
        path: '/users',
        summary: 'List users',
        tags: ['users'],
        responses: { 200: { description: 'Success' } },
      });

      const gen = new NativeOpenApiGeneratorV3(registry.definitions);
      const doc = gen.generateDocument(baseConfig);
      const paths = doc.paths as Record<string, Record<string, unknown>>;

      expect(paths['/users']).toBeDefined();
      expect(paths['/users'].get).toBeDefined();

      const op = paths['/users'].get as Record<string, unknown>;
      expect(op.summary).toBe('List users');
      expect(op.tags).toEqual(['users']);
    });

    it('generates multiple methods on same path', () => {
      const registry = new NativeOpenAPIRegistry();
      registry.registerPath({
        method: 'get',
        path: '/users',
        responses: { 200: { description: 'List' } },
      });
      registry.registerPath({
        method: 'post',
        path: '/users',
        responses: { 201: { description: 'Created' } },
      });

      const gen = new NativeOpenApiGeneratorV3(registry.definitions);
      const doc = gen.generateDocument(baseConfig);
      const paths = doc.paths as Record<string, Record<string, unknown>>;

      expect(paths['/users'].get).toBeDefined();
      expect(paths['/users'].post).toBeDefined();
    });

    it('includes operationId, description, deprecated', () => {
      const registry = new NativeOpenAPIRegistry();
      registry.registerPath({
        method: 'delete',
        path: '/users/{id}',
        operationId: 'deleteUser',
        description: 'Delete a user by ID',
        deprecated: true,
        responses: { 204: { description: 'Deleted' } },
      });

      const gen = new NativeOpenApiGeneratorV3(registry.definitions);
      const doc = gen.generateDocument(baseConfig);
      const paths = doc.paths as Record<string, Record<string, unknown>>;
      const op = paths['/users/{id}'].delete as Record<string, unknown>;

      expect(op.operationId).toBe('deleteUser');
      expect(op.description).toBe('Delete a user by ID');
      expect(op.deprecated).toBe(true);
    });

    it('includes route-level security', () => {
      const registry = new NativeOpenAPIRegistry();
      registry.registerPath({
        method: 'get',
        path: '/admin',
        security: [{ BearerAuth: ['admin'] }],
        responses: { 200: { description: 'OK' } },
      });

      const gen = new NativeOpenApiGeneratorV3(registry.definitions);
      const doc = gen.generateDocument(baseConfig);
      const paths = doc.paths as Record<string, Record<string, unknown>>;
      const op = paths['/admin'].get as Record<string, unknown>;

      expect(op.security).toEqual([{ BearerAuth: ['admin'] }]);
    });
  });

  describe('parameters', () => {
    it('extracts path parameters from request.params', () => {
      const registry = new NativeOpenAPIRegistry();
      registry.registerPath({
        method: 'get',
        path: '/users/{id}',
        request: {
          params: z.object({ id: z.string().openapi({ description: 'User ID' }) }),
        },
        responses: { 200: { description: 'OK' } },
      });

      const gen = new NativeOpenApiGeneratorV3(registry.definitions);
      const doc = gen.generateDocument(baseConfig);
      const paths = doc.paths as Record<string, Record<string, unknown>>;
      const op = paths['/users/{id}'].get as Record<string, unknown>;
      const params = op.parameters as Array<Record<string, unknown>>;

      expect(params).toHaveLength(1);
      expect(params[0].name).toBe('id');
      expect(params[0].in).toBe('path');
      expect(params[0].required).toBe(true);
      expect(params[0].description).toBe('User ID');
      expect(params[0].schema).toEqual({ type: 'string', description: 'User ID' });
    });

    it('extracts query parameters from request.query', () => {
      const registry = new NativeOpenAPIRegistry();
      registry.registerPath({
        method: 'get',
        path: '/users',
        request: {
          query: z.object({
            page: z.number().int().min(1),
            limit: z.number().int().optional(),
          }),
        },
        responses: { 200: { description: 'OK' } },
      });

      const gen = new NativeOpenApiGeneratorV3(registry.definitions);
      const doc = gen.generateDocument(baseConfig);
      const paths = doc.paths as Record<string, Record<string, unknown>>;
      const op = paths['/users'].get as Record<string, unknown>;
      const params = op.parameters as Array<Record<string, unknown>>;

      expect(params).toHaveLength(2);

      const pageParam = params.find((p) => p.name === 'page');
      expect(pageParam?.in).toBe('query');
      expect(pageParam?.required).toBe(true);

      const limitParam = params.find((p) => p.name === 'limit');
      expect(limitParam?.in).toBe('query');
      expect(limitParam?.required).toBeUndefined();
    });

    it('extracts header parameters from request.headers', () => {
      const registry = new NativeOpenAPIRegistry();
      registry.registerPath({
        method: 'get',
        path: '/data',
        request: {
          headers: z.object({
            'x-api-key': z.string(),
          }),
        },
        responses: { 200: { description: 'OK' } },
      });

      const gen = new NativeOpenApiGeneratorV3(registry.definitions);
      const doc = gen.generateDocument(baseConfig);
      const paths = doc.paths as Record<string, Record<string, unknown>>;
      const op = paths['/data'].get as Record<string, unknown>;
      const params = op.parameters as Array<Record<string, unknown>>;

      expect(params).toHaveLength(1);
      expect(params[0].name).toBe('x-api-key');
      expect(params[0].in).toBe('header');
      expect(params[0].required).toBe(true);
    });

    it('extracts cookie parameters from request.cookies', () => {
      const registry = new NativeOpenAPIRegistry();
      registry.registerPath({
        method: 'get',
        path: '/session',
        request: {
          cookies: z.object({
            sessionId: z.string(),
          }),
        },
        responses: { 200: { description: 'OK' } },
      });

      const gen = new NativeOpenApiGeneratorV3(registry.definitions);
      const doc = gen.generateDocument(baseConfig);
      const paths = doc.paths as Record<string, Record<string, unknown>>;
      const op = paths['/session'].get as Record<string, unknown>;
      const params = op.parameters as Array<Record<string, unknown>>;

      expect(params).toHaveLength(1);
      expect(params[0].name).toBe('sessionId');
      expect(params[0].in).toBe('cookie');
    });

    it('combines params from all locations', () => {
      const registry = new NativeOpenAPIRegistry();
      registry.registerPath({
        method: 'get',
        path: '/orgs/{orgId}/users',
        request: {
          params: z.object({ orgId: z.string() }),
          query: z.object({ page: z.number().optional() }),
          headers: z.object({ authorization: z.string() }),
        },
        responses: { 200: { description: 'OK' } },
      });

      const gen = new NativeOpenApiGeneratorV3(registry.definitions);
      const doc = gen.generateDocument(baseConfig);
      const paths = doc.paths as Record<string, Record<string, unknown>>;
      const op = paths['/orgs/{orgId}/users'].get as Record<string, unknown>;
      const params = op.parameters as Array<Record<string, unknown>>;

      expect(params).toHaveLength(3);
      expect(params.map((p) => p.in)).toEqual(['path', 'query', 'header']);
    });
  });

  describe('request body', () => {
    it('generates JSON request body', () => {
      const registry = new NativeOpenAPIRegistry();
      registry.registerPath({
        method: 'post',
        path: '/users',
        request: {
          body: {
            content: {
              'application/json': {
                schema: z.object({ name: z.string(), email: z.string().email() }),
              },
            },
            required: true,
            description: 'User to create',
          },
        },
        responses: { 201: { description: 'Created' } },
      });

      const gen = new NativeOpenApiGeneratorV3(registry.definitions);
      const doc = gen.generateDocument(baseConfig);
      const paths = doc.paths as Record<string, Record<string, unknown>>;
      const op = paths['/users'].post as Record<string, unknown>;
      const body = op.requestBody as Record<string, unknown>;

      expect(body.required).toBe(true);
      expect(body.description).toBe('User to create');

      const content = body.content as Record<string, Record<string, unknown>>;
      const jsonSchema = content['application/json'].schema as Record<string, unknown>;
      expect(jsonSchema.type).toBe('object');
      expect(jsonSchema.required).toEqual(['name', 'email']);
    });

    it('generates multipart form request body', () => {
      const registry = new NativeOpenAPIRegistry();
      registry.registerPath({
        method: 'post',
        path: '/upload',
        request: {
          body: {
            content: {
              'multipart/form-data': {
                schema: z.object({ file: z.string(), name: z.string() }),
              },
            },
          },
        },
        responses: { 200: { description: 'OK' } },
      });

      const gen = new NativeOpenApiGeneratorV3(registry.definitions);
      const doc = gen.generateDocument(baseConfig);
      const paths = doc.paths as Record<string, Record<string, unknown>>;
      const op = paths['/upload'].post as Record<string, unknown>;
      const body = op.requestBody as Record<string, unknown>;
      const content = body.content as Record<string, unknown>;

      expect(content['multipart/form-data']).toBeDefined();
    });
  });

  describe('responses', () => {
    it('generates response with JSON content', () => {
      const registry = new NativeOpenAPIRegistry();
      registry.registerPath({
        method: 'get',
        path: '/users',
        responses: {
          200: {
            description: 'Success',
            content: {
              'application/json': {
                schema: z.object({ users: z.array(z.string()) }),
              },
            },
          },
          404: { description: 'Not found' },
        },
      });

      const gen = new NativeOpenApiGeneratorV3(registry.definitions);
      const doc = gen.generateDocument(baseConfig);
      const paths = doc.paths as Record<string, Record<string, unknown>>;
      const op = paths['/users'].get as Record<string, unknown>;
      const responses = op.responses as Record<string, Record<string, unknown>>;

      expect(responses['200'].description).toBe('Success');
      const content = responses['200'].content as Record<string, Record<string, unknown>>;
      const schema = content['application/json'].schema as Record<string, unknown>;
      expect(schema.type).toBe('object');

      expect(responses['404'].description).toBe('Not found');
      expect(responses['404'].content).toBeUndefined();
    });

    it('generates response headers', () => {
      const registry = new NativeOpenAPIRegistry();
      registry.registerPath({
        method: 'get',
        path: '/data',
        responses: {
          200: {
            description: 'OK',
            headers: {
              'x-request-id': { schema: z.string() },
              'x-rate-limit': { schema: z.number().int() },
            },
          },
        },
      });

      const gen = new NativeOpenApiGeneratorV3(registry.definitions);
      const doc = gen.generateDocument(baseConfig);
      const paths = doc.paths as Record<string, Record<string, unknown>>;
      const op = paths['/data'].get as Record<string, unknown>;
      const responses = op.responses as Record<string, Record<string, unknown>>;
      const headers = responses['200'].headers as Record<string, Record<string, unknown>>;

      expect(headers['x-request-id'].schema).toEqual({ type: 'string' });
      expect(headers['x-rate-limit'].schema).toEqual({ type: 'integer' });
    });
  });

  describe('components', () => {
    it('registers named schemas', () => {
      const registry = new NativeOpenAPIRegistry();
      registry.register('User', z.object({ id: z.string(), name: z.string() }));

      const gen = new NativeOpenApiGeneratorV3(registry.definitions);
      const doc = gen.generateDocument(baseConfig);
      const components = doc.components as Record<string, Record<string, unknown>>;

      expect(components.schemas).toBeDefined();
      const userSchema = components.schemas.User as Record<string, unknown>;
      expect(userSchema.type).toBe('object');
      expect(userSchema.required).toEqual(['id', 'name']);
    });

    it('registers security schemes', () => {
      const registry = new NativeOpenAPIRegistry();
      registry.registerComponent('securitySchemes', 'BearerAuth', {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
      });

      const gen = new NativeOpenApiGeneratorV3(registry.definitions);
      const doc = gen.generateDocument(baseConfig);
      const components = doc.components as Record<string, Record<string, unknown>>;

      expect(components.securitySchemes).toBeDefined();
      expect(components.securitySchemes.BearerAuth).toEqual({
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
      });
    });

    it('registers reusable parameters', () => {
      const registry = new NativeOpenAPIRegistry();
      registry.registerParameter(
        'PageParam',
        z
          .number()
          .int()
          .min(1)
          .openapi({
            param: { in: 'query', name: 'page', description: 'Page number' },
          }),
      );

      const gen = new NativeOpenApiGeneratorV3(registry.definitions);
      const doc = gen.generateDocument(baseConfig);
      const components = doc.components as Record<string, Record<string, unknown>>;

      expect(components.parameters).toBeDefined();
      const param = components.parameters.PageParam as Record<string, unknown>;
      expect(param.name).toBe('page');
      expect(param.in).toBe('query');
      expect(param.description).toBe('Page number');
    });

    it('does not include components when none registered', () => {
      const registry = new NativeOpenAPIRegistry();
      registry.registerPath({
        method: 'get',
        path: '/health',
        responses: { 200: { description: 'OK' } },
      });

      const gen = new NativeOpenApiGeneratorV3(registry.definitions);
      const doc = gen.generateDocument(baseConfig);

      expect(doc.components).toBeUndefined();
    });
  });

  describe('$ref handling', () => {
    it('schemas with refId produce $ref in routes', () => {
      const UserSchema = z.object({ id: z.string(), name: z.string() }).openapi({ refId: 'User' });

      const registry = new NativeOpenAPIRegistry();
      registry.register('User', UserSchema);
      registry.registerPath({
        method: 'get',
        path: '/users/{id}',
        request: { params: z.object({ id: z.string() }) },
        responses: {
          200: {
            description: 'OK',
            content: { 'application/json': { schema: UserSchema } },
          },
        },
      });

      const gen = new NativeOpenApiGeneratorV3(registry.definitions);
      const doc = gen.generateDocument(baseConfig);
      const paths = doc.paths as Record<string, Record<string, unknown>>;
      const op = paths['/users/{id}'].get as Record<string, unknown>;
      const responses = op.responses as Record<string, Record<string, unknown>>;
      const content = responses['200'].content as Record<string, Record<string, unknown>>;
      const schema = content['application/json'].schema as Record<string, unknown>;

      expect(schema.$ref).toBe('#/components/schemas/User');
    });
  });

  it('V3 ignores webhook definitions', () => {
    const registry = new NativeOpenAPIRegistry();
    registry.registerWebhook({
      method: 'post',
      path: '/webhooks/order',
      responses: { 200: { description: 'Received' } },
    });

    const gen = new NativeOpenApiGeneratorV3(registry.definitions);
    const doc = gen.generateDocument(baseConfig);

    expect(doc.webhooks).toBeUndefined();
    expect(doc.paths).toEqual({});
  });
});

// =============================================================================
// Document Generator  -  V31
// =============================================================================

describe('NativeOpenApiGeneratorV31', () => {
  const baseConfig = {
    openapi: '3.1.0',
    info: { title: 'Test API', version: '1.0.0' },
  };

  it('generates basic 3.1 document', () => {
    const registry = new NativeOpenAPIRegistry();
    registry.registerPath({
      method: 'get',
      path: '/health',
      responses: { 200: { description: 'OK' } },
    });

    const gen = new NativeOpenApiGeneratorV31(registry.definitions);
    const doc = gen.generateDocument(baseConfig);

    expect(doc.openapi).toBe('3.1.0');
    const paths = doc.paths as Record<string, Record<string, unknown>>;
    expect(paths['/health'].get).toBeDefined();
  });

  it('includes top-level webhooks', () => {
    const registry = new NativeOpenAPIRegistry();
    registry.registerWebhook({
      method: 'post',
      path: '/webhooks/order.created',
      description: 'Order created event',
      request: {
        body: {
          content: {
            'application/json': {
              schema: z.object({ orderId: z.string(), amount: z.number() }),
            },
          },
        },
      },
      responses: { 200: { description: 'Acknowledged' } },
    });

    const gen = new NativeOpenApiGeneratorV31(registry.definitions);
    const doc = gen.generateDocument(baseConfig);
    const webhooks = doc.webhooks as Record<string, Record<string, unknown>>;

    expect(webhooks).toBeDefined();
    expect(webhooks['/webhooks/order.created']).toBeDefined();

    const op = webhooks['/webhooks/order.created'].post as Record<string, unknown>;
    expect(op.description).toBe('Order created event');
    expect(op.requestBody).toBeDefined();

    const responses = op.responses as Record<string, Record<string, unknown>>;
    expect(responses['200'].description).toBe('Acknowledged');
  });

  it('does not include webhooks key when none registered', () => {
    const registry = new NativeOpenAPIRegistry();
    registry.registerPath({
      method: 'get',
      path: '/test',
      responses: { 200: { description: 'OK' } },
    });

    const gen = new NativeOpenApiGeneratorV31(registry.definitions);
    const doc = gen.generateDocument(baseConfig);

    expect(doc.webhooks).toBeUndefined();
  });
});
