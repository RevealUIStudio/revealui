import { yjsDocuments } from '@revealui/db/schema/yjs-documents';
import { eq } from 'drizzle-orm';
import * as Y from 'yjs';

interface DrizzleDb {
  select(): {
    from(table: unknown): {
      where(condition: unknown): Promise<Record<string, unknown>[]>;
    };
  };
  insert(table: unknown): {
    values(data: unknown): {
      onConflictDoUpdate(config: unknown): Promise<unknown>;
    };
  };
  update(table: unknown): {
    set(data: unknown): {
      where(condition: unknown): Promise<unknown>;
    };
  };
}

export interface YjsPersistence {
  loadDocument(id: string, doc: Y.Doc): Promise<void>;
  saveDocument(id: string, doc: Y.Doc): Promise<void>;
  updateClientCount(id: string, count: number): Promise<void>;
}

export function createYjsPersistence(db: DrizzleDb): YjsPersistence {
  return {
    async loadDocument(id: string, doc: Y.Doc): Promise<void> {
      const rows = await db.select().from(yjsDocuments).where(eq(yjsDocuments.id, id));

      if (rows.length > 0) {
        const row = rows[0] as { state?: Buffer };
        if (row.state) {
          const update = new Uint8Array(row.state);
          Y.applyUpdate(doc, update);
        }
      }
    },

    async saveDocument(id: string, doc: Y.Doc): Promise<void> {
      const state = Buffer.from(Y.encodeStateAsUpdate(doc));
      const stateVector = Buffer.from(Y.encodeStateVector(doc));
      const now = new Date();

      await db
        .insert(yjsDocuments)
        .values({
          id,
          state,
          stateVector,
          connectedClients: 0,
          createdAt: now,
          updatedAt: now,
        })
        .onConflictDoUpdate({
          target: yjsDocuments.id,
          set: {
            state,
            stateVector,
            updatedAt: now,
          },
        });
    },

    async updateClientCount(id: string, count: number): Promise<void> {
      await db
        .update(yjsDocuments)
        .set({ connectedClients: count, updatedAt: new Date() })
        .where(eq(yjsDocuments.id, id));
    },
  };
}
