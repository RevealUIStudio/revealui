import { describe, expect, it } from 'vitest';
import { assertOpenApi30Compatible } from './openapi-30-compat.js';

describe('assertOpenApi30Compatible', () => {
  it('accepts OAS 3.0 schemas and const fields in example payloads', () => {
    expect(() =>
      assertOpenApi30Compatible({
        openapi: '3.0.3',
        paths: {
          '/example': {
            get: {
              responses: {
                '200': {
                  content: {
                    'application/json': {
                      schema: { type: 'object', properties: { id: { type: 'string' } } },
                      example: { const: 'application-data' },
                    },
                  },
                },
              },
            },
          },
        },
      }),
    ).not.toThrow();

    expect(() =>
      assertOpenApi30Compatible({
        components: {
          schemas: {
            Example: { properties: { const: { type: 'string' } } },
          },
        },
      }),
    ).not.toThrow();

    expect(() =>
      assertOpenApi30Compatible({
        components: {
          schemas: {
            enum: { type: 'string' },
            Example: { properties: { default: { type: 'string' } } },
          },
        },
      }),
    ).not.toThrow();
  });

  it.each([
    ['const', { const: 'v1' }],
    ['null type', { type: 'null' }],
    ['union type', { type: ['string', 'null'] }],
    ['tuple items', { type: 'array', items: [{ type: 'string' }] }],
    ['contains', { type: 'array', contains: { type: 'string' } }],
    ['prefixItems', { type: 'array', prefixItems: [{ type: 'string' }] }],
    ['$schema', { $schema: 'https://json-schema.org/draft/2020-12/schema' }],
  ])('rejects unsupported schema feature: %s', (_name, schema) => {
    expect(() =>
      assertOpenApi30Compatible({
        openapi: '3.0.3',
        components: { schemas: { Example: schema } },
      }),
    ).toThrow('OpenAPI 3.0');
  });

  it('rejects unsupported features in nested property schemas', () => {
    expect(() =>
      assertOpenApi30Compatible({
        components: { schemas: { Example: { properties: { id: { const: 'v1' } } } } },
      }),
    ).toThrow('const');

    expect(() =>
      assertOpenApi30Compatible({
        components: {
          schemas: {
            Example: { properties: { default: { const: 'v1' } } },
          },
        },
      }),
    ).toThrow('const');

    expect(() =>
      assertOpenApi30Compatible({
        components: { schemas: { enum: { const: 'v1' } } },
      }),
    ).toThrow('const');
  });

  it('does not interpret schema-like keys inside example values as schemas', () => {
    expect(() =>
      assertOpenApi30Compatible({
        components: {
          schemas: {
            Example: {
              type: 'object',
              example: { schema: { const: 'payload' }, const: 'payload' },
            },
          },
        },
      }),
    ).not.toThrow();
  });
});
