import { describe, expect, it, vi } from 'vitest';
import type {
  DatabaseResult,
  QueryableDatabaseAdapter,
  RevealCollectionConfig,
} from '../../types/index.js';
import { RevealUICollection } from '../CollectionOperations.js';

/**
 * In-memory database adapter for testing RevealUICollection CRUD.
 * Simulates PostgreSQL query responses without a real database.
 */
function createInMemoryDb(): QueryableDatabaseAdapter & {
  _store: Map<string, Record<string, unknown>>;
} {
  const store = new Map<string, Record<string, unknown>>();
  let nextId = 1;

  return {
    _store: store,
    query: vi.fn(async (sql: string, params?: unknown[]): Promise<DatabaseResult> => {
      // INSERT
      if (sql.startsWith('INSERT')) {
        const id = String(nextId++);
        const doc: Record<string, unknown> = { id };

        // Parse column names and values from the SQL
        // Simple simulation: store the params as document fields
        if (params && params.length > 0) {
          // The create operation builds SQL with column/value pairs
          // For testing, we extract the _json field which contains the document data
          const jsonParam = params.find((p) => typeof p === 'string' && p.startsWith('{'));
          if (jsonParam) {
            try {
              Object.assign(doc, JSON.parse(jsonParam as string));
            } catch {
              // Not JSON, ignore
            }
          }
          doc.id = id;
        }

        store.set(id, doc);
        return { rows: [doc], rowCount: 1 };
      }

      // SELECT with COUNT
      if (sql.includes('COUNT')) {
        return { rows: [{ total: store.size }], rowCount: 1 };
      }

      // SELECT by ID
      if (sql.includes('WHERE') && sql.includes('"id"')) {
        const id = String(params?.[0]);
        const doc = store.get(id);
        return { rows: doc ? [doc] : [], rowCount: doc ? 1 : 0 };
      }

      // SELECT list (with LIMIT/OFFSET)
      if (sql.startsWith('SELECT') && sql.includes('LIMIT')) {
        const limit = Number(params?.[params!.length - 2]) || 10;
        const offset = Number(params?.[params!.length - 1]) || 0;
        const allDocs = Array.from(store.values());
        const docs = allDocs.slice(offset, offset + limit);
        return { rows: docs, rowCount: docs.length };
      }

      // UPDATE
      if (sql.startsWith('UPDATE')) {
        const id = String(params?.[params!.length - 1]);
        const doc = store.get(id);
        if (doc) {
          // The update operation sends JSON data as one of the params
          const jsonParam = params?.find((p) => typeof p === 'string' && p.startsWith('{'));
          if (jsonParam) {
            try {
              Object.assign(doc, JSON.parse(jsonParam as string));
            } catch {
              // Not JSON
            }
          }
          store.set(id, doc);
          return { rows: [doc], rowCount: 1 };
        }
        return { rows: [], rowCount: 0 };
      }

      // DELETE
      if (sql.startsWith('DELETE')) {
        const id = String(params?.[0]);
        const existed = store.delete(id);
        return { rows: [], rowCount: existed ? 1 : 0 };
      }

      // SELECT for existence check
      if (sql.includes('EXISTS') || sql.includes('SELECT 1')) {
        const id = String(params?.[0]);
        const exists = store.has(id);
        return { rows: exists ? [{ exists: true }] : [], rowCount: exists ? 1 : 0 };
      }

      // SELECT _json by id (for update merge)
      if (sql.includes('_json') && sql.includes('"id"')) {
        const id = String(params?.[0]);
        const doc = store.get(id);
        if (doc) {
          return { rows: [{ _json: JSON.stringify(doc) }], rowCount: 1 };
        }
        return { rows: [], rowCount: 0 };
      }

      return { rows: [], rowCount: 0 };
    }),
  };
}

function createTestConfig(slug = 'posts'): RevealCollectionConfig {
  return {
    slug,
    fields: [
      { name: 'title', type: 'text', required: true },
      { name: 'body', type: 'textarea' },
      { name: 'status', type: 'select', options: ['draft', 'published'] },
    ],
    // biome-ignore lint/suspicious/noExplicitAny: test helper  -  minimal config subset
  } as any;
}

