import type {AgentMemory} from '@revealui/contracts/agents'
import type {Embedding} from '@revealui/contracts/representation'
import {DEFAULT_EMBEDDING_MODEL} from '@revealui/contracts/representation'
import type {Database} from '@revealui/db/client'
import {beforeEach,describe,expect,it,vi} from 'vitest'
import {EpisodicMemory} from '../memory/memory/episodic-memory'

type AgentMemoryRow = Record<string, unknown>
type InsertResult = ReturnType<Database['insert']>
type MemorySetStub = { values: () => string[] }

const createInsertResult = (): InsertResult =>
  ({ values: vi.fn().mockResolvedValue(undefined) }) as unknown as InsertResult

// Mock database - create mocks at module level
// Note: Drizzle's insert() returns an object with values() method
const mockValues = vi.fn().mockResolvedValue(undefined)
const mockInsertReturn = {
  values: mockValues,
}
const mockInsert = vi.fn().mockReturnValue(mockInsertReturn)

const mockDb = {
  query: {
    agentMemories: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
    },
  },
  insert: mockInsert,
  delete: vi.fn().mockReturnValue({
    where: vi.fn(),
  }),
  update: vi.fn().mockReturnValue({
    set: vi.fn().mockReturnValue({
      where: vi.fn(),
    }),
  }),
} as unknown as Database

