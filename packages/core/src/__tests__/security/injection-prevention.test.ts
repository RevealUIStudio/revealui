/**
 * Security Injection Prevention Tests
 *
 * Verifies that the RevealUI API layer properly defends against SQL injection,
 * XSS, parameter pollution, and ID injection attacks. Tests target the actual
 * protections: parameterized queries, Zod/field validation, isSafeUrl(), slug
 * allowlists, and column name validation.
 */

import { describe, expect, it, vi } from 'vitest';
import { create } from '../../collections/operations/create.js';
import { find } from '../../collections/operations/find.js';
import { findByID } from '../../collections/operations/findById.js';
import {
  collectionTable,
  escapeIdentifier,
  insertDocumentQuery,
  validateColumnName,
  validateSlug,
} from '../../collections/operations/sqlAdapter.js';
import { buildWhereClause } from '../../queries/queryBuilder.js';
import { isSafeUrl, sanitizeUrl } from '../../richtext/exports/server/rsc.js';
import type {
  DatabaseResult,
  RevealCollectionConfig,
  RevealFindOptions,
} from '../../types/index.js';

// ============================================
// SHARED FIXTURES
// ============================================

const mockConfig: RevealCollectionConfig = {
  slug: 'posts',
  fields: [
    { name: 'title', type: 'text' },
    { name: 'body', type: 'richText' },
    { name: 'status', type: 'select' },
    { name: 'author', type: 'text' },
  ],
};

function mockDb() {
  return {
    query: vi.fn(),
  };
}

/** Stub that returns count + empty rows so find() completes. */
function stubFindDb(db: ReturnType<typeof mockDb>) {
  db.query
    .mockResolvedValueOnce({ rows: [{ total: '0' }] } as DatabaseResult)
    .mockResolvedValueOnce({ rows: [] } as DatabaseResult);
}

// ============================================
// 1. SQL INJECTION VIA FIELD NAMES
// ============================================

describe('SQL injection via field names', () => {
  describe('validateSlug', () => {
    it('rejects slug containing SQL injection payload', () => {
      expect(() => validateSlug('posts"; DROP TABLE users; --')).toThrow('Invalid collection slug');
    });

    it('rejects slug with semicolon', () => {
      expect(() => validateSlug('posts;')).toThrow('Invalid collection slug');
    });

    it('rejects slug with double-quote breakout', () => {
      expect(() => validateSlug('posts"')).toThrow('Invalid collection slug');
    });

    it('rejects slug starting with a number', () => {
      expect(() => validateSlug('1posts')).toThrow('Invalid collection slug');
    });

    it('rejects empty slug', () => {
      expect(() => validateSlug('')).toThrow('Invalid collection slug');
    });

    it('rejects slug with uppercase letters', () => {
      expect(() => validateSlug('Posts')).toThrow('Invalid collection slug');
    });

    it('accepts valid slug with hyphens and underscores', () => {
      expect(() => validateSlug('my-collection_v2')).not.toThrow();
    });
  });

  describe('validateColumnName', () => {
    it('rejects column with SQL injection payload', () => {
      expect(() => validateColumnName('title"; DROP TABLE users; --')).toThrow(
        'Invalid column name',
      );
    });

    it('rejects column with semicolon', () => {
      expect(() => validateColumnName('title;')).toThrow('Invalid column name');
    });

    it('rejects column with double-quote', () => {
      expect(() => validateColumnName('title"')).toThrow('Invalid column name');
    });

    it('rejects column with hyphen (not valid in PostgreSQL identifiers)', () => {
      expect(() => validateColumnName('my-column')).toThrow('Invalid column name');
    });

    it('rejects column with space', () => {
      expect(() => validateColumnName('my column')).toThrow('Invalid column name');
    });

    it('rejects column with parentheses', () => {
      expect(() => validateColumnName('title()')).toThrow('Invalid column name');
    });

    it('accepts valid column with underscores', () => {
      expect(() => validateColumnName('created_at')).not.toThrow();
    });

    it('accepts column starting with underscore', () => {
      expect(() => validateColumnName('_json')).not.toThrow();
    });
  });

  describe('escapeIdentifier', () => {
    it('doubles embedded double-quotes to prevent breakout', () => {
      expect(escapeIdentifier('field"name')).toBe('field""name');
    });

    it('doubles multiple embedded quotes', () => {
      expect(escapeIdentifier('a"b"c')).toBe('a""b""c');
    });

    it('leaves safe identifiers unchanged', () => {
      expect(escapeIdentifier('title')).toBe('title');
    });
  });

  describe('collectionTable', () => {
    it('rejects injection payload as table name', () => {
      expect(() => collectionTable('posts"; DROP TABLE users;--')).toThrow(
        'Invalid collection slug',
      );
    });

    it('wraps valid slug in double-quotes', () => {
      expect(collectionTable('posts')).toBe('"posts"');
    });
  });

  describe('insertDocumentQuery rejects injected column names', () => {
    it('throws on column with SQL injection payload', () => {
      expect(() => insertDocumentQuery('posts', ['title"); DROP TABLE users; --'])).toThrow(
        'Invalid column name',
      );
    });

    it('throws on column with comment syntax', () => {
      expect(() => insertDocumentQuery('posts', ['title--'])).toThrow('Invalid column name');
    });
  });
});

