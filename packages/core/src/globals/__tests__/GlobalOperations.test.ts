import { describe, expect, it, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Mock dependencies
// ---------------------------------------------------------------------------
vi.mock('../../fields/hooks/afterRead/index.js', () => ({
  afterRead: vi.fn(({ doc }) => Promise.resolve(doc)),
}));

vi.mock('../../relationships/analyzer.js', () => ({
  getRelationshipFields: vi.fn(() => []),
}));

vi.mock('../../utils/flattenResult.js', () => ({
  flattenResult: vi.fn((doc: unknown) => doc),
}));

import { getRelationshipFields } from '../../relationships/analyzer.js';
import { flattenResult } from '../../utils/flattenResult.js';
import { RevealUIGlobal } from '../GlobalOperations.js';

const mockedGetRelationshipFields = vi.mocked(getRelationshipFields);
const mockedFlattenResult = vi.mocked(flattenResult);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function createMockDb(rows: Record<string, unknown>[] = []) {
  return {
    query: vi.fn().mockResolvedValue({ rows }),
  };
}

// biome-ignore lint/suspicious/noExplicitAny: test helper  -  minimal config shape
function createConfig(slug: string, fields: unknown[] = []): any {
  return { slug, fields };
}

// ---------------------------------------------------------------------------
// Tests  -  find()
// ---------------------------------------------------------------------------
describe('RevealUIGlobal', () => {
  describe('find()', () => {
    it('returns null when db is null', async () => {
      const global = new RevealUIGlobal(createConfig('settings'), null);

      const result = await global.find();

      expect(result).toBeNull();
    });

    it('queries the correct table name', async () => {
      const db = createMockDb([{ id: '1', site_name: 'Test' }]);
      const global = new RevealUIGlobal(createConfig('settings'), db);

      await global.find();

      expect(db.query).toHaveBeenCalledWith('SELECT * FROM "global_settings" LIMIT 1', []);
    });

    it('returns the first row', async () => {
      const db = createMockDb([{ id: '1', site_name: 'Test' }]);
      const global = new RevealUIGlobal(createConfig('settings'), db);

      const result = await global.find();

      expect(result).toEqual({ id: '1', site_name: 'Test' });
    });

    it('returns null when no rows found', async () => {
      const db = createMockDb([]);
      const global = new RevealUIGlobal(createConfig('settings'), db);

      const result = await global.find();

      expect(result).toBeNull();
    });

    it('calls flattenResult on the document', async () => {
      const doc = { id: '1', 'author.name': 'John' };
      mockedFlattenResult.mockReturnValueOnce({ id: '1', author: { name: 'John' } } as never);
      const db = createMockDb([doc]);
      const global = new RevealUIGlobal(createConfig('settings'), db);

      const result = await global.find();

      expect(mockedFlattenResult).toHaveBeenCalledWith(doc);
      expect(result).toEqual({ id: '1', author: { name: 'John' } });
    });

    it('throws on invalid depth', async () => {
      const db = createMockDb();
      const global = new RevealUIGlobal(createConfig('settings'), db);

      await expect(global.find({ depth: -1 })).rejects.toThrow('Depth must be between 0 and 3');
      await expect(global.find({ depth: 4 })).rejects.toThrow('Depth must be between 0 and 3');
    });

    it('throws on invalid slug', async () => {
      const db = createMockDb();
      const global = new RevealUIGlobal(createConfig('INVALID SLUG!'), db);

      await expect(global.find()).rejects.toThrow('Invalid global slug');
    });

    it('builds JOIN query when depth > 0 and relationships exist', async () => {
      mockedGetRelationshipFields.mockReturnValueOnce([
        {
          fieldName: 'author',
          relationTo: 'users',
          storageType: 'direct_fk',
          hasMany: false,
          fkColumnName: 'author_id',
        },
      ] as never);

      const db = createMockDb([{ id: '1' }]);
      const global = new RevealUIGlobal(createConfig('settings'), db);
      // biome-ignore lint/suspicious/noExplicitAny: test helper
      const req = { locale: 'en', context: {} } as any;

      await global.find({ depth: 1, req });

      const query = db.query.mock.calls[0]![0] as string;
      expect(query).toContain('LEFT JOIN "users"');
      expect(query).toContain('"author_id"');
    });
  });

  describe('update()', () => {
    it('returns data with generated id when db is null', async () => {
      const global = new RevealUIGlobal(createConfig('settings'), null);

      const result = await global.update({ data: { site_name: 'Test' } });

      expect(result).toEqual({ site_name: 'Test', id: 'global_settings' });
    });

    it('inserts when no existing document', async () => {
      const db = createMockDb([]);
      // After insert, find returns the new doc
      db.query
        .mockResolvedValueOnce({ rows: [] }) // find() during update check
        .mockResolvedValueOnce({ rows: [] }) // INSERT
        .mockResolvedValueOnce({ rows: [{ id: 'global_settings', site_name: 'New' }] }); // find() after update

      const global = new RevealUIGlobal(createConfig('settings'), db);

      const result = await global.update({ data: { site_name: 'New' } });

      expect(result).toEqual({ id: 'global_settings', site_name: 'New' });
      const insertQuery = db.query.mock.calls[1]![0] as string;
      expect(insertQuery).toContain('INSERT INTO');
    });

    it('updates when existing document found', async () => {
      const db = createMockDb();
      db.query
        .mockResolvedValueOnce({ rows: [{ id: 'global_settings', site_name: 'Old' }] }) // find()
        .mockResolvedValueOnce({ rows: [] }) // UPDATE
        .mockResolvedValueOnce({ rows: [{ id: 'global_settings', site_name: 'New' }] }); // find() after

      const global = new RevealUIGlobal(createConfig('settings'), db);

      const result = await global.update({ data: { site_name: 'New' } });

      expect(result).toEqual({ id: 'global_settings', site_name: 'New' });
      const updateQuery = db.query.mock.calls[1]![0] as string;
      expect(updateQuery).toContain('UPDATE');
    });

    it('serializes object values to JSON', async () => {
      const db = createMockDb();
      db.query
        .mockResolvedValueOnce({ rows: [{ id: 'global_settings' }] }) // find()
        .mockResolvedValueOnce({ rows: [] }) // UPDATE
        .mockResolvedValueOnce({ rows: [{ id: 'global_settings' }] }); // find() after

      const global = new RevealUIGlobal(createConfig('settings'), db);
      const meta = { key: 'value' };

      await global.update({ data: { meta } });

      const updateValues = db.query.mock.calls[1]![1] as unknown[];
      expect(updateValues[0]).toBe(JSON.stringify(meta));
    });

    it('serializes array values to JSON', async () => {
      const db = createMockDb();
      db.query
        .mockResolvedValueOnce({ rows: [{ id: 'global_settings' }] })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [{ id: 'global_settings' }] });

      const global = new RevealUIGlobal(createConfig('settings'), db);
      const tags = ['a', 'b'];

      await global.update({ data: { tags } });

      const updateValues = db.query.mock.calls[1]![1] as unknown[];
      expect(updateValues[0]).toBe(JSON.stringify(tags));
    });

    it('passes primitive values as-is', async () => {
      const db = createMockDb();
      db.query
        .mockResolvedValueOnce({ rows: [{ id: 'global_settings' }] })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [{ id: 'global_settings', count: 42 }] });

      const global = new RevealUIGlobal(createConfig('settings'), db);

      await global.update({ data: { count: 42 } });

      const updateValues = db.query.mock.calls[1]![1] as unknown[];
      expect(updateValues[0]).toBe(42);
    });

    it('throws when document not found after update', async () => {
      const db = createMockDb();
      db.query
        .mockResolvedValueOnce({ rows: [{ id: 'global_settings' }] }) // find()  -  exists
        .mockResolvedValueOnce({ rows: [] }) // UPDATE
        .mockResolvedValueOnce({ rows: [] }); // find()  -  gone?!

      const global = new RevealUIGlobal(createConfig('settings'), db);

      await expect(global.update({ data: { site_name: 'Test' } })).rejects.toThrow(
        'not found after update',
      );
    });

    it('throws on invalid slug', async () => {
      const db = createMockDb();
      const global = new RevealUIGlobal(createConfig('DROP TABLE'), db);

      await expect(global.update({ data: {} })).rejects.toThrow('Invalid global slug');
    });
  });
});
