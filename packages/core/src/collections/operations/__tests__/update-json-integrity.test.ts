import { PGlite } from '@electric-sql/pglite';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { parseDatabaseRows } from '../../../database/safe-parse.js';
import type { QueryableDatabaseAdapter, RevealCollectionConfig } from '../../../types/index.js';
import { update } from '../update.js';

describe('update preserves required stored JSON', () => {
  const database = new PGlite();
  const statements: string[] = [];
  const adapter: QueryableDatabaseAdapter = {
    async query(sql, values) {
      statements.push(sql);
      const result = await database.query(sql, values);
      return {
        rows: parseDatabaseRows(result.rows),
        rowCount: result.affectedRows ?? result.rows.length,
      };
    },
  };
  const config: RevealCollectionConfig = {
    slug: 'json_integrity',
    fields: [
      { name: 'title', type: 'text' },
      { name: 'settings', type: 'group', fields: [] },
    ],
  };

  beforeAll(async () => {
    await database.exec(
      'CREATE TABLE json_integrity (id TEXT PRIMARY KEY, title TEXT, _json TEXT)',
    );
    await database.exec(
      'CREATE TABLE jsonb_integrity (id TEXT PRIMARY KEY, title TEXT, _json JSONB)',
    );
  });

  beforeEach(async () => {
    await database.exec('DELETE FROM json_integrity; DELETE FROM jsonb_integrity');
    statements.length = 0;
  });

  afterAll(async () => {
    await database.close();
  });

  for (const encoded of [
    '{broken',
    '[]',
    'null',
    '42',
    'true',
    '"text"',
    '{"id":"replacement"}',
    '{"settings":{"constructor":{"x":1}}}',
  ]) {
    for (const data of [{ title: 'changed' }, { settings: { theme: 'dark' } }]) {
      it(`rejects ${encoded} before a write of ${Object.keys(data).join(',')}`, async () => {
        await database.query('INSERT INTO json_integrity VALUES ($1, $2, $3)', [
          'doc-1',
          'original',
          encoded,
        ]);

        await expect(update(config, adapter, { id: 'doc-1', data })).rejects.toThrow('_json');

        expect(statements.some((sql) => sql.startsWith('UPDATE '))).toBe(false);
        const stored = await database.query('SELECT * FROM json_integrity');
        expect(stored.rows).toEqual([{ id: 'doc-1', title: 'original', _json: encoded }]);
      });
    }
  }

  for (const encoded of ['[]', '42', 'true', '"text"']) {
    it(`rejects invalid JSONB extension ${encoded} before mutation`, async () => {
      await database.query('INSERT INTO jsonb_integrity VALUES ($1, $2, $3)', [
        'doc-1',
        'original',
        encoded,
      ]);
      const before = await database.query('SELECT * FROM jsonb_integrity');
      await expect(
        update({ ...config, slug: 'jsonb_integrity' }, adapter, {
          id: 'doc-1',
          data: { settings: { theme: 'dark' } },
        }),
      ).rejects.toThrow('_json');
      expect(statements.some((sql) => sql.startsWith('UPDATE '))).toBe(false);
      expect((await database.query('SELECT * FROM jsonb_integrity')).rows).toEqual(before.rows);
    });
  }

  for (const table of ['json_integrity', 'jsonb_integrity']) {
    it(`deep-merges valid stored content in ${table}`, async () => {
      const original = {
        settings: { theme: 'light', nested: { kept: true, changed: 1 } },
        extra: [1],
      };
      const insert =
        table === 'json_integrity'
          ? 'INSERT INTO json_integrity VALUES ($1, $2, $3)'
          : 'INSERT INTO jsonb_integrity VALUES ($1, $2, $3)';
      await database.query(insert, ['doc-1', 'original', JSON.stringify(original)]);

      const result = await update({ ...config, slug: table }, adapter, {
        id: 'doc-1',
        data: { settings: { nested: { changed: 2 } } },
      });

      expect(result).toEqual({
        id: 'doc-1',
        title: 'original',
        settings: { theme: 'light', nested: { kept: true, changed: 2 } },
        extra: [1],
      });
    });
  }

  it('supports a legacy SQL NULL extension without losing the scalar fields', async () => {
    await database.query('INSERT INTO json_integrity VALUES ($1, $2, $3)', [
      'doc-1',
      'original',
      null,
    ]);
    await expect(
      update(config, adapter, { id: 'doc-1', data: { settings: { theme: 'dark' } } }),
    ).resolves.toEqual({ id: 'doc-1', title: 'original', settings: { theme: 'dark' } });
  });
});