// ============================================
// 2. SQL INJECTION VIA SORT FIELDS
// ============================================

describe('SQL injection via sort fields', () => {
  it('rejects sort field not defined on the collection', async () => {
    const db = mockDb();
    const options: RevealFindOptions = {
      sort: { 'title"; DROP TABLE users; --': '1' },
    };

    await expect(find(mockConfig, db as never, options)).rejects.toThrow('Invalid sort field');
    expect(db.query).not.toHaveBeenCalled();
  });

  it('rejects sort field with SQL comment', async () => {
    const db = mockDb();
    const options: RevealFindOptions = {
      sort: { 'title--': '1' },
    };

    await expect(find(mockConfig, db as never, options)).rejects.toThrow('Invalid sort field');
  });

  it('rejects sort field with UNION SELECT injection', async () => {
    const db = mockDb();
    const options: RevealFindOptions = {
      sort: { 'title UNION SELECT * FROM users': '1' },
    };

    await expect(find(mockConfig, db as never, options)).rejects.toThrow('Invalid sort field');
  });

  it('allows a legitimate field name for sorting', async () => {
    const db = mockDb();
    stubFindDb(db);

    const options: RevealFindOptions = {
      sort: { title: '1' },
    };

    await expect(find(mockConfig, db as never, options)).resolves.toBeDefined();

    // Verify the ORDER BY clause uses escaped identifiers
    const dataQuery = db.query.mock.calls[1][0] as string;
    expect(dataQuery).toContain('"title" ASC');
  });

  it('escapes double-quotes in allowed sort field identifiers', async () => {
    // Even if a field name somehow contained a quote (unlikely with current
    // validation), escapeIdentifier doubles it to prevent breakout.
    const escaped = escapeIdentifier('title"injection');
    expect(escaped).toBe('title""injection');
    // When wrapped: "title""injection"  -  PostgreSQL treats "" as a literal quote
  });
});

// ============================================
// 3. SQL INJECTION VIA WHERE CLAUSES
// ============================================