describe('EpisodicMemory - Embedding Storage', () => {
  let memory: EpisodicMemory
  const userId = 'user-123'
  const nodeId = 'node-abc'

  beforeEach(() => {
    memory = new EpisodicMemory(userId, nodeId, mockDb)
    vi.clearAllMocks()
    // Reset mocks to their initial state
    mockValues.mockClear()
    mockValues.mockResolvedValue(undefined)
    mockInsert.mockClear()
    mockInsert.mockReturnValue(mockInsertReturn)
  })

  describe('Saving Embeddings', () => {
    it('should save full Embedding object with metadata', async () => {
      const testEmbedding: Embedding = {
        model: DEFAULT_EMBEDDING_MODEL,
        vector: Array(1536).fill(0.1),
        dimension: 1536,
        generatedAt: new Date().toISOString(),
      }

      const testMemory: AgentMemory = {
        id: 'mem-1',
        version: 1,
        content: 'Test memory',
        type: 'fact',
        source: {
          type: 'user',
          id: userId,
          confidence: 1,
        },
        embedding: testEmbedding,
        metadata: { importance: 0.8 },
        createdAt: new Date().toISOString(),
      }

      await memory.add(testMemory)

      // Verify both vector and metadata are saved
      expect(mockInsert).toHaveBeenCalled()
      expect(mockValues).toHaveBeenCalled()

      // Verify the values were called with data containing embedding fields
      const valuesCall = mockValues.mock.calls[0]
      expect(valuesCall).toBeDefined()
      const values = valuesCall[0] as Record<string, unknown>
      expect(values.embedding).toEqual(testEmbedding.vector)
      expect(values.embeddingMetadata).toEqual(testEmbedding)
    })

    it('should validate embedding structure before saving', async () => {
      const invalidEmbedding = {
        model: 'invalid-model',
        vector: [1, 2, 3], // Wrong dimension
        dimension: 1536,
        generatedAt: new Date().toISOString(),
      }

      const testMemory: AgentMemory = {
        id: 'mem-1',
        version: 1,
        content: 'Test memory',
        type: 'fact',
        source: {
          type: 'user',
          id: userId,
          confidence: 1,
        },
        embedding: invalidEmbedding as unknown as Embedding,
        metadata: { importance: 0.8 },
        createdAt: new Date().toISOString(),
      }

      await expect(memory.add(testMemory)).rejects.toThrow('Invalid embedding structure')
    })

    it('should handle memory without embedding', async () => {
      const testMemory: AgentMemory = {
        id: 'mem-1',
        version: 1,
        content: 'Test memory',
        type: 'fact',
        source: {
          type: 'user',
          id: userId,
          confidence: 1,
        },
        metadata: { importance: 0.8 },
        createdAt: new Date().toISOString(),
      }

      await memory.add(testMemory)

      expect(mockDb.insert).toHaveBeenCalled()
    })
  })

  describe('Loading Embeddings', () => {
    it('should load embedding with metadata (new records)', async () => {
      const testEmbedding: Embedding = {
        model: DEFAULT_EMBEDDING_MODEL,
        vector: Array(1536).fill(0.1),
        dimension: 1536,
        generatedAt: new Date().toISOString(),
      }

      vi.mocked(mockDb.query.agentMemories.findFirst).mockResolvedValue({
        id: 'mem-1',
        version: 1,
        content: 'Test memory',
        type: 'fact',
        source: { type: 'user', id: userId, confidence: 1 },
        embedding: testEmbedding.vector,
        embeddingMetadata: testEmbedding,
        metadata: { importance: 0.8 },
        createdAt: new Date(),
        accessedAt: new Date(),
        accessCount: 0,
        verified: false,
      } as AgentMemoryRow)

      // Mock ORSet to include this memory ID
      memory.memories = {
        values: () => ['mem-1'],
      } as MemorySetStub

      const loaded = await memory.get('mem-1')

      expect(loaded).toBeDefined()
      expect(loaded?.embedding).toEqual(testEmbedding)
      expect(loaded?.embedding?.model).toBe(DEFAULT_EMBEDDING_MODEL)
      expect(loaded?.embedding?.dimension).toBe(1536)
    })

    it('should throw error for old records without embeddingMetadata (data migration required)', async () => {
      const vector = Array(1536).fill(0.1)

      vi.mocked(mockDb.query.agentMemories.findFirst).mockResolvedValue({
        id: 'mem-1',
        version: 1,
        content: 'Test memory',
        type: 'fact',
        source: { type: 'user', id: userId, confidence: 1 },
        embedding: vector,
        embeddingMetadata: null, // Old record - should fail
        metadata: { importance: 0.8 },
        createdAt: new Date(),
        accessedAt: new Date(),
        accessCount: 0,
        verified: false,
        siteId: null,
        agentId: null,
        verifiedBy: null,
        verifiedAt: null,
        expiresAt: null,
      } as AgentMemoryRow)

      memory.memories = {
        values: () => ['mem-1'],
      } as MemorySetStub

      await expect(memory.get('mem-1')).rejects.toThrow(
        'Memory record has embedding vector but missing embeddingMetadata',
      )
    })

    it('should return undefined if no embedding', async () => {
      vi.mocked(mockDb.query.agentMemories.findFirst).mockResolvedValue({
        id: 'mem-1',
        version: 1,
        content: 'Test memory',
        type: 'fact',
        source: { type: 'user', id: userId, confidence: 1 },
        embedding: null,
        embeddingMetadata: null,
        metadata: { importance: 0.8 },
        createdAt: new Date(),
        accessedAt: new Date(),
        accessCount: 0,
        verified: false,
        siteId: null,
        agentId: null,
        verifiedBy: null,
        verifiedAt: null,
        expiresAt: null,
      } as AgentMemoryRow)

      memory.memories = {
        values: () => ['mem-1'],
      } as MemorySetStub

      const loaded = await memory.get('mem-1')

      expect(loaded).toBeDefined()
      expect(loaded?.embedding).toBeUndefined()
    })
  })

  describe('Embedding Roundtrip', () => {
    it('should preserve all embedding metadata through save and load', async () => {
      const originalEmbedding: Embedding = {
        model: 'openai-text-embedding-3-large',
        vector: Array(3072).fill(0.1),
        dimension: 3072,
        generatedAt: '2024-01-01T00:00:00.000Z',
      }

      const testMemory: AgentMemory = {
        id: 'mem-1',
        version: 1,
        content: 'Test memory',
        type: 'fact',
        source: {
          type: 'user',
          id: userId,
          confidence: 1,
        },
        embedding: originalEmbedding,
        metadata: { importance: 0.8 },
        createdAt: new Date().toISOString(),
      }

      // Mock save
      vi.mocked(mockDb.insert).mockReturnValue(createInsertResult())

      await memory.add(testMemory)

      // Mock load
      vi.mocked(mockDb.query.agentMemories.findFirst).mockResolvedValue({
        id: 'mem-1',
        version: 1,
        content: 'Test memory',
        type: 'fact',
        source: { type: 'user', id: userId, confidence: 1 },
        embedding: originalEmbedding.vector,
        embeddingMetadata: originalEmbedding,
        metadata: { importance: 0.8 },
        createdAt: new Date(),
        accessedAt: new Date(),
        accessCount: 0,
        verified: false,
      } as AgentMemoryRow)

      memory.memories = {
        values: () => ['mem-1'],
      } as MemorySetStub

      const loaded = await memory.get('mem-1')

      expect(loaded?.embedding).toEqual(originalEmbedding)
      expect(loaded?.embedding?.model).toBe(originalEmbedding.model)
      expect(loaded?.embedding?.dimension).toBe(originalEmbedding.dimension)
      expect(loaded?.embedding?.generatedAt).toBe(originalEmbedding.generatedAt)
    })
  })
})
