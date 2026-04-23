/**
 * Edge Case Tests
 *
 * Covers NodeIdService input validation, DB-error handling (connection
 * failure + transient retry), collision resolution, and concurrent requests,
 * plus EpisodicMemory embedding / DB-error edge paths.
 *
 * History: previously mock-based (`db.execute` stubs). Now runs against a
 * real in-memory Postgres via PGlite for NodeIdService tests, with
 * `vi.spyOn` on the Drizzle client used to simulate transient failures
 * where the real DB is always up. EpisodicMemory tests still rely on
 * VectorMemoryService mocks (that layer is intentionally mockable) —
 * unchanged from before.
 */

import { createHash } from 'node:crypto';
import type { AgentMemory } from '@revealui/contracts/agents';
import type { Database } from '@revealui/db/client';
import { nodeIdMappings } from '@revealui/db/schema';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { createTestDb, type TestDb } from '../../../test/src/utils/drizzle-test-db.js';
import { NodeIdService } from '../memory/services/node-id-service.js';
import { EpisodicMemory } from '../memory/stores/episodic-memory.js';
import type { VectorMemoryService } from '../memory/vector/vector-memory-service.js';

// Mock VectorMemoryService — all variables must be inside the factory to avoid hoisting issues
vi.mock('../memory/vector/vector-memory-service', () => {
  const mockMemory: AgentMemory = {
    id: 'mem-1',
    version: 1,
    content: 'Test memory',
    type: 'fact',
    source: { type: 'user', id: 'user-1', confidence: 1 },
    metadata: { importance: 0.5 },
    createdAt: new Date().toISOString(),
    accessedAt: new Date().toISOString(),
    accessCount: 0,
    verified: false,
  };

  class MockVectorMemoryService {
    create = vi.fn().mockResolvedValue(mockMemory);
    getById = vi.fn().mockResolvedValue(mockMemory);
    update = vi.fn().mockResolvedValue({ ...mockMemory, accessCount: 1 });
    delete = vi.fn().mockResolvedValue(true);
    searchSimilar = vi.fn().mockResolvedValue([]);
  }

  return { VectorMemoryService: MockVectorMemoryService };
});

const getVectorService = (memory: EpisodicMemory): VectorMemoryService =>
  (memory as EpisodicMemory & { vectorService: VectorMemoryService }).vectorService;

type NodeIdEntityType = Parameters<NodeIdService['getNodeId']>[0];
type NodeIdEntityId = Parameters<NodeIdService['getNodeId']>[1];
type MemorySetStub = {
  values: () => string[];
  entries?: () => Array<[string, string]>;
};

const sha256 = (s: string) => createHash('sha256').update(s).digest('hex');

// =============================================================================
// NodeIdService Edge Cases (PGlite-backed)
// =============================================================================