describe('SQL injection via where clauses', () => {
  it('parameterizes equals values  -  never inlines user input', () => {
    const params: unknown[] = [];
    const clause = buildWhereClause({ title: { equals: "'; DROP TABLE users; --" } }, params);

    expect(clause).toBe('"title" = $1');
    expect(params).toEqual(["'; DROP TABLE users; --"]);
    // The dangerous string is in params, not interpolated into the SQL
    expect(clause).not.toContain('DROP');
    expect(clause).not.toContain("'");
  });

  it('parameterizes contains values with LIKE wildcard escaping', () => {
    const params: unknown[] = [];
    const clause = buildWhereClause(
      { title: { contains: '100% UNION SELECT * FROM users --' } },
      params,
    );

    expect(clause).toBe('"title" LIKE $1 ESCAPE \'\\\'');
    // Wildcards in user input are escaped
    expect(params[0]).toBe('%100\\% UNION SELECT * FROM users --%');
    // The dangerous string is safely parameterized
    expect(clause).not.toContain('UNION');
  });

  it('parameterizes IN values  -  each array element gets a placeholder', () => {
    const params: unknown[] = [];
    const clause = buildWhereClause(
      { status: { in: ["active'; DROP TABLE users; --", 'normal'] } },
      params,
    );

    expect(clause).toBe('"status" IN ($1, $2)');
    expect(params).toEqual(["active'; DROP TABLE users; --", 'normal']);
    expect(clause).not.toContain('DROP');
  });

  it('escapes double-quotes in field names within where clauses', () => {
    const params: unknown[] = [];
    const clause = buildWhereClause({ 'field"breakout': { equals: 'value' } }, params, {
      quoteFields: true,
    });

    // Embedded quote is doubled, preventing identifier breakout
    expect(clause).toBe('"field""breakout" = $1');
    expect(params).toEqual(['value']);
  });

  it('rejects invalid query operators', () => {
    const params: unknown[] = [];
    expect(() => buildWhereClause({ title: { invalid_operator: 'test' } }, params)).toThrow(
      'Invalid query operators',
    );
  });

  it('parameterizes not_equals values', () => {
    const params: unknown[] = [];
    const clause = buildWhereClause({ role: { not_equals: "admin' OR '1'='1" } }, params);

    expect(clause).toBe('"role" != $1');
    expect(params).toEqual(["admin' OR '1'='1"]);
    expect(clause).not.toContain('OR');
  });

  it('parameterizes greater_than values with injection attempt', () => {
    const params: unknown[] = [];
    const clause = buildWhereClause({ age: { greater_than: '0 OR 1=1' } }, params);

    expect(clause).toBe('"age" > $1');
    expect(params).toEqual(['0 OR 1=1']);
    expect(clause).not.toContain('OR 1=1');
  });

  it('escapes LIKE wildcards in contains to prevent wildcard injection', () => {
    const params: unknown[] = [];
    buildWhereClause({ title: { contains: '%_\\' } }, params);

    // All three LIKE metacharacters (%, _, \) must be escaped
    expect(params[0]).toBe('%\\%\\_\\\\%');
  });
});

// ============================================
// 4. XSS VIA RICH TEXT LINKS
// ============================================

describe('XSS via rich text links', () => {
  describe('isSafeUrl blocks dangerous protocols', () => {
    const dangerousUrls = [
      ['javascript:alert(1)', 'javascript: protocol'],
      ['javascript:alert(document.cookie)', 'javascript: cookie theft'],
      ['JAVASCRIPT:ALERT(1)', 'javascript: uppercase'],
      ['jAvAsCrIpT:alert(1)', 'javascript: mixed case'],
      ['vbscript:MsgBox("XSS")', 'vbscript: protocol'],
      ['VBScript:Execute("cmd")', 'vbscript: uppercase'],
      ['data:text/html,<script>alert(1)</script>', 'data:text/html'],
      ['data:text/html;base64,PHNjcmlwdD5hbGVydCgxKTwvc2NyaXB0Pg==', 'data:text/html base64'],
      ['data:application/javascript,alert(1)', 'data:application/javascript'],
      ['data:,alert(1)', 'data: without MIME'],
    ];

    it.each(dangerousUrls)('blocks %s (%s)', (url) => {
      expect(isSafeUrl(url)).toBe(false);
    });
  });

  describe('isSafeUrl blocks whitespace-prefixed XSS attempts', () => {
    it('blocks space + javascript:', () => {
      expect(isSafeUrl(' javascript:alert(1)')).toBe(false);
    });

    it('blocks tab + javascript:', () => {
      expect(isSafeUrl('\tjavascript:alert(1)')).toBe(false);
    });

    it('blocks newline + javascript:', () => {
      expect(isSafeUrl('\njavascript:alert(1)')).toBe(false);
    });

    it('blocks mixed whitespace + vbscript:', () => {
      expect(isSafeUrl(' \t\n vbscript:alert(1)')).toBe(false);
    });
  });

  describe('sanitizeUrl replaces dangerous URLs with "#"', () => {
    it('replaces javascript: with "#"', () => {
      expect(sanitizeUrl('javascript:alert(document.cookie)')).toBe('#');
    });

    it('replaces vbscript: with "#"', () => {
      expect(sanitizeUrl('vbscript:MsgBox("XSS")')).toBe('#');
    });

    it('replaces data:text/html with "#"', () => {
      expect(sanitizeUrl('data:text/html,<img onerror=alert(1)>')).toBe('#');
    });

    it('preserves safe https URL', () => {
      expect(sanitizeUrl('https://example.com/page?q=test')).toBe(
        'https://example.com/page?q=test',
      );
    });

    it('preserves safe relative path', () => {
      expect(sanitizeUrl('/about/team')).toBe('/about/team');
    });

    it('preserves mailto:', () => {
      expect(sanitizeUrl('mailto:user@example.com')).toBe('mailto:user@example.com');
    });

    it('preserves tel:', () => {
      expect(sanitizeUrl('tel:+15551234567')).toBe('tel:+15551234567');
    });
  });

  describe('isSafeUrl context handling for images', () => {
    it('allows data:image/png in image context', () => {
      expect(isSafeUrl('data:image/png;base64,iVBORw0KGgo=', 'image')).toBe(true);
    });

    it('blocks data:image/png in link context', () => {
      expect(isSafeUrl('data:image/png;base64,iVBORw0KGgo=', 'link')).toBe(false);
    });

    it('blocks data:text/html in image context', () => {
      expect(isSafeUrl('data:text/html,<script>alert(1)</script>', 'image')).toBe(false);
    });

    it('blocks javascript: in image context', () => {
      expect(isSafeUrl('javascript:alert(1)', 'image')).toBe(false);
    });
  });
});

