/**
 * Automated Validation Integration Tests
 *
 * These tests run against a real PostgreSQL database and validate:
 * 1. Migration execution
 * 2. Node ID persistence
 * 3. Embedding metadata storage
 * 4. Performance benchmarks
 *
 * To run these tests:
 * 1. Start test database: ./scripts/setup-test-db.sh
 * 2. Set POSTGRES_URL: export POSTGRES_URL="postgresql://test:test@localhost:5433/test_revealui"
 * 3. Run tests: pnpm --filter @revealui/memory test __tests__/integration/automated-validation.test.ts
 */

import { createClient } from '@revealui/db/client'
import { agentMemories, eq, nodeIdMappings } from '@revealui/db/core'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { EpisodicMemory } from '../../src/core/memory/episodic-memory.js'
import { NodeIdService } from '../../src/core/services/node-id-service.js'

const POSTGRES_URL = process.env.POSTGRES_URL || process.env.DATABASE_URL

if (!POSTGRES_URL) {
  console.warn('⚠️  POSTGRES_URL not set, skipping integration tests')
  console.warn('📖 See packages/memory/TESTING.md for testing limitations and validation strategy')
}

describe.skipIf(!POSTGRES_URL)('Automated CRDT Validation', () => {
  let db: ReturnType<typeof createClient>
  let nodeIdService: NodeIdService
  let episodicMemory: EpisodicMemory

  beforeAll(async () => {
    if (!POSTGRES_URL) {
      throw new Error('POSTGRES_URL is required for integration tests')
    }
    db = createClient({ connectionString: POSTGRES_URL })
    nodeIdService = new NodeIdService(db)
    // Get nodeId for the user first
    const nodeId = await nodeIdService.getNodeId('user', 'test-user-1')
    episodicMemory = new EpisodicMemory('test-user-1', nodeId, db)
  }, 30000) // 30 second timeout for database operations

  afterAll(async () => {
    // Cleanup test data
    try {
      await db.delete(agentMemories).where(eq(agentMemories.id, 'test-memory-1'))
      await db.delete(nodeIdMappings).where(eq(nodeIdMappings.entityId, 'test-session-1'))
    } catch (_error) {
      // Ignore cleanup errors
    }
  }, 30000) // 30 second timeout for cleanup

  describe('Migration Validation', () => {
    it('should have node_id_mappings table', async () => {
      // Use Drizzle query instead of raw SQL
      const result = await db.query.nodeIdMappings.findMany({ limit: 1 })
      expect(result).toBeDefined()
      // Table exists if we can query it (even if empty)
      expect(Array.isArray(result)).toBe(true)
    })

    it('should have embedding_metadata column', async () => {
      // Test by trying to query a memory with embedding_metadata
      // If column doesn't exist, this will fail
      const result = await db.query.agentMemories.findFirst({
        columns: {
          id: true,
          embeddingMetadata: true,
        },
      })
      // If we can query embeddingMetadata, column exists
      expect(result !== undefined || true).toBe(true) // Column exists if query succeeds
    })
  })

  describe('Node ID Persistence', () => {
    it('should persist node IDs across requests', async () => {
      const nodeId1 = await nodeIdService.getNodeId('session', 'test-session-1')
      const nodeId2 = await nodeIdService.getNodeId('session', 'test-session-1')

      expect(nodeId1).toBe(nodeId2)
      expect(nodeId1).toBeTruthy()

      // Verify in database
      const mapping = await db.query.nodeIdMappings.findFirst({
        where: eq(nodeIdMappings.entityId, 'test-session-1'),
      })
      expect(mapping).toBeDefined()
      expect(mapping?.nodeId).toBe(nodeId1)
    })

    it('should handle concurrent requests', async () => {
      const promises = Array.from({ length: 10 }, (_, i) =>
        nodeIdService.getNodeId('session', `concurrent-session-${i}`),
      )
      const nodeIds = await Promise.all(promises)

      // All should be unique
      const uniqueIds = new Set(nodeIds)
      expect(uniqueIds.size).toBe(10)
    })
  })

  describe('Embedding Metadata Storage', () => {
    it('should store full embedding metadata', async () => {
      const memory = await episodicMemory.add({
        id: 'test-memory-1',
        content: 'Test memory',
        type: 'fact',
        source: {
          type: 'user',
          id: 'test-user-1',
          confidence: 1,
        },
        embedding: {
          model: 'openai-text-embedding-3-small',
          vector: [0.1, 0.2, 0.3],
          dimension: 3,
          generatedAt: new Date().toISOString(),
        },
        createdAt: new Date().toISOString(),
      })

      expect(memory).toBeDefined()

      // Verify in database
      const dbMemory = await db.query.agentMemories.findFirst({
        where: eq(agentMemories.id, 'test-memory-1'),
      })

      expect(dbMemory?.embeddingMetadata).toBeDefined()
      expect((dbMemory?.embeddingMetadata as any)?.model).toBe('openai-text-embedding-3-small')
      expect((dbMemory?.embeddingMetadata as any)?.dimension).toBe(3)
      expect((dbMemory?.embeddingMetadata as any)?.vector).toBeDefined()
    })

    it('should load embedding metadata correctly', async () => {
      const memories = await episodicMemory.getAll()
      const memory = memories.find((m) => m.id === 'test-memory-1')

      expect(memory).toBeDefined()
      expect(memory?.embedding).toBeDefined()
      expect(memory?.embedding?.model).toBe('openai-text-embedding-3-small')
    })
  })

  describe('Performance Benchmarks', () => {
    it('should complete node ID lookups in < 10ms average', async () => {
      const iterations = 100
      const start = performance.now()

      for (let i = 0; i < iterations; i++) {
        await nodeIdService.getNodeId('session', `perf-test-${i}`)
      }

      const duration = performance.now() - start
      const avg = duration / iterations

      console.log(`Average lookup time: ${avg.toFixed(2)}ms`)
      expect(avg).toBeLessThan(10) // 10ms average
    })

    it('should handle concurrent lookups efficiently', async () => {
      const iterations = 50
      const concurrent = 10
      const start = performance.now()

      const promises = []
      for (let i = 0; i < iterations; i++) {
        promises.push(nodeIdService.getNodeId('session', `concurrent-perf-${i}`))
        if (promises.length >= concurrent) {
          await Promise.all(promises)
          promises.length = 0
        }
      }
      await Promise.all(promises)

      const duration = performance.now() - start
      const avg = duration / iterations

      console.log(`Average concurrent lookup time: ${avg.toFixed(2)}ms`)
      expect(avg).toBeLessThan(10) // 10ms average
    })
  })
})
