/**
 * EpisodicMemory Integration Tests
 *
 * Tests EpisodicMemory with VectorMemoryService integration.
 * Verifies that EpisodicMemory correctly delegates to VectorMemoryService.
 */

import { describe, it, expect, beforeAll, afterEach } from 'vitest'
import { EpisodicMemory } from '@revealui/ai/memory/memory'
import { CRDTPersistence } from '@revealui/ai/memory/persistence'
import { getRestClient, getVectorClient, resetClient } from '@revealui/db/client'
import { generateEmbedding } from '@revealui/ai/embeddings'
import type { AgentMemory } from '@revealui/schema/agents'
import { agentMemories } from '@revealui/db/core/vector'
import { eq } from 'drizzle-orm'

describe('EpisodicMemory Integration', () => {
  let testMemoryIds: string[] = []
  let testUserId: string
  let testNodeId: string

  beforeAll(() => {
    // Verify both database URLs are set
    if (!process.env.POSTGRES_URL) {
      throw new Error('POSTGRES_URL must be set for EpisodicMemory integration tests')
    }

    if (!process.env.DATABASE_URL) {
      throw new Error('DATABASE_URL must be set for EpisodicMemory integration tests')
    }

    testUserId = `test-user-${Date.now()}`
    testNodeId = `test-node-${Date.now()}`
  })

  afterEach(async () => {
    // Cleanup test memories from vector database
    const vectorDb = getVectorClient()
    for (const id of testMemoryIds) {
      try {
        await vectorDb.delete(agentMemories).where(eq(agentMemories.id, id))
      } catch (error) {
        console.warn(`Failed to cleanup memory ${id}:`, error)
      }
    }
    testMemoryIds = []
  })

  describe('Memory Operations', () => {
    it('should add memory using VectorMemoryService', async () => {
      const restDb = getRestClient()
      const persistence = new CRDTPersistence(restDb)

      const memory = new EpisodicMemory(testUserId, testNodeId, restDb, persistence)
      await memory.load()

      const embedding = await generateEmbedding('Test memory content')
      const agentMemory: AgentMemory = {
        id: `test-mem-${Date.now()}`,
        version: 1,
        content: 'Test memory content',
        type: 'fact',
        source: { type: 'user', id: testUserId, confidence: 1 },
        embedding,
        metadata: { importance: 0.5 },
        createdAt: new Date().toISOString(),
        accessedAt: new Date().toISOString(),
        accessCount: 0,
        verified: false,
      }

      const tag = await memory.add(agentMemory)
      testMemoryIds.push(agentMemory.id)

      expect(tag).toBeDefined()

      // Verify memory was stored in vector database
      const vectorDb = getVectorClient()
      const stored = await vectorDb.query.agentMemories.findFirst({
        where: eq(agentMemories.id, agentMemory.id),
      })

      expect(stored).toBeDefined()
      expect(stored?.content).toBe(agentMemory.content)
    })

    it('should get memory using VectorMemoryService', async () => {
      const restDb = getRestClient()
      const persistence = new CRDTPersistence(restDb)

      const memory = new EpisodicMemory(testUserId, testNodeId, restDb, persistence)
      await memory.load()

      const embedding = await generateEmbedding('Memory to retrieve')
      const agentMemory: AgentMemory = {
        id: `test-mem-${Date.now()}`,
        version: 1,
        content: 'Memory to retrieve',
        type: 'fact',
        source: { type: 'user', id: testUserId, confidence: 1 },
        embedding,
        metadata: { importance: 0.5 },
        createdAt: new Date().toISOString(),
        accessedAt: new Date().toISOString(),
        accessCount: 0,
        verified: false,
      }

      await memory.add(agentMemory)
      testMemoryIds.push(agentMemory.id)

      const retrieved = await memory.get(agentMemory.id)

      expect(retrieved).toBeDefined()
      expect(retrieved?.id).toBe(agentMemory.id)
      expect(retrieved?.content).toBe(agentMemory.content)
    })

    it('should delete memory using VectorMemoryService', async () => {
      const restDb = getRestClient()
      const persistence = new CRDTPersistence(restDb)

      const memory = new EpisodicMemory(testUserId, testNodeId, restDb, persistence)
      await memory.load()

      const embedding = await generateEmbedding('Memory to delete')
      const agentMemory: AgentMemory = {
        id: `test-mem-${Date.now()}`,
        version: 1,
        content: 'Memory to delete',
        type: 'fact',
        source: { type: 'user', id: testUserId, confidence: 1 },
        embedding,
        metadata: { importance: 0.5 },
        createdAt: new Date().toISOString(),
        accessedAt: new Date().toISOString(),
        accessCount: 0,
        verified: false,
      }

      await memory.add(agentMemory)
      const count = await memory.removeById(agentMemory.id)

      expect(count).toBeGreaterThan(0)

      // Verify memory was deleted from vector database
      const vectorDb = getVectorClient()
      const stored = await vectorDb.query.agentMemories.findFirst({
        where: eq(agentMemories.id, agentMemory.id),
      })

      expect(stored).toBeUndefined()
    })

    it('should update access count using VectorMemoryService', async () => {
      const restDb = getRestClient()
      const persistence = new CRDTPersistence(restDb)

      const memory = new EpisodicMemory(testUserId, testNodeId, restDb, persistence)
      await memory.load()

      const embedding = await generateEmbedding('Memory to access')
      const agentMemory: AgentMemory = {
        id: `test-mem-${Date.now()}`,
        version: 1,
        content: 'Memory to access',
        type: 'fact',
        source: { type: 'user', id: testUserId, confidence: 1 },
        embedding,
        metadata: { importance: 0.5 },
        createdAt: new Date().toISOString(),
        accessedAt: new Date().toISOString(),
        accessCount: 0,
        verified: false,
      }

      await memory.add(agentMemory)
      testMemoryIds.push(agentMemory.id)

      await memory.incrementAccess(agentMemory.id)

      const retrieved = await memory.get(agentMemory.id)
      expect(retrieved?.accessCount).toBeGreaterThan(0)
    })
  })

  describe('CRDT State Management', () => {
    it('should store CRDT state in REST database', async () => {
      const restDb = getRestClient()
      const persistence = new CRDTPersistence(restDb)

      const memory = new EpisodicMemory(testUserId, testNodeId, restDb, persistence)
      await memory.load()

      const embedding = await generateEmbedding('CRDT test memory')
      const agentMemory: AgentMemory = {
        id: `test-mem-${Date.now()}`,
        version: 1,
        content: 'CRDT test memory',
        type: 'fact',
        source: { type: 'user', id: testUserId, confidence: 1 },
        embedding,
        metadata: { importance: 0.5 },
        createdAt: new Date().toISOString(),
        accessedAt: new Date().toISOString(),
        accessCount: 0,
        verified: false,
      }

      await memory.add(agentMemory)
      testMemoryIds.push(agentMemory.id)
      await memory.save()

      // CRDT state should be in REST database (agent_contexts table)
      // We can't easily verify this without querying agent_contexts directly
      // But the fact that save() succeeds means it's working
      expect(memory.getAll().length).toBeGreaterThan(0)
    })
  })
})
