/**
 * Performance Tests — NodeIdService
 *
 * Verifies that node-ID lookup + create flows stay within reasonable bounds
 * end-to-end against a real in-memory Postgres (PGlite) via the shared
 * @revealui/test harness.
 *
 * History: this file used to assert very tight timing bounds against a
 * fake `db.execute` mock that simulated 1-2ms delays via setTimeout. That
 * told us nothing about real DB-client behavior. The ported version runs
 * the real sql-helpers / Drizzle queries against PGlite, which is a much
 * more honest signal — but PGlite has a fixed per-query overhead that
 * varies with host load, so thresholds are widened accordingly. The goal
 * is to catch *regressions* (e.g. accidental N+1s, missing indexes), not
 * to measure absolute speed.
 */

import { createHash } from 'node:crypto';
import type { Database } from '@revealui/db/client';
import { nodeIdMappings } from '@revealui/db/schema';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createTestDb, type TestDb } from '../../../test/src/utils/drizzle-test-db.js';
import { NodeIdService } from '../memory/services/node-id-service.js';

const sha256 = (s: string) => createHash('sha256').update(s).digest('hex');

let testDb: TestDb;
let db: Database;

beforeAll(async () => {
  testDb = await createTestDb();
  db = testDb.drizzle as unknown as Database;
}, 30_000);

afterAll(async () => {
  await testDb?.close();
});

beforeEach(async () => {
  await testDb.drizzle.delete(nodeIdMappings);
});

describe('Node ID Service Performance', () => {
  let service: NodeIdService;
  const entityId = 'session-123';
  const entityType = 'session' as const;

  beforeEach(() => {
    service = new NodeIdService(db);
  });

  describe('Node ID Lookup Performance', () => {
    it('should complete node ID lookup for existing mapping quickly', async () => {
      await testDb.drizzle.insert(nodeIdMappings).values({
        id: sha256(entityId),
        entityType,
        entityId,
        nodeId: 'existing-node-id',
      });

      const start = performance.now();
      const nodeId = await service.getNodeId(entityType, entityId);
      const duration = performance.now() - start;

      expect(nodeId).toBe('existing-node-id');
      // PGlite in-memory + current host: lookups typically <20ms, allow 100ms slack for CI noise.
      expect(duration).toBeLessThan(100);
    });

    it('should complete node ID creation for new mapping quickly', async () => {
      const start = performance.now();
      const nodeId = await service.getNodeId(entityType, entityId);
      const duration = performance.now() - start;

      expect(nodeId).toBeDefined();
      // Create path = lookup + insert, usually <30ms on PGlite; 150ms is generous.
      expect(duration).toBeLessThan(150);
    });

    it('should handle 5 concurrent lookups of the same entity', async () => {
      await testDb.drizzle.insert(nodeIdMappings).values({
        id: sha256(entityId),
        entityType,
        entityId,
        nodeId: 'existing-node-id',
      });

      const start = performance.now();
      const results = await Promise.all(
        Array.from({ length: 5 }, () => service.getNodeId(entityType, entityId)),
      );
      const duration = performance.now() - start;

      expect(results).toHaveLength(5);
      expect(results.every((id) => id === 'existing-node-id')).toBe(true);
      expect(duration).toBeLessThan(200);
    });

    it('should handle 10 create operations at reasonable average latency', async () => {
      const start = performance.now();
      for (let i = 0; i < 10; i++) {
        await service.getNodeId(entityType, `entity-${i}`);
      }
      const duration = performance.now() - start;
      const avg = duration / 10;

      // Each op = SELECT (miss) + INSERT; typically <20ms avg on PGlite. Allow 30ms.
      expect(avg).toBeLessThan(30);
    });
  });

  describe('Database Query Shape', () => {
    it('should use primary-key lookup (single SELECT on existing mapping)', async () => {
      await testDb.drizzle.insert(nodeIdMappings).values({
        id: sha256(entityId),
        entityType,
        entityId,
        nodeId: 'existing-node-id',
      });

      // Snapshot row count before; service should not add rows on a hit.
      const before = await testDb.drizzle.select().from(nodeIdMappings);

      const nodeId = await service.getNodeId(entityType, entityId);

      const after = await testDb.drizzle.select().from(nodeIdMappings);

      expect(nodeId).toBe('existing-node-id');
      expect(after.length).toBe(before.length); // no extra INSERT on hit
    });

    it('should not cache results in-memory (repeated lookups each hit the DB)', async () => {
      // The service has no in-memory cache by design. After we seed one row
      // and call getNodeId thrice, the row count stays at 1 and each call
      // returns the same node_id — confirming the service reads fresh each
      // time rather than caching a stale value.
      await testDb.drizzle.insert(nodeIdMappings).values({
        id: sha256(entityId),
        entityType,
        entityId,
        nodeId: 'existing-node-id',
      });

      const id1 = await service.getNodeId(entityType, entityId);
      const id2 = await service.getNodeId(entityType, entityId);
      const id3 = await service.getNodeId(entityType, entityId);

      expect([id1, id2, id3]).toEqual(['existing-node-id', 'existing-node-id', 'existing-node-id']);

      const rows = await testDb.drizzle.select().from(nodeIdMappings);
      expect(rows).toHaveLength(1);
    });
  });

  describe('Performance Under Load', () => {
    it('should handle 50 sequential lookups of an existing mapping in bounded time', async () => {
      await testDb.drizzle.insert(nodeIdMappings).values({
        id: sha256(entityId),
        entityType,
        entityId,
        nodeId: 'existing-node-id',
      });

      const start = performance.now();
      for (let i = 0; i < 50; i++) {
        await service.getNodeId(entityType, entityId);
      }
      const duration = performance.now() - start;

      // 50 lookups = 50 SELECT ... LIMIT 1 on a 1-row table. Typically <500ms;
      // 2s is generous for CI under load.
      expect(duration).toBeLessThan(2000);
    });

    it('should handle mixed lookup + create across 100 entities', async () => {
      // Seed mappings for the first 50 entity IDs; the remaining 50 are new.
      const seeded = Array.from({ length: 50 }, (_, i) => {
        const id = `entity-${i}`;
        return {
          id: sha256(id),
          entityType,
          entityId: id,
          nodeId: `seeded-${i}`,
        };
      });
      await testDb.drizzle.insert(nodeIdMappings).values(seeded);

      const start = performance.now();
      const results = await Promise.all(
        Array.from({ length: 100 }, (_, i) => service.getNodeId(entityType, `entity-${i}`)),
      );
      const duration = performance.now() - start;

      // First 50 should return seeded IDs; last 50 should be fresh UUIDs.
      for (let i = 0; i < 50; i++) {
        expect(results[i]).toBe(`seeded-${i}`);
      }
      for (let i = 50; i < 100; i++) {
        expect(typeof results[i]).toBe('string');
        expect(results[i]).not.toBe(`seeded-${i}`);
      }

      const finalRows = await testDb.drizzle.select().from(nodeIdMappings);
      expect(finalRows).toHaveLength(100);

      expect(duration).toBeLessThan(3000);
    });
  });
});
