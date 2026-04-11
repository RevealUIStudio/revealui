import { describe, expect, it, vi } from 'vitest';

vi.mock('../../instance/logger.js', () => ({
  defaultLogger: { warn: vi.fn(), error: vi.fn(), info: vi.fn(), debug: vi.fn() },
}));

import {
  collectJsonFields,
  deserializeJsonFields,
  parseJsonField,
  serializeValueForDatabase,
} from '../json-parsing.js';

// ---------------------------------------------------------------------------
// Tests  -  parseJsonField
// ---------------------------------------------------------------------------
describe('parseJsonField', () => {
  it('returns null as-is', () => {
    expect(parseJsonField(null)).toBeNull();
  });

  it('returns undefined as-is', () => {
    expect(parseJsonField(undefined)).toBeUndefined();
  });

  it('parses JSON object string', () => {
    expect(parseJsonField('{"a":1}')).toEqual({ a: 1 });
  });

  it('parses JSON array string', () => {
    expect(parseJsonField('[1,2,3]')).toEqual([1, 2, 3]);
  });

  it('returns non-JSON string as-is', () => {
    expect(parseJsonField('hello world')).toBe('hello world');
  });

  it('returns invalid JSON string as-is', () => {
    expect(parseJsonField('{invalid json}')).toBe('{invalid json}');
  });

  it('returns numbers as-is', () => {
    expect(parseJsonField(42)).toBe(42);
  });

  it('returns objects as-is', () => {
    const obj = { a: 1 };
    expect(parseJsonField(obj)).toBe(obj);
  });
});

// ---------------------------------------------------------------------------
// Tests  -  deserializeJsonFields
// ---------------------------------------------------------------------------
describe('deserializeJsonFields', () => {
  it('ensures id field exists', () => {
    const result = deserializeJsonFields({ name: 'test' });
    expect(result.id).toBe('');
  });

  it('preserves string id', () => {
    const result = deserializeJsonFields({ id: 'abc' });
    expect(result.id).toBe('abc');
  });

  it('preserves numeric id', () => {
    const result = deserializeJsonFields({ id: 42 });
    expect(result.id).toBe(42);
  });

  it('merges _json object into document', () => {
    const result = deserializeJsonFields({
      id: '1',
      _json: { extra: 'data', tags: ['a', 'b'] },
    });
    expect(result.extra).toBe('data');
    expect(result.tags).toEqual(['a', 'b']);
  });

  it('merges _json string into document', () => {
    const result = deserializeJsonFields({
      id: '1',
      _json: '{"extra":"data"}',
    });
    expect(result.extra).toBe('data');
  });

  it('removes _json from result', () => {
    const result = deserializeJsonFields({ id: '1', _json: '{}' });
    expect(result).not.toHaveProperty('_json');
  });

  it('handles invalid _json string gracefully', () => {
    const result = deserializeJsonFields({ id: '1', _json: 'not-json' });
    expect(result.id).toBe('1');
    // Should not throw, _json is removed
    expect(result).not.toHaveProperty('_json');
  });

  it('deserializes JSON string values in other fields', () => {
    const result = deserializeJsonFields({
      id: '1',
      meta: '{"key":"value"}',
    });
    expect(result.meta).toEqual({ key: 'value' });
  });

  it('preserves non-JSON string values', () => {
    const result = deserializeJsonFields({
      id: '1',
      title: 'Hello World',
    });
    expect(result.title).toBe('Hello World');
  });

  it('preserves null values', () => {
    const result = deserializeJsonFields({ id: '1', field: null });
    expect(result.field).toBeNull();
  });

  it('preserves boolean id from spread (edge case)', () => {
    // The spread `...doc` overwrites the computed id, so boolean survives
    // biome-ignore lint/suspicious/noExplicitAny: test edge case
    const result = deserializeJsonFields({ id: true as any });
    expect(result.id).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Tests  -  collectJsonFields
// ---------------------------------------------------------------------------
describe('collectJsonFields', () => {
  it('collects specified fields', () => {
    const result = collectJsonFields(
      { title: 'Test', meta: { key: 'value' }, status: 'active' },
      new Set(['meta']),
    );
    expect(result).toEqual({ meta: { key: 'value' } });
  });

  it('skips undefined fields', () => {
    const result = collectJsonFields({ title: 'Test' }, new Set(['meta']));
    expect(result).toEqual({});
  });

  it('collects multiple fields', () => {
    const result = collectJsonFields({ a: 1, b: 2, c: 3 }, new Set(['a', 'c']));
    expect(result).toEqual({ a: 1, c: 3 });
  });

  it('returns empty object for empty set', () => {
    const result = collectJsonFields({ a: 1 }, new Set());
    expect(result).toEqual({});
  });
});

// ---------------------------------------------------------------------------
// Tests  -  serializeValueForDatabase
// ---------------------------------------------------------------------------
describe('serializeValueForDatabase', () => {
  it('serializes objects to JSON', () => {
    expect(serializeValueForDatabase({ a: 1 })).toBe('{"a":1}');
  });

  it('serializes arrays to JSON', () => {
    expect(serializeValueForDatabase([1, 2])).toBe('[1,2]');
  });

  it('returns strings as-is', () => {
    expect(serializeValueForDatabase('hello')).toBe('hello');
  });

  it('returns numbers as-is', () => {
    expect(serializeValueForDatabase(42)).toBe(42);
  });

  it('returns null as-is', () => {
    expect(serializeValueForDatabase(null)).toBeNull();
  });

  it('returns undefined as-is', () => {
    expect(serializeValueForDatabase(undefined)).toBeUndefined();
  });

  it('returns booleans as-is', () => {
    expect(serializeValueForDatabase(true)).toBe(true);
  });
});
