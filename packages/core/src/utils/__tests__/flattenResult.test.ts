import { describe, expect, it } from 'vitest';
import { flattenResult } from '../flattenResult.js';

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------
describe('flattenResult', () => {
  it('returns flat objects unchanged', () => {
    const doc = { id: '1', title: 'Hello', status: 'published' };
    const result = flattenResult(doc as never);

    expect(result).toEqual({ id: '1', title: 'Hello', status: 'published' });
  });

  it('converts dotted keys into nested objects', () => {
    const doc = {
      id: '1',
      'author.name': 'John',
      'author.id': 'user-1',
    };
    const result = flattenResult(doc as never);

    expect(result).toEqual({
      id: '1',
      author: { name: 'John', id: 'user-1' },
    });
  });

  it('removes original dotted keys', () => {
    const doc = { 'author.name': 'John' };
    const result = flattenResult(doc as never);

    expect(result).not.toHaveProperty(['author.name']);
    expect(result).toHaveProperty('author');
  });

  it('handles multiple nested groups', () => {
    const doc = {
      id: '1',
      'author.name': 'John',
      'category.title': 'Tech',
    };
    const result = flattenResult(doc as never);

    expect(result).toEqual({
      id: '1',
      author: { name: 'John' },
      category: { title: 'Tech' },
    });
  });

  it('merges multiple properties into the same parent', () => {
    const doc = {
      'meta.title': 'Hello',
      'meta.description': 'World',
    };
    const result = flattenResult(doc as never);

    expect(result).toEqual({
      meta: { title: 'Hello', description: 'World' },
    });
  });

  it('only uses first two segments from dotted key', () => {
    const doc = { 'a.b.c': 'deep' };
    const result = flattenResult(doc as never);

    // split('.', 2) produces ['a', 'b']  -  the '.c' part is discarded
    expect(result).toEqual({ a: { b: 'deep' } });
  });

  it('handles empty object', () => {
    const result = flattenResult({} as never);
    expect(result).toEqual({});
  });

  it('preserves non-dotted keys alongside dotted keys', () => {
    const doc = { id: '1', title: 'Test', 'author.name': 'John' };
    const result = flattenResult(doc as never);

    expect(result.id).toBe('1');
    expect(result.title).toBe('Test');
    expect((result as Record<string, unknown>).author).toEqual({ name: 'John' });
  });
});
