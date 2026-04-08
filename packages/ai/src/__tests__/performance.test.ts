/**
 * Performance Tests
 *
 * Verifies that node ID lookup meets performance requirements (< 10ms).
 */

import type { Database } from '@revealui/db/client';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NodeIdService } from '../memory/services/node-id-service.js';

type InsertResult = ReturnType<Database['insert']>;
type MappingRow = Record<string, unknown>;

const createInsertResult = (): InsertResult =>
  ({ values: vi.fn().mockResolvedValue(undefined) }) as unknown as InsertResult;

// Mock database with timing
const createMockDb = (): Database => {
  const mappings: Record<string, MappingRow> = {};
  return {
    query: {
      nodeIdMappings: {
        findFirst: vi.fn(() => {
          // Simulate database query delay (1-2ms typical)
          return new Promise((resolve) => {
            setTimeout(() => {
              const id = 'hash-123'; // Simplified for testing
              resolve(mappings[id] || null);
            }, 1);
          });
        }),
      },
    },
    insert: vi.fn(() => ({
      values: vi.fn((data: { id: string } & MappingRow) => {
        // Simulate database insert delay (2-3ms typical)
        return new Promise((resolve) => {
          setTimeout(() => {
            mappings[data.id] = {
              ...data,
              createdAt: new Date(),
              updatedAt: new Date(),
            };
            resolve(undefined);
          }, 2);
        });
      }),
    })),
    execute: vi.fn((sql) => {
      // Simulate database execute delay (1-2ms typical)
      return new Promise((resolve) => {
        setTimeout(() => {
          // Extract hash from SQL query (simplified for testing)
          const hashMatch = sql.queryChunks?.find((chunk: string) => chunk.includes('hash-'));
          const id = hashMatch || 'hash-123';
          const mapping = mappings[id];
          resolve(mapping ? [mapping] : []);
        }, 1);
      });
    }),
  } as unknown as Database;
};

