import { describe, expect, it } from 'vitest';
import * as Y from 'yjs';
import { createYjsPersistence } from '../persistence.js';

function createMockDb() {
  const store = new Map<string, { id: string; state: Buffer; stateVector: Buffer | null }>();

  return {
    store,
    select() {
      return {
        from(_table: unknown) {
          return {
            async where(condition: unknown): Promise<Record<string, unknown>[]> {
              const id = (condition as { value: string }).value ?? 'test-doc';
              const row = store.get(id);
              return row ? [row] : [];
            },
          };
        },
      };
    },
    insert(_table: unknown) {
      return {
        values(data: Record<string, unknown>) {
          return {
            async onConflictDoUpdate(config: Record<string, unknown>) {
              const id = data.id as string;
              const existing = store.get(id);
              if (existing) {
                const set = config.set as Record<string, unknown>;
                store.set(id, {
                  ...existing,
                  state: (set.state as Buffer) ?? existing.state,
                  stateVector: (set.stateVector as Buffer) ?? existing.stateVector,
                });
              } else {
                store.set(id, {
                  id,
                  state: data.state as Buffer,
                  stateVector: (data.stateVector as Buffer) ?? null,
                });
              }
            },
          };
        },
      };
    },
    update(_table: unknown) {
      return {
        set(data: Record<string, unknown>) {
          return {
            async where(condition: unknown) {
              const id = (condition as { value: string }).value ?? 'test-doc';
              const existing = store.get(id);
              if (existing) {
                store.set(id, { ...existing, ...data } as typeof existing);
              }
            },
          };
        },
      };
    },
  };
}

describe('createYjsPersistence', () => {
  it('should create persistence with loadDocument, saveDocument, updateClientCount', () => {
    const db = createMockDb();
    const persistence = createYjsPersistence(db);

    expect(persistence.loadDocument).toBeDefined();
    expect(persistence.saveDocument).toBeDefined();
    expect(persistence.updateClientCount).toBeDefined();
  });

  it('should load an empty document without errors', async () => {
    const db = createMockDb();
    const persistence = createYjsPersistence(db);
    const doc = new Y.Doc();

    await persistence.loadDocument('test-doc', doc);
    expect(Y.encodeStateAsUpdate(doc).length).toBeGreaterThan(0);
    doc.destroy();
  });

  it('should save a document to the store', async () => {
    const db = createMockDb();
    const persistence = createYjsPersistence(db);
    const doc = new Y.Doc();

    doc.getMap('test').set('key', 'value');
    await persistence.saveDocument('test-doc', doc);

    expect(db.store.has('test-doc')).toBe(true);
    const saved = db.store.get('test-doc');
    expect(saved?.state).toBeInstanceOf(Buffer);
    doc.destroy();
  });

  it('should load a previously saved document', async () => {
    const db = createMockDb();
    const persistence = createYjsPersistence(db);

    const doc1 = new Y.Doc();
    doc1.getMap('test').set('key', 'hello');
    await persistence.saveDocument('test-doc', doc1);
    doc1.destroy();

    const doc2 = new Y.Doc();
    await persistence.loadDocument('test-doc', doc2);
    expect(doc2.getMap('test').get('key')).toBe('hello');
    doc2.destroy();
  });

  it('should upsert on save (update existing)', async () => {
    const db = createMockDb();
    const persistence = createYjsPersistence(db);

    const doc = new Y.Doc();
    doc.getMap('test').set('key', 'v1');
    await persistence.saveDocument('test-doc', doc);

    doc.getMap('test').set('key', 'v2');
    await persistence.saveDocument('test-doc', doc);

    const doc2 = new Y.Doc();
    await persistence.loadDocument('test-doc', doc2);
    expect(doc2.getMap('test').get('key')).toBe('v2');

    doc.destroy();
    doc2.destroy();
  });

  it('should update client count', async () => {
    const db = createMockDb();
    const persistence = createYjsPersistence(db);
    const doc = new Y.Doc();

    await persistence.saveDocument('test-doc', doc);
    await persistence.updateClientCount('test-doc', 3);

    const saved = db.store.get('test-doc');
    expect(saved).toBeDefined();
    doc.destroy();
  });

  it('should handle loading from non-existent document', async () => {
    const db = createMockDb();
    const persistence = createYjsPersistence(db);
    const doc = new Y.Doc();

    await expect(persistence.loadDocument('nonexistent', doc)).resolves.not.toThrow();
    doc.destroy();
  });

  it('should save state vector alongside state', async () => {
    const db = createMockDb();
    const persistence = createYjsPersistence(db);
    const doc = new Y.Doc();

    doc.getMap('data').set('x', 42);
    await persistence.saveDocument('test-doc', doc);

    const saved = db.store.get('test-doc');
    expect(saved?.stateVector).toBeInstanceOf(Buffer);
    doc.destroy();
  });
});