describe('Edge Cases', () => {
  describe('NodeIdService Edge Cases', () => {
    let testDb: TestDb;
    let db: Database;
    let service: NodeIdService;

    beforeAll(async () => {
      testDb = await createTestDb();
      db = testDb.drizzle as unknown as Database;
    }, 30_000);

    afterAll(async () => {
      await testDb?.close();
    });

    beforeEach(async () => {
      await testDb.drizzle.delete(nodeIdMappings);
      service = new NodeIdService(db);
      vi.restoreAllMocks();
    });

    describe('Input Validation', () => {
      it('should reject empty entityId', async () => {
        await expect(service.getNodeId('session', '')).rejects.toThrow(
          'Invalid entityId: must be a non-empty string',
        );
      });

      it('should reject whitespace-only entityId', async () => {
        await expect(service.getNodeId('session', '   ')).rejects.toThrow(
          'Invalid entityId: must be a non-empty string',
        );
      });

      it('should reject null entityId', async () => {
        await expect(
          service.getNodeId('session', null as unknown as NodeIdEntityId),
        ).rejects.toThrow('Invalid entityId: must be a non-empty string');
      });

      it('should reject undefined entityId', async () => {
        await expect(
          service.getNodeId('session', undefined as unknown as NodeIdEntityId),
        ).rejects.toThrow('Invalid entityId: must be a non-empty string');
      });

      it('should reject invalid entityType', async () => {
        await expect(
          service.getNodeId('invalid' as unknown as NodeIdEntityType, 'entity-123'),
        ).rejects.toThrow("Invalid entityType: invalid. Must be 'session' or 'user'");
      });

      it('should reject null entityType', async () => {
        await expect(
          service.getNodeId(null as unknown as NodeIdEntityType, 'entity-123'),
        ).rejects.toThrow('Invalid entityType');
      });

      it('should reject very long entityId', async () => {
        const longId = 'a'.repeat(1001); // Exceeds MaxEntityIdLength (1000)
        await expect(service.getNodeId('session', longId)).rejects.toThrow(
          'Invalid entityId: length 1001 exceeds maximum of 1000 characters',
        );
      });
    });

    describe('Database Error Handling', () => {
      it('should wrap repeated DB failures in a retry-exhausted error', async () => {
        // Force every `.select()` invocation to throw. The service retries
        // up to 3 times (with backoff), then wraps the final error.
        vi.spyOn(db, 'select').mockImplementation(() => {
          throw new Error('Database connection failed');
        });

        await expect(service.getNodeId('session', 'session-123')).rejects.toThrow(
          /Database operation failed/,
        );
      });

      it('should retry on transient database errors', async () => {
        // First two select() calls throw, third succeeds (delegates to real DB).
        const real = db.select.bind(db);
        let attempts = 0;
        vi.spyOn(db, 'select').mockImplementation(((...args: unknown[]) => {
          attempts++;
          if (attempts < 3) {
            throw new Error('Transient error');
          }
          return (real as unknown as (...a: unknown[]) => unknown)(...args);
        }) as unknown as typeof db.select);

        const nodeId = await service.getNodeId('session', 'session-123');

        expect(nodeId).toBeDefined();
        expect(attempts).toBeGreaterThanOrEqual(3);
      });

      it('should not retry on validation errors', async () => {
        const selectSpy = vi.spyOn(db, 'select');

        await expect(service.getNodeId('session', '')).rejects.toThrow('Invalid entityId');

        // Validation short-circuits before any DB call.
        expect(selectSpy).not.toHaveBeenCalled();
      });
    });

    describe('Collision Handling', () => {
      it('should handle hash collision (same hash, different entityId)', async () => {
        // Seed a row at the primary hash but with a different entityId.
        // Service should detect the collision and create a new row at the
        // collision-resistant hash derived from entityType:entityId:1.
        const entityId = 'session-123';
        const primaryHash = sha256(entityId);

        await testDb.drizzle.insert(nodeIdMappings).values({
          id: primaryHash,
          entityType: 'session',
          entityId: 'different-session-id',
          nodeId: 'existing-node-id',
        });

        const nodeId = await service.getNodeId('session', entityId);

        // Service should have created a new row at sha256(`session:${entityId}:1`).
        const collisionHash = sha256(`session:${entityId}:1`);
        const allRows = await testDb.drizzle.select().from(nodeIdMappings);
        const created = allRows.find((r) => r.id === collisionHash);

        expect(created).toBeDefined();
        expect(created?.nodeId).toBe(nodeId);
        expect(created?.entityId).toBe(entityId);
      });

      it('should handle multiple collision attempts', async () => {
        // Seed collisions at both the primary hash AND the first collision hash,
        // each with a different entityId. The service should walk through two
        // collision attempts and land at the second collision-resistant hash.
        const entityId = 'session-123';
        const primaryHash = sha256(entityId);
        const firstCollisionHash = sha256(`session:${entityId}:1`);
        const secondCollisionHash = sha256(`session:${entityId}:2`);

        await testDb.drizzle.insert(nodeIdMappings).values([
          {
            id: primaryHash,
            entityType: 'session',
            entityId: 'different-1',
            nodeId: 'node-1',
          },
          {
            id: firstCollisionHash,
            entityType: 'session',
            entityId: 'different-2',
            nodeId: 'node-2',
          },
        ]);

        const nodeId = await service.getNodeId('session', entityId);

        const rows = await testDb.drizzle.select().from(nodeIdMappings);
        const created = rows.find((r) => r.id === secondCollisionHash);

        expect(created).toBeDefined();
        expect(created?.nodeId).toBe(nodeId);
        expect(created?.entityId).toBe(entityId);
      });
    });

    describe('Concurrent Operations', () => {
      it('should handle concurrent requests for same entity', async () => {
        const results = await Promise.all(
          Array.from({ length: 5 }, () => service.getNodeId('session', 'session-123')),
        );

        expect(results).toHaveLength(5);
        expect(results.every((id) => typeof id === 'string' && id.length > 0)).toBe(true);

        // Deterministic hash → exactly one row regardless of race outcome;
        // all callers must resolve to the winning node_id.
        const rows = await testDb.drizzle.select().from(nodeIdMappings);
        expect(rows).toHaveLength(1);
        expect(results.every((id) => id === rows[0]?.nodeId)).toBe(true);
      });
    });
  });

  // ===========================================================================
  // EpisodicMemory Edge Cases (VectorMemoryService mocked — DB unused)
  // ===========================================================================

  describe('EpisodicMemory Edge Cases', () => {
    let memory: EpisodicMemory;
    const userId = 'user-123';
    const nodeId = 'node-abc';

    beforeEach(() => {
      // EpisodicMemory goes through the mocked VectorMemoryService; the Database
      // argument is never touched in these tests. Pass a minimal sentinel.
      const unusedDb = {} as Database;
      memory = new EpisodicMemory(userId, nodeId, unusedDb);
      vi.clearAllMocks();
    });

    describe('Embedding Edge Cases', () => {
      it('should handle memory with null embedding', async () => {
        const testMemory: AgentMemory = {
          id: 'mem-1',
          version: 1,
          content: 'Memory without embedding',
          type: 'fact',
          source: { type: 'user', id: userId, confidence: 1 },
          metadata: {},
          createdAt: new Date().toISOString(),
        };

        await memory.add(testMemory);

        const vectorService = getVectorService(memory);
        expect(vectorService.create).toHaveBeenCalledWith(
          expect.objectContaining({ id: 'mem-1', content: 'Memory without embedding' }),
        );
      });

      it('should handle memory with undefined embedding', async () => {
        const testMemory: AgentMemory = {
          id: 'mem-2',
          version: 1,
          content: 'Memory with undefined embedding',
          type: 'fact',
          source: { type: 'user', id: userId, confidence: 1 },
          metadata: {},
          createdAt: new Date().toISOString(),
        };

        await memory.add(testMemory);

        const vectorService = getVectorService(memory);
        expect(vectorService.create).toHaveBeenCalledWith(
          expect.objectContaining({ id: 'mem-2', content: 'Memory with undefined embedding' }),
        );
      });

      it('should reject invalid embedding structure', async () => {
        const testMemory: AgentMemory = {
          id: 'mem-3',
          version: 1,
          content: 'Memory with invalid embedding',
          type: 'fact',
          source: { type: 'user', id: userId, confidence: 1 },
          embedding: {
            model: 'invalid-model',
            vector: [1, 2, 3],
            dimension: 1536,
          } as unknown as AgentMemory['embedding'],
          metadata: {},
          createdAt: new Date().toISOString(),
        };

        await expect(memory.add(testMemory)).rejects.toThrow('Invalid embedding structure');
      });

      it('should handle embedding with wrong dimension', async () => {
        const testMemory: AgentMemory = {
          id: 'mem-4',
          version: 1,
          content: 'Memory with dimension mismatch',
          type: 'fact',
          source: { type: 'user', id: userId, confidence: 1 },
          embedding: {
            model: 'openai-text-embedding-3-small',
            vector: Array(768).fill(0.1),
            dimension: 1536,
            generatedAt: new Date().toISOString(),
          },
          metadata: {},
          createdAt: new Date().toISOString(),
        };

        await expect(memory.add(testMemory)).rejects.toThrow('Invalid embedding structure');
      });
    });

    describe('Database Edge Cases', () => {
      it('should handle database error when loading memory', async () => {
        const vectorService = getVectorService(memory);
        vi.spyOn(vectorService, 'getById').mockRejectedValue(new Error('Database error'));

        memory.memories = {
          values: () => ['mem-1'],
        } as unknown as MemorySetStub;

        await expect(memory.get('mem-1')).rejects.toThrow();
      });

      it('should handle memory not found in database', async () => {
        const vectorService = getVectorService(memory);
        vi.spyOn(vectorService, 'getById').mockResolvedValue(null);

        memory.memories = {
          values: () => ['mem-1'],
        } as unknown as MemorySetStub;

        const result = await memory.get('mem-1');
        expect(result).toBeNull();
      });

      it('should handle memory not in ORSet (skip DB lookup entirely)', async () => {
        const vectorService = getVectorService(memory);
        const getByIdSpy = vi.spyOn(vectorService, 'getById');

        memory.memories = {
          values: () => [],
        } as unknown as MemorySetStub;

        const result = await memory.get('mem-1');

        expect(result).toBeNull();
        expect(getByIdSpy).not.toHaveBeenCalled();
      });
    });

    describe('Empty State Edge Cases', () => {
      it('should handle empty memory set', async () => {
        memory.memories = {
          values: () => [],
        } as unknown as MemorySetStub;

        const all = await memory.getAll();
        expect(all).toEqual([]);
      });

      it('should handle removeById on non-existent memory', async () => {
        memory.memories = {
          values: () => [],
          entries: () => [],
        } as unknown as MemorySetStub;

        const count = await memory.removeById('non-existent');
        expect(count).toBe(0);
      });
    });
  });
});
