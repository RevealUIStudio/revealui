import { describe, expect, it } from 'vitest';
import { buildWhereClause, extractWhereValues } from '../queryBuilder.js';

// ---------------------------------------------------------------------------
// Tests  -  buildWhereClause
// ---------------------------------------------------------------------------
describe('buildWhereClause', () => {
  describe('basic field conditions', () => {
    it('returns empty string for undefined where', () => {
      const params: unknown[] = [];
      expect(buildWhereClause(undefined, params)).toBe('');
      expect(params).toEqual([]);
    });

    it('returns empty string for empty where object', () => {
      const params: unknown[] = [];
      expect(buildWhereClause({}, params)).toBe('');
    });

    it('builds equals condition from plain value', () => {
      const params: unknown[] = [];
      const clause = buildWhereClause({ status: 'published' }, params);

      expect(clause).toBe('"status" = $1');
      expect(params).toEqual(['published']);
    });

    it('builds multiple field conditions with AND', () => {
      const params: unknown[] = [];
      const clause = buildWhereClause({ status: 'published', role: 'admin' }, params);

      expect(clause).toContain('"status" = $1');
      expect(clause).toContain('"role" = $2');
      expect(clause).toContain(' AND ');
      expect(params).toEqual(['published', 'admin']);
    });

    it('skips null and undefined values', () => {
      const params: unknown[] = [];
      const clause = buildWhereClause(
        { status: 'active', deleted: null, missing: undefined },
        params,
      );

      expect(clause).toBe('"status" = $1');
      expect(params).toEqual(['active']);
    });
  });

  describe('operator conditions', () => {
    it('builds equals operator', () => {
      const params: unknown[] = [];
      const clause = buildWhereClause({ title: { equals: 'Hello' } }, params);

      expect(clause).toBe('"title" = $1');
      expect(params).toEqual(['Hello']);
    });

    it('builds not_equals operator', () => {
      const params: unknown[] = [];
      const clause = buildWhereClause({ status: { not_equals: 'deleted' } }, params);

      expect(clause).toBe('"status" != $1');
      expect(params).toEqual(['deleted']);
    });

    it('builds greater_than operator', () => {
      const params: unknown[] = [];
      const clause = buildWhereClause({ age: { greater_than: 18 } }, params);

      expect(clause).toBe('"age" > $1');
      expect(params).toEqual([18]);
    });

    it('builds less_than operator', () => {
      const params: unknown[] = [];
      const clause = buildWhereClause({ price: { less_than: 100 } }, params);

      expect(clause).toBe('"price" < $1');
      expect(params).toEqual([100]);
    });

    it('builds IN operator', () => {
      const params: unknown[] = [];
      const clause = buildWhereClause({ status: { in: ['active', 'pending'] } }, params);

      expect(clause).toBe('"status" IN ($1, $2)');
      expect(params).toEqual(['active', 'pending']);
    });

    it('builds empty IN as always-false', () => {
      const params: unknown[] = [];
      const clause = buildWhereClause({ status: { in: [] } }, params);

      expect(clause).toBe('1=0');
      expect(params).toEqual([]);
    });

    it('builds NOT IN operator', () => {
      const params: unknown[] = [];
      const clause = buildWhereClause({ status: { not_in: ['deleted', 'banned'] } }, params);

      expect(clause).toBe('"status" NOT IN ($1, $2)');
      expect(params).toEqual(['deleted', 'banned']);
    });

    it('builds contains operator with wildcard escaping', () => {
      const params: unknown[] = [];
      const clause = buildWhereClause({ title: { contains: 'test' } }, params);

      expect(clause).toBe('"title" LIKE $1 ESCAPE \'\\\'');
      expect(params).toEqual(['%test%']);
    });

    it('escapes LIKE wildcards in contains values', () => {
      const params: unknown[] = [];
      buildWhereClause({ title: { contains: '50% off_sale' } }, params);

      expect(params[0]).toBe('%50\\% off\\_sale%');
    });

    it('builds like operator (raw pattern)', () => {
      const params: unknown[] = [];
      const clause = buildWhereClause({ title: { like: '%test%' } }, params);

      expect(clause).toBe(`"title" LIKE $1 ESCAPE '\\'`);
      expect(params).toEqual(['\\%test\\%']);
    });

    it('builds exists: true as IS NOT NULL', () => {
      const params: unknown[] = [];
      const clause = buildWhereClause({ avatar: { exists: true } }, params);

      expect(clause).toBe('"avatar" IS NOT NULL');
      expect(params).toEqual([]);
    });

    it('builds exists: false as IS NULL', () => {
      const params: unknown[] = [];
      const clause = buildWhereClause({ avatar: { exists: false } }, params);

      expect(clause).toBe('"avatar" IS NULL');
    });

    it('throws on invalid operators', () => {
      const params: unknown[] = [];
      expect(() => buildWhereClause({ status: { invalid_op: 'test' } }, params)).toThrow(
        'Invalid query operators',
      );
    });
  });

  describe('AND/OR groups', () => {
    it('builds AND group', () => {
      const params: unknown[] = [];
      const clause = buildWhereClause({ and: [{ status: 'active' }, { role: 'admin' }] }, params);

      expect(clause).toContain('"status" = $1');
      expect(clause).toContain('"role" = $2');
      expect(clause).toContain(' AND ');
      expect(params).toEqual(['active', 'admin']);
    });

    it('builds OR group with parentheses', () => {
      const params: unknown[] = [];
      const clause = buildWhereClause(
        { or: [{ status: 'active' }, { status: 'pending' }] },
        params,
      );

      expect(clause).toMatch(/^\(.*\)$/);
      expect(clause).toContain(' OR ');
    });

    it('returns empty for empty AND array', () => {
      const params: unknown[] = [];
      expect(buildWhereClause({ and: [] }, params)).toBe('');
    });

    it('returns empty for empty OR array', () => {
      const params: unknown[] = [];
      expect(buildWhereClause({ or: [] }, params)).toBe('');
    });
  });

  describe('options', () => {
    it('uses positional parameters when parameterStyle is positional', () => {
      const params: unknown[] = [];
      const clause = buildWhereClause({ name: 'test', age: 25 }, params, {
        parameterStyle: 'positional',
      });

      expect(clause).toContain('= ?');
      expect(clause).not.toContain('$');
    });

    it('includes WHERE keyword when includeWhereKeyword is true', () => {
      const params: unknown[] = [];
      const clause = buildWhereClause({ status: 'active' }, params, {
        includeWhereKeyword: true,
      });

      expect(clause).toMatch(/^WHERE /);
    });

    it('does not include WHERE keyword by default', () => {
      const params: unknown[] = [];
      const clause = buildWhereClause({ status: 'active' }, params);

      expect(clause).not.toMatch(/^WHERE/);
    });

    it('quotes field names by default', () => {
      const params: unknown[] = [];
      const clause = buildWhereClause({ name: 'test' }, params);

      expect(clause).toContain('"name"');
    });

    it('skips quoting when quoteFields is false', () => {
      const params: unknown[] = [];
      const clause = buildWhereClause({ name: 'test' }, params, {
        quoteFields: false,
      });

      expect(clause).toBe('name = $1');
    });
  });

  describe('parameter indexing', () => {
    it('produces correct postgres placeholders for multiple params', () => {
      const params: unknown[] = [];
      const clause = buildWhereClause({ status: { in: ['a', 'b', 'c'] } }, params);

      expect(clause).toBe('"status" IN ($1, $2, $3)');
      expect(params).toEqual(['a', 'b', 'c']);
    });

    it('continues indexing from existing params', () => {
      const params: unknown[] = ['existing'];
      const clause = buildWhereClause({ status: 'active' }, params);

      expect(clause).toBe('"status" = $2');
      expect(params).toEqual(['existing', 'active']);
    });
  });
});

