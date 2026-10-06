import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { find } from '../../collections/operations/find.js';
import { findByID } from '../../collections/operations/findById.js';
import { selectJsonByIdQuery } from '../../collections/operations/sqlAdapter.js';
import { parseDatabaseRows } from '../safe-parse.js';
import { clearGlobalPGlite, universalPostgresAdapter } from '../universal-postgres.js';

describe('raw PostgreSQL results through the universal adapter', () => {
  const db = universalPostgresAdapter({ provider: 'electric' });

  beforeAll(async () => {
    clearGlobalPGlite();
    await db.query(
      'CREATE TABLE aggregate_contract (id TEXT PRIMARY KEY, title TEXT, _json JSONB)',
    );
    await db.query('INSERT INTO aggregate_contract (id, title) VALUES ($1, $2), ($3, $4)', [
      'first',
      'First',
      'second',
      'Second',
    ]);
  });

  afterAll(() => clearGlobalPGlite());

  it('preserves a count projection without an invented document ID', async () => {
    const result = await db.query('SELECT COUNT(*) AS total FROM aggregate_contract');
    expect(result.rows).toEqual([{ total: 2 }]);
  });

  it('preserves projected columns without an ID', async () => {
    const result = await db.query('SELECT title FROM aggregate_contract ORDER BY id');
    expect(result.rows).toEqual([{ title: 'First' }, { title: 'Second' }]);
  });

  it('reads the existing JSON projection without the document-ID workaround', async () => {
    await db.query('UPDATE aggregate_contract SET _json = $1 WHERE id = $2', [
      { items: ['value'] },
      'first',
    ]);
    const result = await db.query(selectJsonByIdQuery('aggregate_contract'), ['first']);
    expect(result.rows).toEqual([{ _json: { items: ['value'] } }]);
  });

  it('returns correct pagination through the normal collection find path', async () => {
    const result = await find({ slug: 'aggregate_contract', fields: [] }, db, { limit: 1 });
    expect(result.docs).toHaveLength(1);
    expect(result.totalDocs).toBe(2);
    expect(result.totalPages).toBe(2);
    expect(result.hasNextPage).toBe(true);
    expect(result.nextPage).toBe(2);
  });

  it('preserves aggregate rows within a transaction', async () => {
    if (!db.transaction) throw new Error('Universal adapter must support transactions');
    const result = await db.transaction((tx) =>
      tx.query('SELECT COUNT(*) AS total FROM aggregate_contract'),
    );
    expect(result.rows).toEqual([{ total: 2 }]);
  });

  it('filters rows with non-document IDs at both collection boundaries', async () => {
    await db.query('CREATE TABLE aggregate_invalid_id (id BOOLEAN, title TEXT)');
    await db.query('INSERT INTO aggregate_invalid_id VALUES (true, $1)', ['Invalid identity']);
    const config = { slug: 'aggregate_invalid_id', fields: [] };
    expect((await find(config, db, {})).docs).toEqual([]);
    expect(await findByID(config, db, { id: 'true' })).toBeNull();
  });

  it('rejects a reserved projection key before it can be silently dropped', async () => {
    await expect(db.query('SELECT 1 AS "__proto__"')).rejects.toThrow();
  });
});

describe('raw result shape validation', () => {
  it.each([null, undefined, 'row', 1, {}, [null], [1], ['row'], [[]], [new Date()]])(
    'rejects malformed driver rows: %j',
    (rows) => {
      expect(() => parseDatabaseRows(rows)).toThrow();
    },
  );

  it('rejects the complete result when one row is malformed', () => {
    expect(() => parseDatabaseRows([{ total: 2 }, null])).toThrow();
  });

  it('rejects an own prototype key without mutating its input', () => {
    const row = { ['__proto__']: 'projected value', total: 2 };
    expect(() => parseDatabaseRows([row])).toThrow();
    expect(Object.keys(row)).toEqual(['__proto__', 'total']);
    expect(Object.getOwnPropertyDescriptor(row, '__proto__')).toMatchObject({
      value: 'projected value',
    });
  });

  it('preserves driver value types and empty projections without coercion', () => {
    const rows = [
      {
        total: '9007199254740993',
        timestamp: new Date(0),
        bytes: new Uint8Array([1]),
        nullable: null,
      },
      {},
    ];
    expect(parseDatabaseRows(rows)).toEqual(rows);
  });
});
