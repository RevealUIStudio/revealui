import { createYjsPersistence } from './persistence.js';
import { createProvenanceLogger } from './provenance-logger.js';
import { createRoomManager, type RoomManager } from './room-manager.js';

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

let instance: RoomManager | null = null;

export function getSharedRoomManager(db: DrizzleDb): RoomManager {
  if (!instance) {
    const persistence = createYjsPersistence(db);
    const provenanceLogger = createProvenanceLogger(
      db as unknown as Parameters<typeof createProvenanceLogger>[0],
    );
    instance = createRoomManager(persistence, provenanceLogger);
  }
  return instance;
}

export function destroySharedRoomManager(): void {
  if (instance) {
    instance.destroy();
    instance = null;
  }
}
