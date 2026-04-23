import { createHash } from 'node:crypto';
import type { Database } from '@revealui/db/client';
import { nodeIdMappings } from '@revealui/db/schema';
import { eq } from 'drizzle-orm';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createTestDb, type TestDb } from '../../../test/src/utils/drizzle-test-db.js';
import { NodeIdService } from '../memory/services/node-id-service.js';

/**
 * NodeIdService tests — PGlite-backed integration tests.
 *
 * These used to mock `db.execute` against hand-crafted rows. After the
 * sql-helpers.ts port to Drizzle's core query builder (Phase 6.1), the
 * tests run against a real in-memory Postgres via @revealui/test's
 * PGlite harness. Each test gets a fresh `node_id_mappings` table via
 * truncation in beforeEach.
 */

const entityId = 'session-123';
const entityType = 'session' as const;
const sha256 = (s: string) => createHash('sha256').update(s).digest('hex');

let testDb: TestDb;
let db: Database;

beforeAll(async () => {
  testDb = await createTestDb();
  // PGlite's Drizzle client is structurally compatible with the Database
  // union type for the surface NodeIdService uses (select/insert/update).
  db = testDb.drizzle as unknown as Database;
}, 30_000);

afterAll(async () => {
  await testDb?.close();
});

beforeEach(async () => {
  // Clean slate per test
  await testDb.drizzle.delete(nodeIdMappings);
});

describe('NodeIdService', () => {
  let service: NodeIdService;

  beforeEach(() => {
    service = new NodeIdService(db);
  });

  describe('Hash Generation', () => {
    it('should generate deterministic SHA-256 hash', async () => {
      // First call: no existing mapping, service creates one.
      const nodeId1 = await service.getNodeId(entityType, entityId);

      // Look up the created row — its id is the SHA-256 hash of entityId.
      const expectedHash = sha256(entityId);
      const [stored] = await testDb.drizzle
        .select()
        .from(nodeIdMappings)
        .where(eq(nodeIdMappings.id, expectedHash))
        .limit(1);

      expect(stored?.nodeId).toBe(nodeId1);

      // Second call: should return the SAME node ID (read path, not create).
      const nodeId2 = await service.getNodeId(entityType, entityId);
      expect(nodeId2).toBe(nodeId1);
    });
  });

  describe('getNodeId', () => {
    it('should return existing node ID from database', async () => {
      const existingNodeId = 'existing-node-id-123';
      const hash = sha256(entityId);

      await testDb.drizzle.insert(nodeIdMappings).values({
        id: hash,
        entityType,
        entityId,
        nodeId: existingNodeId,
      });

      const nodeId = await service.getNodeId(entityType, entityId);
      expect(nodeId).toBe(existingNodeId);
    });

    it('should create new node ID if not exists', async () => {
      const hash = sha256(entityId);

      const nodeId = await service.getNodeId(entityType, entityId);

      expect(nodeId).toBeDefined();
      expect(typeof nodeId).toBe('string');

      // Verify row was created at the expected primary-key hash.
      const [stored] = await testDb.drizzle
        .select()
        .from(nodeIdMappings)
        .where(eq(nodeIdMappings.id, hash))
        .limit(1);

      expect(stored).toBeDefined();
      expect(stored?.nodeId).toBe(nodeId);
      expect(stored?.entityType).toBe(entityType);
      expect(stored?.entityId).toBe(entityId);
    });

    it('should detect and resolve collisions', async () => {
      // Seed a row at the primary hash but with a DIFFERENT entityId.
      // getNodeId for our entityId should then fall through to a collision-
      // resistant hash (entityType:entityId:1) and create a fresh mapping.
      const differentEntityId = 'session-456';
      const primaryHash = sha256(entityId);

      await testDb.drizzle.insert(nodeIdMappings).values({
        id: primaryHash,
        entityType,
        entityId: differentEntityId,
        nodeId: 'node-for-other-entity',
      });

      const nodeId = await service.getNodeId(entityType, entityId);

      // Resolver derives the collision hash as sha256(`${type}:${id}:1`).
      const collisionHash = sha256(`${entityType}:${entityId}:1`);
      const [stored] = await testDb.drizzle
        .select()
        .from(nodeIdMappings)
        .where(eq(nodeIdMappings.id, collisionHash))
        .limit(1);

      expect(stored).toBeDefined();
      expect(stored?.nodeId).toBe(nodeId);
      expect(stored?.entityId).toBe(entityId);
    });

    it('should throw error for invalid entityType', async () => {
      await expect(
        service.getNodeId('invalid' as unknown as typeof entityType, entityId),
      ).rejects.toThrow("Invalid entityType: invalid. Must be 'session' or 'user'");
    });

    it('should throw error for empty entityId', async () => {
      await expect(service.getNodeId(entityType, '')).rejects.toThrow(
        'Invalid entityId: must be a non-empty string',
      );
    });

    it('should throw error for non-string entityId', async () => {
      await expect(service.getNodeId(entityType, null as unknown as string)).rejects.toThrow(
        'Invalid entityId: must be a non-empty string',
      );
    });
  });

  describe('Concurrent Requests', () => {
    it('should handle concurrent requests for same entity', async () => {
      const [nodeId1, nodeId2] = await Promise.all([
        service.getNodeId(entityType, entityId),
        service.getNodeId(entityType, entityId),
      ]);

      expect(nodeId1).toBeDefined();
      expect(nodeId2).toBeDefined();

      // Both must resolve to the same node_id (the hash is deterministic, so
      // whichever insert lost the race should read the winning row).
      expect(nodeId1).toBe(nodeId2);

      // Exactly one row should exist.
      const rows = await testDb.drizzle.select().from(nodeIdMappings);
      expect(rows).toHaveLength(1);
      expect(rows[0]?.nodeId).toBe(nodeId1);
    });
  });
});