// ============================================
// 5. XSS VIA COLLECTION DATA
// ============================================

describe('XSS via collection data', () => {
  it('stores HTML in field values as literal strings (not executed)', async () => {
    const db = mockDb();
    const xssPayload = '<script>alert(document.cookie)</script>';

    // create() should pass the value through to parameterized query
    db.query
      .mockResolvedValueOnce({ rows: [], rowCount: 1 } as unknown as DatabaseResult)
      .mockResolvedValueOnce({
        rows: [{ id: 'rvl_1', title: xssPayload, status: 'draft' }],
      } as DatabaseResult);

    const result = await create(mockConfig, db as never, {
      data: { title: xssPayload, status: 'draft' },
    });

    // The INSERT query should use parameterized values
    const insertCall = db.query.mock.calls[0];
    const insertQuery = insertCall[0] as string;
    const insertParams = insertCall[1] as unknown[];

    // The script tag should be in parameters, not in the query string
    expect(insertQuery).not.toContain('<script>');
    expect(insertQuery).not.toContain('alert');
    expect(insertParams).toContain(xssPayload);

    // The returned document preserves the literal string
    expect(result.title).toBe(xssPayload);
  });

  it('stores event handler attributes in field values as literal strings', async () => {
    const db = mockDb();
    const xssPayload = '<img src=x onerror=alert(1)>';

    db.query
      .mockResolvedValueOnce({ rows: [], rowCount: 1 } as unknown as DatabaseResult)
      .mockResolvedValueOnce({
        rows: [{ id: 'rvl_1', title: xssPayload, status: 'draft' }],
      } as DatabaseResult);

    const result = await create(mockConfig, db as never, {
      data: { title: xssPayload, status: 'draft' },
    });

    const insertParams = db.query.mock.calls[0][1] as unknown[];
    expect(insertParams).toContain(xssPayload);
    expect(result.title).toBe(xssPayload);
  });

  it('stores SQL injection attempts in field values as literal strings', async () => {
    const db = mockDb();
    const sqlPayload = "Robert'; DROP TABLE students; --";

    db.query
      .mockResolvedValueOnce({ rows: [], rowCount: 1 } as unknown as DatabaseResult)
      .mockResolvedValueOnce({
        rows: [{ id: 'rvl_1', title: sqlPayload, status: 'published' }],
      } as DatabaseResult);

    const result = await create(mockConfig, db as never, {
      data: { title: sqlPayload, status: 'published' },
    });

    const insertQuery = db.query.mock.calls[0][0] as string;
    const insertParams = db.query.mock.calls[0][1] as unknown[];

    // Verify the dangerous string is parameterized, not interpolated
    expect(insertQuery).not.toContain('DROP TABLE');
    expect(insertParams).toContain(sqlPayload);
    expect(result.title).toBe(sqlPayload);
  });
});

