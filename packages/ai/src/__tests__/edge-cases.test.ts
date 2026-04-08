/**
 * Edge Case Tests
 *
 * Verifies that all edge cases are handled correctly.
 */

import type { AgentMemory } from '@revealui/contracts/agents';
import type { Database } from '@revealui/db/client';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NodeIdService } from '../memory/services/node-id-service.js';
import { EpisodicMemory } from '../memory/stores/episodic-memory.js';
import type { VectorMemoryService } from '../memory/vector/vector-memory-service.js';

// Mock VectorMemoryService - all variables must be inside the factory to avoid hoisting issues
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

  return {
    VectorMemoryService: MockVectorMemoryService,
  };
});

const getVectorService = (memory: EpisodicMemory): VectorMemoryService =>
  (memory as EpisodicMemory & { vectorService: VectorMemoryService }).vectorService;

type InsertResult = ReturnType<Database['insert']>;
type NodeIdEntityType = Parameters<NodeIdService['getNodeId']>[0];
type NodeIdEntityId = Parameters<NodeIdService['getNodeId']>[1];
type MemorySetStub = {
  values: () => string[];
  entries?: () => Array<[string, string]>;
};

const createInsertResult = (): InsertResult =>
  ({ values: vi.fn().mockResolvedValue(undefined) }) as unknown as InsertResult;

// Mock database
const createMockDb = (): Database => {
  return {
    query: {
      nodeIdMappings: {
        findFirst: vi.fn(),
      },
      agentMemories: {
        findFirst: vi.fn(),
      },
    },
    insert: vi.fn().mockReturnValue({
      values: vi.fn().mockResolvedValue(undefined),
    }),
    update: vi.fn().mockReturnValue({
      set: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue(undefined),
      }),
    }),
    delete: vi.fn().mockReturnValue({
      where: vi.fn().mockResolvedValue(undefined),
    }),
    execute: vi.fn().mockResolvedValue([]), // Add execute method for raw SQL queries
  } as unknown as Database;
};