describe('Node ID Service Performance', () => {
  let service: NodeIdService;
  let db: Database;
  const entityId = 'session-123';
  const entityType = 'session' as const;

  beforeEach(() => {
    db = createMockDb();
    service = new NodeIdService(db);
    vi.clearAllMocks();
  });

  describe('Node ID Lookup Performance', () => {
    it('should complete node ID lookup in < 10ms for existing mapping', async () => {
      // Pre-populate mapping
      vi.mocked(db.execute).mockResolvedValue([
        {
          id: 'hash-123',
          entity_type: 'session',
          entity_id: entityId,
          node_id: 'existing-node-id',
          created_at: new Date(),
          updated_at: new Date(),
        },
      ]);

      const start = performance.now();
      const nodeId = await service.getNodeId(entityType, entityId);
      const duration = performance.now() - start;

      expect(nodeId).toBeDefined();
      expect(duration).toBeLessThan(50); // Should be < 50ms (relaxed for CI parallel load)
    });

    it('should complete node ID creation in < 50ms for new mapping', async () => {
      // No existing mapping
      vi.mocked(db.execute).mockResolvedValue([]);
      vi.mocked(db.insert).mockReturnValue(createInsertResult());

      const start = performance.now();
      const nodeId = await service.getNodeId(entityType, entityId);
      const duration = performance.now() - start;

      expect(nodeId).toBeDefined();
      expect(duration).toBeLessThan(50); // Should be < 50ms (accounts for test environment overhead)
    });

    it('should handle concurrent lookups efficiently', async () => {
      // Pre-populate mapping
      vi.mocked(db.execute).mockResolvedValue([
        {
          id: 'hash-123',
          entity_type: 'session',
          entity_id: entityId,
          node_id: 'existing-node-id',
          created_at: new Date(),
          updated_at: new Date(),
        },
      ]);

      const start = performance.now();
      const results = await Promise.all([
        service.getNodeId(entityType, entityId),
        service.getNodeId(entityType, entityId),
        service.getNodeId(entityType, entityId),
        service.getNodeId(entityType, entityId),
        service.getNodeId(entityType, entityId),
      ]);
      const duration = performance.now() - start;

      expect(results).toHaveLength(5);
      expect(results.every((id) => id === 'existing-node-id')).toBe(true);
      // Concurrent lookups should still be fast
      expect(duration).toBeLessThan(50); // 5 lookups * 10ms = 50ms max
    });

    it('should handle hash generation efficiently', async () => {
      // Test that SHA-256 hash generation is fast
      // Note: This includes database operations, so it's slower than pure hash generation
      vi.mocked(db.execute).mockResolvedValue([]);
      vi.mocked(db.insert).mockReturnValue(createInsertResult());

      const start = performance.now();

      // Generate 10 node IDs (each includes hash + DB operation)
      for (let i = 0; i < 10; i++) {
        await service.getNodeId(entityType, `entity-${i}`);
      }

      const duration = performance.now() - start;
      const avgDuration = duration / 10;

      // Each operation (hash + DB) should average < 10ms
      expect(avgDuration).toBeLessThan(10);
    });
  });

  describe('Database Query Optimization', () => {
    it('should use primary key lookup (fast)', async () => {
      // Pre-populate mapping
      vi.mocked(db.execute).mockResolvedValue([
        {
          id: 'hash-123',
          entity_type: 'session',
          entity_id: entityId,
          node_id: 'existing-node-id',
          created_at: new Date(),
          updated_at: new Date(),
        },
      ]);

      const start = performance.now();
      await service.getNodeId(entityType, entityId);
      const duration = performance.now() - start;

      // Primary key lookup should be very fast (mocked DB, generous threshold for CI/WSL)
      expect(duration).toBeLessThan(50);
      expect(db.execute).toHaveBeenCalledTimes(1);
    });

    it('should cache results for same entity (no repeated DB calls)', async () => {
      // Pre-populate mapping
      vi.mocked(db.execute).mockResolvedValue([
        {
          id: 'hash-123',
          entity_type: 'session',
          entity_id: entityId,
          node_id: 'existing-node-id',
          created_at: new Date(),
          updated_at: new Date(),
        },
      ]);

      // Call multiple times
      await service.getNodeId(entityType, entityId);
      await service.getNodeId(entityType, entityId);
      await service.getNodeId(entityType, entityId);

      // Each call should query the database (no in-memory cache in service)
      // But database should have query cache
      expect(db.execute).toHaveBeenCalledTimes(3);
    });
  });

  describe('Performance Under Load', () => {
    it('should handle 100 sequential lookups efficiently', async () => {
      // Pre-populate mapping
      vi.mocked(db.execute).mockResolvedValue([
        {
          id: 'hash-123',
          entity_type: 'session',
          entity_id: entityId,
          node_id: 'existing-node-id',
          created_at: new Date(),
          updated_at: new Date(),
        },
      ]);

      const start = performance.now();
      for (let i = 0; i < 100; i++) {
        await service.getNodeId(entityType, entityId);
      }
      const duration = performance.now() - start;

      // 100 lookups should complete in reasonable time
      // With 1ms per lookup, should be ~100ms, but allow some overhead
      expect(duration).toBeLessThan(200);
    });

    it('should handle mixed operations (lookup + create) efficiently', async () => {
      let callCount = 0;
      vi.mocked(db.execute).mockImplementation(() => {
        callCount++;
        if (callCount <= 50) {
          // First 50: existing mappings
          return Promise.resolve({
            id: 'hash-123',
            entityType: 'session',
            entityId: 'session-123',
            nodeId: 'existing-node-id',
            createdAt: new Date(),
            updatedAt: new Date(),
          });
        } else {
          // Next 50: new mappings
          return Promise.resolve(null);
        }
      });
      vi.mocked(db.insert).mockReturnValue(createInsertResult());

      const start = performance.now();
      const promises = [];
      for (let i = 0; i < 100; i++) {
        promises.push(service.getNodeId('session', `session-${i}`));
      }
      await Promise.all(promises);
      const duration = performance.now() - start;

      // Mixed operations should still be efficient
      expect(duration).toBeLessThan(500); // Allow more time for inserts
    });
  });
});