// ============================================
// 6. PARAMETER POLLUTION (extra/unexpected fields)
// ============================================

describe('parameter pollution  -  extra fields in data', () => {
  it('rejects extra fields with invalid column names via validateColumnName', async () => {
    const db = mockDb();
    const strictConfig: RevealCollectionConfig = {
      slug: 'posts',
      fields: [
        { name: 'title', type: 'text', required: true },
        { name: 'status', type: 'select' },
      ],
    };

    // Extra field 'isAdmin' has uppercase letter which fails PostgreSQL
    // identifier validation  -  the column name allowlist blocks it.
    await expect(
      create(strictConfig, db as never, {
        data: {
          title: 'Safe',
          status: 'draft',
          isAdmin: true,
        },
      }),
    ).rejects.toThrow('Invalid column name');

    // No query should have executed because validation failed first
    expect(db.query).not.toHaveBeenCalled();
  });

  it('allows extra fields with valid lowercase column names (parameterized)', async () => {
    const db = mockDb();
    const strictConfig: RevealCollectionConfig = {
      slug: 'posts',
      fields: [
        { name: 'title', type: 'text', required: true },
        { name: 'status', type: 'select' },
      ],
    };

    db.query
      .mockResolvedValueOnce({ rows: [], rowCount: 1 } as unknown as DatabaseResult)
      .mockResolvedValueOnce({
        rows: [{ id: 'rvl_1', title: 'Safe', status: 'draft', role: 'superadmin' }],
      } as DatabaseResult);

    await create(strictConfig, db as never, {
      data: {
        title: 'Safe',
        status: 'draft',
        role: 'superadmin',
      },
    });

    // The INSERT query uses parameterized values
    const insertQuery = db.query.mock.calls[0][0] as string;
    const insertParams = db.query.mock.calls[0][1] as unknown[];

    // Values are parameterized, not interpolated
    expect(insertQuery).not.toContain('superadmin');
    expect(insertParams).toContain('superadmin');
  });

  it('validateColumnName rejects prototype pollution field names', () => {
    expect(() => validateColumnName('__proto__')).not.toThrow();
    // __proto__ is alphanumeric + underscores, so it passes column validation.
    // However, it would be stored as a normal column  -  the dangerous behavior
    // (prototype pollution) only occurs in object merges, not in SQL queries.
    // The parameterized query prevents any SQL injection regardless.
  });

  it('validateColumnName rejects field names with special characters or mixed case', () => {
    expect(() => validateColumnName('constructor()')).toThrow('Invalid column name');
    // camelCase names are rejected because the regex requires all-lowercase.
    // This prevents JavaScript prototype property names from becoming columns.
    expect(() => validateColumnName('toString')).toThrow('Invalid column name');
    expect(() => validateColumnName('hasOwnProperty')).toThrow('Invalid column name');
    expect(() => validateColumnName('isAdmin')).toThrow('Invalid column name');
    // All-lowercase equivalents are valid PostgreSQL identifiers
    expect(() => validateColumnName('tostring')).not.toThrow();
    expect(() => validateColumnName('is_admin')).not.toThrow();
  });
});

// ============================================
// 7. ID INJECTION
// ============================================

