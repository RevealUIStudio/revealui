import { describe, expect, it } from 'vitest';

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
  it('requires an id instead of fabricating one', () => {
    expect(() => deserializeJsonFields({ name: 'test' })).toThrow('Invalid document id');
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

  it('refuses invalid required _json instead of returning partial data', () => {
    expect(() => deserializeJsonFields({ id: '1', _json: 'not-json' })).toThrow('Invalid _json');
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

  it('rejects a boolean id at the database boundary', () => {
    expect(() => deserializeJsonFields({ id: true })).toThrow('Invalid document id');
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

describe('document decoding validation', () => {
  it.each([undefined, null, '', true, 1n, {}, [], Number.NaN, Number.POSITIVE_INFINITY])(
    'rejects invalid source identity %s',
    (id) => {
      expect(() => deserializeJsonFields({ id })).toThrow();
    },
  );

  it.each(['[123]', '{"id":"nested"}'])('preserves the raw string identity %s', (id) => {
    expect(deserializeJsonFields({ id }).id).toBe(id);
  });

  it.each([{ id: 'replacement' }, '{"id":"replacement"}'])(
    'rejects extension identity collisions',
    (_json) => {
      expect(() => deserializeJsonFields({ id: 'stored', _json })).toThrow();
    },
  );

  it.each(['{broken', '[]', 'true', '0', '"text"', 'null', [], true, 0])(
    'rejects malformed required extension data %j',
    (_json) => {
      expect(() => deserializeJsonFields({ id: 'stored', _json })).toThrow();
    },
  );

  it.each([
    '{"__proto__":{"admin":true}}',
    '{"constructor":{"admin":true}}',
    '{"prototype":{}}',
    '{"_json":{}}',
  ])('rejects reserved extension fields %s', (_json) => {
    expect(() => deserializeJsonFields({ id: 'stored', _json })).toThrow();
  });

  it('preserves supported legacy content, dates, absent extension data, and input objects', () => {
    const createdAt = new Date('2026-01-01T00:00:00Z');
    const doc = {
      id: 'stored',
      createdAt,
      optional: undefined,
      title: '{literal',
      meta: '[1,2]',
      _json: { tags: ['one'] },
    };
    expect(deserializeJsonFields(doc)).toEqual({
      id: 'stored',
      createdAt,
      optional: undefined,
      title: '{literal',
      meta: [1, 2],
      tags: ['one'],
    });
    expect(doc._json).toEqual({ tags: ['one'] });
    expect(doc.meta).toBe('[1,2]');
    expect(deserializeJsonFields({ id: 'stored', _json: null })).toEqual({ id: 'stored' });
  });
});

it.each(['{"nested":{"__proto__":{"admin":true}}}', '{"nested":{"constructor":{}}}'])(
  'rejects nested reserved keys without silently dropping data',
  (_json) => {
    expect(() => deserializeJsonFields({ id: 'stored', _json })).toThrow();
  },
);

it('preserves extension precedence for ordinary fields', () => {
  expect(
    deserializeJsonFields({
      id: 0,
      title: 'column',
      _json: { title: 'extension', nested: { values: [1, true, null] } },
    }),
  ).toEqual({
    id: 0,
    title: 'extension',
    nested: { values: [1, true, null] },
  });
});

it('rejects unsupported decoded values before returning data', () => {
  expect(() => deserializeJsonFields({ id: 'stored', _json: { callback: () => true } })).toThrow();
  expect(() => deserializeJsonFields({ id: 'stored', field: new Map() })).toThrow();
  expect(() => deserializeJsonFields({ id: 'stored', field: '{"value":1e999}' })).toThrow();
});

it('identifies corrupt internal JSON without echoing its contents', () => {
  expect(() =>
    deserializeJsonFields({ id: 'stored', _json: '{"secret":"private' }, 'documents'),
  ).toThrow('Invalid _json JSON in documents');
});