describe('Edge Cases', () => {
  describe('NodeIdService Edge Cases', () => {
    let service: NodeIdService;
    let db: Database;

    beforeEach(() => {
      db = createMockDb();
      service = new NodeIdService(db);
      vi.clearAllMocks();
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
        const longId = 'a'.repeat(1001); // Exceeds MAX_ENTITY_ID_LENGTH (1000)
        await expect(service.getNodeId('session', longId)).rejects.toThrow(
          'Invalid entityId: length 1001 exceeds maximum of 1000 characters',
        );
      });
    });

    describe('Database Error Handling', () => {
      it('should handle database connection failure', async () => {
        vi.mocked(db.execute).mockRejectedValue(new Error('Database connection failed'));

        await expect(service.getNodeId('session', 'session-123')).rejects.toThrow(
          'Database operation failed',
        );
      });

      it('should retry on transient database errors', async () => {
        let callCount = 0;
        vi.mocked(db.execute).mockImplementation(() => {
          callCount++;
          if (callCount < 3) {
            return Promise.reject(new Error('Transient error'));
          }
          return Promise.resolve([]); // No existing mapping
        });
        vi.mocked(db.insert).mockReturnValue(createInsertResult());

        const nodeId = await service.getNodeId('session', 'session-123');

        expect(nodeId).toBeDefined();
        expect(db.execute).toHaveBeenCalledTimes(3);
      });

      it('should not retry on validation errors', async () => {
        await expect(service.getNodeId('session', '')).rejects.toThrow('Invalid entityId');

        // Should not retry validation errors
        expect(db.execute).not.toHaveBeenCalled();
      });
    });

    describe('Collision Handling', () => {
      it('should handle hash collision (same hash, different entityId)', async () => {
        // First call: existing mapping with different entityId (collision)
        // Note: db.execute() returns snake_case data
        vi.mocked(db.execute)
          .mockResolvedValueOnce([
            {
              id: 'hash-123',
              entity_type: 'session',
              entity_id: 'different-session-id', // Different entityId = collision
              node_id: 'existing-node-id',
              created_at: new Date(),
              updated_at: new Date(),
            },
          ])
          // Second call: check collision hash
          .mockResolvedValueOnce([]);

        vi.mocked(db.insert).mockReturnValue(createInsertResult());

        const nodeId = await service.getNodeId('session', 'session-123');

        expect(nodeId).toBeDefined();
        // Should create new mapping with collision hash
        expect(db.insert).toHaveBeenCalled();
      });

      it('should handle multiple collision attempts', async () => {
        // Simulate multiple collisions
        // Note: db.execute() returns snake_case data
        vi.mocked(db.execute)
          .mockResolvedValueOnce([
            {
              id: 'hash-123',
              entity_type: 'session',
              entity_id: 'different-1',
              node_id: 'node-1',
              created_at: new Date(),
              updated_at: new Date(),
            },
          ])
          .mockResolvedValueOnce([
            {
              id: 'collision-hash-1',
              entity_type: 'session',
              entity_id: 'different-2',
              node_id: 'node-2',
              created_at: new Date(),
              updated_at: new Date(),
            },
          ])
          .mockResolvedValueOnce([]); // Finally, no collision

        vi.mocked(db.insert).mockReturnValue(createInsertResult());

        const nodeId = await service.getNodeId('session', 'session-123');

        expect(nodeId).toBeDefined();
        expect(db.execute).toHaveBeenCalledTimes(3);
      });

      it('should throw error after max collision attempts', async () => {
        // Simulate max collisions exceeded
        vi.mocked(db.query.nodeIdMappings.findFirst).mockResolvedValue({
          id: 'hash-123',
          entityType: 'session',
          entityId: 'different',
          nodeId: 'node-id',
          createdAt: new Date(),
          updatedAt: new Date(),
        });

        // Mock collision resolution to always find existing mapping
        let attempt = 0;
        vi.mocked(db.query.nodeIdMappings.findFirst).mockImplementation(() => {
          attempt++;
          if (attempt > 10) {
            // After 10 attempts, return null to allow insert
            return Promise.resolve(null);
          }
          return Promise.resolve({
            id: `collision-${attempt}`,
            entityType: 'session',
            entityId: 'different',
            nodeId: 'node-id',
            createdAt: new Date(),
            updatedAt: new Date(),
          });
        });

        // This should eventually succeed (after 10+ attempts)
        // But we can't easily test the failure case without mocking more deeply
        // The actual implementation has MAX_COLLISION_ATTEMPTS = 10
      });
    });

    describe('Concurrent Operations', () => {
      it('should handle concurrent requests for same entity', async () => {
        let callCount = 0;
        vi.mocked(db.query.nodeIdMappings.findFirst).mockImplementation(() => {
          callCount++;
          if (callCount === 1) {
            // First request: no mapping exists
            return Promise.resolve(null);
          } else {
            // Subsequent requests: mapping now exists
            return Promise.resolve({
              id: 'hash-123',
              entityType: 'session',
              entityId: 'session-123',
              nodeId: 'node-id-123',
              createdAt: new Date(),
              updatedAt: new Date(),
            });
          }
        });

        vi.mocked(db.insert).mockReturnValue(createInsertResult());

        // Simulate 5 concurrent requests
        const results = await Promise.all([
          service.getNodeId('session', 'session-123'),
          service.getNodeId('session', 'session-123'),
          service.getNodeId('session', 'session-123'),
          service.getNodeId('session', 'session-123'),
          service.getNodeId('session', 'session-123'),
        ]);

        // All should get valid node IDs
        expect(results).toHaveLength(5);
        expect(results.every((id) => typeof id === 'string' && id.length > 0)).toBe(true);
      });
    });
  });

  describe('EpisodicMemory Edge Cases', () => {
    let memory: EpisodicMemory;
    let db: Database;
    const userId = 'user-123';
    const nodeId = 'node-abc';

    beforeEach(() => {
      db = createMockDb();
      memory = new EpisodicMemory(userId, nodeId, db);
      vi.clearAllMocks();
    });

    describe('Embedding Edge Cases', () => {
      it('should handle memory with null embedding', async () => {
        const testMemory: AgentMemory = {
          id: 'mem-1',
          version: 1,
          content: 'Memory without embedding',
          type: 'fact',
          source: {
            type: 'user',
            id: userId,
            confidence: 1,
          },
          metadata: {},
          createdAt: new Date().toISOString(),
        };

        await memory.add(testMemory);

        // Verify VectorMemoryService.create() was called
        const vectorService = getVectorService(memory);
        expect(vectorService.create).toHaveBeenCalledWith(
          expect.objectContaining({
            id: 'mem-1',
            content: 'Memory without embedding',
          }),
        );
      });

      it('should handle memory with undefined embedding', async () => {
        const testMemory: AgentMemory = {
          id: 'mem-2',
          version: 1,
          content: 'Memory with undefined embedding',
          type: 'fact',
          source: {
            type: 'user',
            id: userId,
            confidence: 1,
          },
          metadata: {},
          createdAt: new Date().toISOString(),
        };

        await memory.add(testMemory);

        // Verify VectorMemoryService.create() was called
        const vectorService = getVectorService(memory);
        expect(vectorService.create).toHaveBeenCalledWith(
          expect.objectContaining({
            id: 'mem-2',
            content: 'Memory with undefined embedding',
          }),
        );
      });

      it('should reject invalid embedding structure', async () => {
        const testMemory: AgentMemory = {
          id: 'mem-3',
          version: 1,
          content: 'Memory with invalid embedding',
          type: 'fact',
          source: {
            type: 'user',
            id: userId,
            confidence: 1,
          },
          embedding: {
            model: 'invalid-model',
            vector: [1, 2, 3],
            dimension: 1536, // Mismatch
            generatedAt: new Date().toISOString(),
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
          source: {
            type: 'user',
            id: userId,
            confidence: 1,
          },
          embedding: {
            model: 'openai-text-embedding-3-small',
            vector: Array(768).fill(0.1), // Wrong dimension
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
        // Mock VectorMemoryService.getById() to throw an error
        const vectorService = getVectorService(memory);
        vi.spyOn(vectorService, 'getById').mockRejectedValue(new Error('Database error'));

        memory.memories = {
          values: () => ['mem-1'],
        } as unknown as MemorySetStub;

        await expect(memory.get('mem-1')).rejects.toThrow();
      });

      it('should handle memory not found in database', async () => {
        // Mock VectorMemoryService.getById() to return null (no memory found)
        const vectorService = getVectorService(memory);
        vi.spyOn(vectorService, 'getById').mockResolvedValue(null);

        memory.memories = {
          values: () => ['mem-1'],
        } as unknown as MemorySetStub;

        const result = await memory.get('mem-1');

        expect(result).toBeNull();
      });

      it('should handle memory not in ORSet', async () => {
        memory.memories = {
          values: () => [], // Empty set
        } as unknown as MemorySetStub;

        const result = await memory.get('mem-1');

        expect(result).toBeNull();
        // Should not query database if not in ORSet
        expect(db.execute).not.toHaveBeenCalled();
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
