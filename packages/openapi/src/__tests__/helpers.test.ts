import { describe, expect, it } from 'vitest';
import { $, addBasePathToDocument } from '../helpers.js';

describe('addBasePathToDocument', () => {
  const makeDoc = (paths: Record<string, unknown>): Record<string, unknown> => ({
    openapi: '3.0.0',
    info: { title: 'Test', version: '1.0.0' },
    paths,
  });

  it('prepends base path to all document paths', () => {
    const doc = makeDoc({
      '/users': { get: {} },
      '/posts': { get: {} },
    });

    const result = addBasePathToDocument(doc, '/api/v1');

    expect(Object.keys(result.paths)).toEqual(['/api/v1/users', '/api/v1/posts']);
  });

  it('converts Hono :param syntax to OpenAPI {param} in base path', () => {
    const doc = makeDoc({
      '/members': { get: {} },
    });

    const result = addBasePathToDocument(doc, '/orgs/:orgId');

    expect(Object.keys(result.paths)).toEqual(['/orgs/{orgId}/members']);
  });

  it('preserves all other document properties', () => {
    const doc = makeDoc({ '/test': { get: {} } });

    const result = addBasePathToDocument(doc, '/api');

    expect(result.openapi).toBe('3.0.0');
    expect(result.info).toEqual({ title: 'Test', version: '1.0.0' });
  });

  it('handles empty paths object', () => {
    const doc = makeDoc({});

    const result = addBasePathToDocument(doc, '/api');

    expect(result.paths).toEqual({});
  });
});

describe('$', () => {
  it('returns the same object (identity function)', () => {
    const obj = { test: true };

    expect($(obj)).toBe(obj);
  });
});