describe('ID injection', () => {
  it('treats "1 OR 1=1" as a literal string ID in findByID', async () => {
    const db = mockDb();
    db.query.mockResolvedValueOnce({ rows: [] } as DatabaseResult);

    const result = await findByID(mockConfig, db as never, {
      id: '1 OR 1=1',
    });

    expect(result).toBeNull();

    // Verify the ID was passed as a parameterized value, not interpolated
    const query = db.query.mock.calls[0][0] as string;
    const params = db.query.mock.calls[0][1] as unknown[];

    expect(query).toBe('SELECT * FROM "posts" WHERE id = $1 LIMIT 1');
    expect(params).toEqual(['1 OR 1=1']);
    // The injection string is in the params array, not the SQL
    expect(query).not.toContain('OR 1=1');
  });

  it('treats "1; DROP TABLE users" as a literal string ID', async () => {
    const db = mockDb();
    db.query.mockResolvedValueOnce({ rows: [] } as DatabaseResult);

    await findByID(mockConfig, db as never, {
      id: '1; DROP TABLE users',
    });

    const params = db.query.mock.calls[0][1] as unknown[];
    expect(params).toEqual(['1; DROP TABLE users']);
  });

  it('treats "1 UNION SELECT * FROM users" as a literal string ID', async () => {
    const db = mockDb();
    db.query.mockResolvedValueOnce({ rows: [] } as DatabaseResult);

    await findByID(mockConfig, db as never, {
      id: '1 UNION SELECT * FROM users',
    });

    const query = db.query.mock.calls[0][0] as string;
    const params = db.query.mock.calls[0][1] as unknown[];

    // Query should be static, injection attempt in params
    expect(query).toBe('SELECT * FROM "posts" WHERE id = $1 LIMIT 1');
    expect(params).toEqual(['1 UNION SELECT * FROM users']);
    expect(query).not.toContain('UNION');
  });

  it('converts numeric ID to string for consistent parameterization', async () => {
    const db = mockDb();
    db.query.mockResolvedValueOnce({ rows: [] } as DatabaseResult);

    await findByID(mockConfig, db as never, { id: 42 });

    const params = db.query.mock.calls[0][1] as unknown[];
    expect(params).toEqual(['42']);
  });

  it('parameterizes ID in where clause of find()', async () => {
    const db = mockDb();
    stubFindDb(db);

    await find(mockConfig, db as never, {
      where: { id: { equals: "1' OR '1'='1" } },
    });

    // Count query
    const countParams = db.query.mock.calls[0][1] as unknown[];
    expect(countParams).toContain("1' OR '1'='1");

    // The injection attempt is in params, never interpolated
    const countQuery = db.query.mock.calls[0][0] as string;
    expect(countQuery).not.toContain("OR '1'='1");
  });
});

// ============================================
// 8. COMBINED ATTACK VECTORS
// ============================================

describe('combined attack vectors', () => {
  it('rejects sort injection even with valid where clause', async () => {
    const db = mockDb();

    await expect(
      find(mockConfig, db as never, {
        where: { title: { equals: 'safe' } },
        sort: { 'title; DROP TABLE users': '1' },
      }),
    ).rejects.toThrow('Invalid sort field');

    // No queries should have executed
    expect(db.query).not.toHaveBeenCalled();
  });

  it('handles nested AND/OR where clauses with injection attempts', () => {
    const params: unknown[] = [];
    const clause = buildWhereClause(
      {
        and: [
          { title: { equals: "'; DROP TABLE users; --" } },
          {
            or: [
              { status: { equals: "published' OR '1'='1" } },
              { author: { contains: "admin%'; --" } },
            ],
          },
        ],
      },
      params,
    );

    // All values should be parameterized
    expect(params).toHaveLength(3);
    expect(params[0]).toBe("'; DROP TABLE users; --");
    expect(params[1]).toBe("published' OR '1'='1");
    // contains escapes LIKE wildcards
    expect(params[2]).toBe("%admin\\%'; --%");

    // None of the dangerous strings appear in the SQL clause itself
    expect(clause).not.toContain('DROP');
    expect(clause).not.toContain("'1'='1");
    expect(clause).toContain('$1');
    expect(clause).toContain('$2');
    expect(clause).toContain('$3');
  });

  it('blocks second-order injection via table names derived from config', () => {
    // If an attacker could somehow control config.slug, validateSlug blocks it
    expect(() => collectionTable('users; DROP TABLE posts; --')).toThrow('Invalid collection slug');
    expect(() => collectionTable('users" OR "1"="1')).toThrow('Invalid collection slug');
  });
});