// ---------------------------------------------------------------------------
// Tests  -  extractWhereValues
// ---------------------------------------------------------------------------
describe('extractWhereValues', () => {
  it('returns empty array for undefined', () => {
    expect(extractWhereValues(undefined)).toEqual([]);
  });

  it('extracts plain values', () => {
    const values = extractWhereValues({ status: 'active' });
    expect(values).toEqual(['active']);
  });

  it('extracts operator values', () => {
    const values = extractWhereValues({ age: { greater_than: 18, less_than: 65 } });
    expect(values).toContain(18);
    expect(values).toContain(65);
  });

  it('extracts IN array values', () => {
    const values = extractWhereValues({ status: { in: ['a', 'b', 'c'] } });
    expect(values).toEqual(['a', 'b', 'c']);
  });

  it('wraps contains values with wildcards', () => {
    const values = extractWhereValues({ title: { contains: 'hello' } });
    expect(values).toEqual(['%hello%']);
  });

  it('extracts from nested AND conditions', () => {
    const values = extractWhereValues({
      and: [{ status: 'active' }, { role: 'admin' }],
    });
    expect(values).toContain('active');
    expect(values).toContain('admin');
  });

  it('extracts from nested OR conditions', () => {
    const values = extractWhereValues({
      or: [{ status: 'active' }, { status: 'pending' }],
    });
    expect(values).toContain('active');
    expect(values).toContain('pending');
  });

  it('skips exists operator (no value needed)', () => {
    const values = extractWhereValues({ avatar: { exists: true } });
    expect(values).toEqual([]);
  });
});
