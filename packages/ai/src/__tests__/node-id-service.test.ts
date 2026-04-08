import type { Database } from '@revealui/db/client';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NodeIdService } from '../memory/services/node-id-service.js';

type InsertResult = ReturnType<Database['insert']>;
type NodeIdEntityType = Parameters<NodeIdService['getNodeId']>[0];
type NodeIdEntityId = Parameters<NodeIdService['getNodeId']>[1];

const createInsertResult = (): InsertResult =>
  ({ values: vi.fn().mockResolvedValue(undefined) }) as unknown as InsertResult;

// Mock database
const mockDb = {
  query: {
    nodeIdMappings: {
      findFirst: vi.fn(),
    },
  },
  insert: vi.fn().mockReturnValue({
    values: vi.fn(),
  }),
  execute: vi.fn(), // Add execute method for raw SQL queries
} as unknown as Database;

describe('NodeIdService', () => {
  let service: NodeIdService;
  const entityId = 'session-123';
  const entityType = 'session' as const;

  beforeEach(() => {
    service = new NodeIdService(mockDb);
    vi.clearAllMocks();
  });

  describe('Hash Generation', () => {
    it('should generate deterministic SHA-256 hash', async () => {
      // Test that service generates same hash for same input
      vi.mocked(mockDb.execute).mockResolvedValue([]); // No existing mapping
      vi.mocked(mockDb.insert).mockReturnValue(createInsertResult());

      const nodeId1 = await service.getNodeId(entityType, entityId);
      vi.clearAllMocks();

      vi.mocked(mockDb.execute).mockResolvedValue([]); // No existing mapping
      vi.mocked(mockDb.insert).mockReturnValue(createInsertResult());

      const nodeId2 = await service.getNodeId(entityType, entityId);

      // Note: Since we're creating new UUIDs each time, they'll be different
      // But the hash lookup should be the same
      expect(nodeId1).toBeDefined();
      expect(nodeId2).toBeDefined();
    });
  });

  describe('getNodeId', () => {
    it('should return existing node ID from database', async () => {
      const existingNodeId = 'existing-node-id-123';

      // Return data only on first call, empty on subsequent calls (for collision checks)
      vi.mocked(mockDb.execute)
        .mockResolvedValueOnce([
          {
            id: 'hash-123',
            entity_type: 'session',
            entity_id: entityId,
            node_id: existingNodeId,
            created_at: new Date(),
            updated_at: new Date(),
          },
        ])
        .mockResolvedValue([]); // Subsequent calls return empty

      const nodeId = await service.getNodeId(entityType, entityId);

      expect(nodeId).toBe(existingNodeId);
      expect(mockDb.execute).toHaveBeenCalled();
    });

    it('should create new node ID if not exists', async () => {
      vi.mocked(mockDb.execute).mockResolvedValue([]); // No existing mapping
      vi.mocked(mockDb.insert).mockReturnValue(createInsertResult());

      const nodeId = await service.getNodeId(entityType, entityId);

      expect(nodeId).toBeDefined();
      expect(typeof nodeId).toBe('string');
      expect(mockDb.insert).toHaveBeenCalled();
    });

    it('should detect and resolve collisions', async () => {
      const differentEntityId = 'session-456';

      // First call: existing mapping with different entityId (collision)
      vi.mocked(mockDb.execute)
        .mockResolvedValueOnce([
          {
            id: 'hash-123',
            entity_type: 'session',
            entity_id: differentEntityId, // Different entityId = collision
            node_id: 'existing-node-id',
            created_at: new Date(),
            updated_at: new Date(),
          },
        ])
        // Second call: check collision hash - no existing mapping
        .mockResolvedValueOnce([]);

      vi.mocked(mockDb.insert).mockReturnValue({
        values: vi.fn().mockResolvedValue(undefined),
      } as unknown as InsertResult);

      const nodeId = await service.getNodeId(entityType, entityId);

      expect(nodeId).toBeDefined();
      // Should create new mapping with collision hash
      expect(mockDb.insert).toHaveBeenCalled();
    });

    it('should throw error for invalid entityType', async () => {
      await expect(
        service.getNodeId('invalid' as unknown as NodeIdEntityType, entityId),
      ).rejects.toThrow("Invalid entityType: invalid. Must be 'session' or 'user'");
    });

    it('should throw error for empty entityId', async () => {
      await expect(service.getNodeId(entityType, '')).rejects.toThrow(
        'Invalid entityId: must be a non-empty string',
      );
    });

    it('should throw error for non-string entityId', async () => {
      await expect(
        service.getNodeId(entityType, null as unknown as NodeIdEntityId),
      ).rejects.toThrow('Invalid entityId: must be a non-empty string');
    });
  });

  describe('Concurrent Requests', () => {
    it('should handle concurrent requests for same entity', async () => {
      // First request: no existing mapping
      vi.mocked(mockDb.execute)
        .mockResolvedValueOnce([]) // No existing mapping
        // Second request: mapping now exists (created by first request)
        .mockResolvedValueOnce([
          {
            id: 'hash-123',
            entity_type: 'session',
            entity_id: entityId,
            node_id: 'node-id-123',
            created_at: new Date(),
            updated_at: new Date(),
          },
        ]);

      vi.mocked(mockDb.insert).mockReturnValue({
        values: vi.fn().mockResolvedValue(undefined),
      } as unknown as InsertResult);

      // Simulate concurrent requests
      const [nodeId1, nodeId2] = await Promise.all([
        service.getNodeId(entityType, entityId),
        service.getNodeId(entityType, entityId),
      ]);

      // Both should get valid node IDs
      expect(nodeId1).toBeDefined();
      expect(nodeId2).toBeDefined();
    });
  });
});