describe('RevealUICollection', () => {
  it('constructs with config and db adapter', () => {
    const config = createTestConfig();
    const db = createInMemoryDb();
    const collection = new RevealUICollection(config, db);

    expect(collection.config).toBe(config);
    expect(collection.db).toBe(db);
    expect(collection.storage).toBeNull();
  });

  it('find returns empty result when no documents exist', async () => {
    const db = createInMemoryDb();
    const collection = new RevealUICollection(createTestConfig(), db);

    const result = await collection.find({});

    expect(result.docs).toEqual([]);
    expect(result.totalDocs).toBe(0);
    expect(result.page).toBe(1);
    expect(result.hasPrevPage).toBe(false);
    expect(result.hasNextPage).toBe(false);
  });

  it('find returns empty result when db is null', async () => {
    const collection = new RevealUICollection(createTestConfig(), null);

    const result = await collection.find({});

    expect(result.docs).toEqual([]);
    expect(result.totalDocs).toBe(0);
  });

  it('findByID returns null for non-existent document', async () => {
    const db = createInMemoryDb();
    const collection = new RevealUICollection(createTestConfig(), db);

    const result = await collection.findByID({ id: 'nonexistent' });

    expect(result).toBeNull();
  });

  it('findByID returns null when db is null', async () => {
    const collection = new RevealUICollection(createTestConfig(), null);

    const result = await collection.findByID({ id: '1' });

    expect(result).toBeNull();
  });

  it('findByID validates depth range', async () => {
    const db = createInMemoryDb();
    const collection = new RevealUICollection(createTestConfig(), db);

    await expect(collection.findByID({ id: '1', depth: -1 })).rejects.toThrow(
      'Depth must be between 0 and 3',
    );
    await expect(collection.findByID({ id: '1', depth: 4 })).rejects.toThrow(
      'Depth must be between 0 and 3',
    );
  });

  it('find validates depth range', async () => {
    const db = createInMemoryDb();
    const collection = new RevealUICollection(createTestConfig(), db);

    await expect(collection.find({ depth: -1 })).rejects.toThrow('Depth must be between 0 and 3');
    await expect(collection.find({ depth: 4 })).rejects.toThrow('Depth must be between 0 and 3');
  });

  it('find rejects invalid sort fields', async () => {
    const db = createInMemoryDb();
    const collection = new RevealUICollection(createTestConfig(), db);

    await expect(collection.find({ sort: { malicious: '1' } })).rejects.toThrow(
      'Invalid sort field',
    );
  });

  it('find accepts valid sort fields', async () => {
    const db = createInMemoryDb();
    const collection = new RevealUICollection(createTestConfig(), db);

    // Should not throw  -  'title' is a defined field
    const result = await collection.find({ sort: { title: '1' } });
    expect(result).toBeDefined();
  });

  it('find accepts system sort fields (createdAt, updatedAt)', async () => {
    const db = createInMemoryDb();
    const collection = new RevealUICollection(createTestConfig(), db);

    const result = await collection.find({ sort: { createdAt: '-1' } });
    expect(result).toBeDefined();
  });

  it('delete removes a document by id', async () => {
    const db = createInMemoryDb();
    // Pre-populate the store
    db._store.set('42', { id: '42', title: 'To Delete' });
    const collection = new RevealUICollection(createTestConfig(), db);

    const result = await collection.delete({ id: '42' });

    expect(result).toEqual({ id: '42' });
    expect(db._store.has('42')).toBe(false);
  });

  it('delete is safe for non-existent document', async () => {
    const db = createInMemoryDb();
    const collection = new RevealUICollection(createTestConfig(), db);

    // Should not throw
    const result = await collection.delete({ id: 'nonexistent' });
    expect(result).toEqual({ id: 'nonexistent' });
  });

  it('uses collectionStorage.find when available', async () => {
    const mockResult = {
      docs: [{ id: '1', title: 'From Storage' }],
      totalDocs: 1,
      limit: 10,
      totalPages: 1,
      page: 1,
      pagingCounter: 1,
      hasPrevPage: false,
      hasNextPage: false,
      prevPage: null,
      nextPage: null,
    };

    const db: QueryableDatabaseAdapter = {
      query: vi.fn(),
      collectionStorage: {
        find: vi.fn().mockResolvedValue(mockResult),
      },
    };

    const collection = new RevealUICollection(createTestConfig(), db);
    const result = await collection.find({});

    expect(result).toEqual(mockResult);
    expect(db.collectionStorage!.find).toHaveBeenCalledOnce();
    // Should not fall through to db.query
    expect(db.query).not.toHaveBeenCalled();
  });

  it('uses collectionStorage.findByID when available', async () => {
    const mockDoc = { id: '1', title: 'From Storage' };

    const db: QueryableDatabaseAdapter = {
      query: vi.fn(),
      collectionStorage: {
        findByID: vi.fn().mockResolvedValue(mockDoc),
      },
    };

    const collection = new RevealUICollection(createTestConfig(), db);
    const result = await collection.findByID({ id: '1' });

    expect(result).toEqual(mockDoc);
    expect(db.collectionStorage!.findByID).toHaveBeenCalledOnce();
    expect(db.query).not.toHaveBeenCalled();
  });

  it('collectionStorage.findByID returns null when document not found', async () => {
    const db: QueryableDatabaseAdapter = {
      query: vi.fn(),
      collectionStorage: {
        findByID: vi.fn().mockResolvedValue(null),
      },
    };

    const collection = new RevealUICollection(createTestConfig(), db);
    const result = await collection.findByID({ id: 'nonexistent' });

    expect(result).toBeNull();
  });
});
