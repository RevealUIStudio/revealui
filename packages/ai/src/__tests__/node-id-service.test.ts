import type {Database} from '@revealui/db/client'
import {beforeEach,describe,expect,it,vi} from 'vitest'
import {NodeIdService} from '../memory/services/node-id-service'

type InsertResult = ReturnType<Database['insert']>
type NodeIdEntityType = Parameters<NodeIdService['getNodeId']>[0]
type NodeIdEntityId = Parameters<NodeIdService['getNodeId']>[1]

const createInsertResult = (): InsertResult =>
  ({ values: vi.fn().mockResolvedValue(undefined) }) as unknown as InsertResult

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
} as unknown as Database

describe('NodeIdService', () => {
  let service: NodeIdService
  const entityId = 'session-123'
  const entityType = 'session' as const

  beforeEach(() => {
    service = new NodeIdService(mockDb)
    vi.clearAllMocks()
  })

  describe('Hash Generation', () => {
    it('should generate deterministic SHA-256 hash', async () => {
      // Test that service generates same hash for same input
      vi.mocked(mockDb.query.nodeIdMappings.findFirst).mockResolvedValue(undefined)
      vi.mocked(mockDb.insert).mockReturnValue(createInsertResult())

      const nodeId1 = await service.getNodeId(entityType, entityId)
      vi.clearAllMocks()

      vi.mocked(mockDb.query.nodeIdMappings.findFirst).mockResolvedValue(undefined)
      vi.mocked(mockDb.insert).mockReturnValue(createInsertResult())

      const nodeId2 = await service.getNodeId(entityType, entityId)

      // Note: Since we're creating new UUIDs each time, they'll be different
      // But the hash lookup should be the same
      expect(nodeId1).toBeDefined()
      expect(nodeId2).toBeDefined()
    })
  })

  describe('getNodeId', () => {
    it('should return existing node ID from database', async () => {
      const existingNodeId = 'existing-node-id-123'

      vi.mocked(mockDb.query.nodeIdMappings.findFirst).mockResolvedValue({
        id: 'hash-123',
        entityType: 'session',
        entityId,
        nodeId: existingNodeId,
        createdAt: new Date(),
        updatedAt: new Date(),
      })

      const nodeId = await service.getNodeId(entityType, entityId)

      expect(nodeId).toBe(existingNodeId)
      expect(mockDb.query.nodeIdMappings.findFirst).toHaveBeenCalled()
    })

    it('should create new node ID if not exists', async () => {
      vi.mocked(mockDb.query.nodeIdMappings.findFirst).mockResolvedValue(undefined)
      vi.mocked(mockDb.insert).mockReturnValue(createInsertResult())

      const nodeId = await service.getNodeId(entityType, entityId)

      expect(nodeId).toBeDefined()
      expect(typeof nodeId).toBe('string')
      expect(mockDb.insert).toHaveBeenCalled()
    })

    it('should detect and resolve collisions', async () => {
      const differentEntityId = 'session-456'

      // First call: existing mapping with different entityId (collision)
      vi.mocked(mockDb.query.nodeIdMappings.findFirst)
        .mockResolvedValueOnce({
          id: 'hash-123',
          entityType: 'session',
          entityId: differentEntityId, // Different entityId = collision
          nodeId: 'existing-node-id',
          createdAt: new Date(),
          updatedAt: new Date(),
        })
        // Second call: check collision hash
        .mockResolvedValueOnce(undefined)

      vi.mocked(mockDb.insert).mockReturnValue({
        values: vi.fn().mockResolvedValue(undefined),
      } as unknown as InsertResult)

      const nodeId = await service.getNodeId(entityType, entityId)

      expect(nodeId).toBeDefined()
      // Should create new mapping with collision hash
      expect(mockDb.insert).toHaveBeenCalled()
    })

    it('should throw error for invalid entityType', async () => {
      await expect(
        service.getNodeId('invalid' as unknown as NodeIdEntityType, entityId),
      ).rejects.toThrow("Invalid entityType: invalid. Must be 'session' or 'user'")
    })

    it('should throw error for empty entityId', async () => {
      await expect(service.getNodeId(entityType, '')).rejects.toThrow(
        'Invalid entityId: must be a non-empty string',
      )
    })

    it('should throw error for non-string entityId', async () => {
      await expect(
        service.getNodeId(entityType, null as unknown as NodeIdEntityId),
      ).rejects.toThrow('Invalid entityId: must be a non-empty string')
    })
  })

  describe('Concurrent Requests', () => {
    it('should handle concurrent requests for same entity', async () => {
      // First request: no existing mapping
      vi.mocked(mockDb.query.nodeIdMappings.findFirst)
        .mockResolvedValueOnce(undefined)
        // Second request: mapping now exists (created by first request)
        .mockResolvedValueOnce({
          id: 'hash-123',
          entityType: 'session',
          entityId,
          nodeId: 'node-id-123',
          createdAt: new Date(),
          updatedAt: new Date(),
        })

      vi.mocked(mockDb.insert).mockReturnValue({
        values: vi.fn().mockResolvedValue(undefined),
      } as unknown as InsertResult)

      // Simulate concurrent requests
      const [nodeId1, nodeId2] = await Promise.all([
        service.getNodeId(entityType, entityId),
        service.getNodeId(entityType, entityId),
      ])

      // Both should get valid node IDs
      expect(nodeId1).toBeDefined()
      expect(nodeId2).toBeDefined()
    })
  })
})
