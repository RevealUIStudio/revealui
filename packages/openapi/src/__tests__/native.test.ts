/**
 * Native OpenAPI Implementation Tests
 *
 * Tests for the zero-dependency Zod → OpenAPI pipeline:
 * - Zod extension (.openapi() metadata)
 * - Registry (route/schema collection)
 * - Zod → JSON Schema converter
 */

import { describe, expect, it } from 'vitest';
import { z } from 'zod';
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
