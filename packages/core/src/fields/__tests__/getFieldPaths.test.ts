import { describe, expect, it } from 'vitest';
import { getFieldPaths, getFieldPathsModified } from '../getFieldPaths.js';

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------
describe('getFieldPaths', () => {
  it('returns field name as path for top-level field', () => {
    const result = getFieldPaths({
      field: { name: 'title', type: 'text' } as never,
    });
    expect(result.path).toBe('title');
    expect(result.schemaPath).toBe('title');
  });

  it('uses explicit path when provided', () => {
    const result = getFieldPaths({
      field: { name: 'title', type: 'text' } as never,
      path: 'custom.path',
    });
    expect(result.path).toBe('custom.path');
  });

  it('joins parent path with field name', () => {
    const result = getFieldPaths({
      field: { name: 'city', type: 'text' } as never,
      parentPath: 'address',
    });
    expect(result.path).toBe('address.city');
  });

  it('uses field name when parent path is empty', () => {
    const result = getFieldPaths({
      field: { name: 'name', type: 'text' } as never,
      parentPath: '',
    });
    expect(result.path).toBe('name');
  });

  it('handles fields without a name', () => {
    const result = getFieldPaths({
      field: { type: 'row' } as never,
    });
    expect(result.path).toBe('');
  });

  it('handles deeply nested parent path', () => {
    const result = getFieldPaths({
      field: { name: 'zip', type: 'text' } as never,
      parentPath: 'billing.address',
    });
    expect(result.path).toBe('billing.address.zip');
  });

  it('explicit path overrides parent path concatenation', () => {
    const result = getFieldPaths({
      field: { name: 'field', type: 'text' } as never,
      path: 'override',
      parentPath: 'should.not.use',
    });
    expect(result.path).toBe('override');
  });

  it('schemaPath matches path', () => {
    const result = getFieldPaths({
      field: { name: 'email', type: 'email' } as never,
      parentPath: 'user',
    });
    expect(result.schemaPath).toBe(result.path);
  });
});

describe('getFieldPathsModified', () => {
  it('delegates to getFieldPaths', () => {
    const result = getFieldPathsModified({
      field: { name: 'title', type: 'text' } as never,
      parentPath: 'doc',
    });
    expect(result.path).toBe('doc.title');
    expect(result.schemaPath).toBe('doc.title');
  });
});
