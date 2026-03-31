/**
 * Pro Vector Memory Integration Tests
 *
 * Tests VectorMemoryService with real Supabase database.
 * Verifies embedding storage, retrieval, and similarity search.
 */

import type { AgentMemory } from '@revealui/contracts/agents';
import { getVectorClient } from '@revealui/db/client';
import { agentMemories } from '@revealui/db/schema';
import { eq, sql } from 'drizzle-orm';
import { afterEach, beforeAll, describe, expect, it } from 'vitest';

const [embeddingsModule, vectorModule] = await Promise.all([
  import('@revealui/ai/embeddings').catch(() => null),
  import('@revealui/ai/memory/vector').catch(() => null),
]);
const describeIfPro = embeddingsModule && vectorModule ? describe : describe.skip;

describeIfPro('Vector Memory Integration', () => {
  const { generateEmbedding } = embeddingsModule!;
  const { VectorMemoryService } = vectorModule!;

  let service: InstanceType<typeof VectorMemoryService>;
  let testMemoryIds: string[] = [];

  beforeAll(() => {
    // Verify DATABASE_URL is set (Supabase connection)
    if (!process.env.DATABASE_URL) {
      throw new Error(
        'DATABASE_URL must be set for vector memory integration tests. ' +
          'This should point to your Supabase database with pgvector enabled.',
      );
    }

    service = new VectorMemoryService();
  });

  afterEach(async () => {
    // Cleanup test memories
    const db = getVectorClient();
    for (const id of testMemoryIds) {
      try {
        await db.delete(agentMemories).where(eq(agentMemories.id, id));
      } catch (error) {
        // Ignore cleanup errors
        console.warn(`Failed to cleanup memory ${id}:`, error);
      }
    }
    testMemoryIds = [];
  });

  describe('Embedding Storage and Retrieval', () => {
    it('should create a memory with embedding', async () => {
      const embedding = await generateEmbedding('User prefers dark theme');
      const memory: AgentMemory = {
        id: `test-mem-${Date.now()}`,
        version: 1,
        content: 'User prefers dark theme',
        type: 'preference',
        source: { type: 'user', id: 'user-123', confidence: 1 },
        embedding,
        metadata: { importance: 0.8 },
        createdAt: new Date().toISOString(),
        accessedAt: new Date().toISOString(),
        accessCount: 0,
        verified: false,
      };

      const created = await service.create(memory);
      testMemoryIds.push(created.id);

      expect(created.id).toBe(memory.id);
      expect(created.content).toBe(memory.content);
      expect(created.embedding).toBeDefined();
      expect(created.embedding?.vector).toHaveLength(1536);
      expect(created.embedding?.model).toBe(embedding.model);
    });

    it('should retrieve a memory by ID', async () => {
      const embedding = await generateEmbedding('Test memory for retrieval');
      const memory: AgentMemory = {
        id: `test-mem-${Date.now()}`,
        version: 1,
        content: 'Test memory for retrieval',
        type: 'fact',
        source: { type: 'user', id: 'user-123', confidence: 1 },
        embedding,
        metadata: { importance: 0.5 },
        createdAt: new Date().toISOString(),
        accessedAt: new Date().toISOString(),
        accessCount: 0,
        verified: false,
      };

      const created = await service.create(memory);
      testMemoryIds.push(created.id);

      const retrieved = await service.getById(created.id);

      expect(retrieved).toBeDefined();
      expect(retrieved?.id).toBe(memory.id);
      expect(retrieved?.content).toBe(memory.content);
      expect(retrieved?.embedding).toBeDefined();
      expect(retrieved?.embedding?.vector).toHaveLength(1536);
    });

    it('should update a memory', async () => {
      const embedding = await generateEmbedding('Original content');
      const memory: AgentMemory = {
        id: `test-mem-${Date.now()}`,
        version: 1,
        content: 'Original content',
        type: 'fact',
        source: { type: 'user', id: 'user-123', confidence: 1 },
        embedding,
        metadata: { importance: 0.5 },
        createdAt: new Date().toISOString(),
        accessedAt: new Date().toISOString(),
        accessCount: 0,
        verified: false,
      };

      const created = await service.create(memory);
      testMemoryIds.push(created.id);

      const newEmbedding = await generateEmbedding('Updated content');
      const updated = await service.update(created.id, {
        content: 'Updated content',
        embedding: newEmbedding,
        accessCount: 1,
      });

      expect(updated.content).toBe('Updated content');
      expect(updated.accessCount).toBe(1);
      expect(updated.embedding?.vector).toHaveLength(1536);
    });

    it('should delete a memory', async () => {
      const embedding = await generateEmbedding('Memory to delete');
      const memory: AgentMemory = {
        id: `test-mem-${Date.now()}`,
        version: 1,
        content: 'Memory to delete',
        type: 'fact',
        source: { type: 'user', id: 'user-123', confidence: 1 },
        embedding,
        metadata: { importance: 0.5 },
        createdAt: new Date().toISOString(),
        accessedAt: new Date().toISOString(),
        accessCount: 0,
        verified: false,
      };

      const created = await service.create(memory);
      const deleted = await service.delete(created.id);

      expect(deleted).toBe(true);

      const retrieved = await service.getById(created.id);
      expect(retrieved).toBeUndefined();
    });
  });

  describe('Vector Similarity Search', () => {
    it('should find similar memories', async () => {
      // Create test memories with different content
      const memories: AgentMemory[] = [
        {
          id: `test-mem-${Date.now()}-1`,
          version: 1,
          content: 'User prefers dark theme',
          type: 'preference',
          source: { type: 'user', id: 'user-123', confidence: 1 },
          embedding: await generateEmbedding('User prefers dark theme'),
          metadata: { importance: 0.8 },
          createdAt: new Date().toISOString(),
          accessedAt: new Date().toISOString(),
          accessCount: 0,
          verified: false,
        },
        {
          id: `test-mem-${Date.now()}-2`,
          version: 1,
          content: 'User likes blue color',
          type: 'preference',
          source: { type: 'user', id: 'user-123', confidence: 1 },
          embedding: await generateEmbedding('User likes blue color'),
          metadata: { importance: 0.7 },
          createdAt: new Date().toISOString(),
          accessedAt: new Date().toISOString(),
          accessCount: 0,
          verified: false,
        },
        {
          id: `test-mem-${Date.now()}-3`,
          version: 1,
          content: 'The weather is sunny today',
          type: 'fact',
          source: { type: 'user', id: 'user-123', confidence: 1 },
          embedding: await generateEmbedding('The weather is sunny today'),
          metadata: { importance: 0.5 },
          createdAt: new Date().toISOString(),
          accessedAt: new Date().toISOString(),
          accessCount: 0,
          verified: false,
        },
      ];

      // Create all memories
      for (const mem of memories) {
        const created = await service.create(mem);
        testMemoryIds.push(created.id);
      }

      // Search for similar memories to "dark theme preference"
      const queryEmbedding = await generateEmbedding('dark theme preference');
      const results = await service.searchSimilar(queryEmbedding, { limit: 5 });

      expect(results.length).toBeGreaterThan(0);
      // First result should be most similar (dark theme)
      expect(results[0]?.memory.content).toContain('dark theme');
      expect(results[0]?.similarity).toBeGreaterThan(0.5); // Should have reasonable similarity
    });

    it('should filter by siteId', async () => {
      const embedding = await generateEmbedding('Site-specific memory');
      const memory: AgentMemory = {
        id: `test-mem-${Date.now()}`,
        version: 1,
        content: 'Site-specific memory',
        type: 'fact',
        source: { type: 'user', id: 'user-123', confidence: 1 },
        embedding,
        metadata: { siteId: 'site-123', importance: 0.5 },
        createdAt: new Date().toISOString(),
        accessedAt: new Date().toISOString(),
        accessCount: 0,
        verified: false,
      };

      const created = await service.create(memory);
      testMemoryIds.push(created.id);

      const queryEmbedding = await generateEmbedding('Site-specific memory');
      const results = await service.searchSimilar(queryEmbedding, {
        siteId: 'site-123',
        limit: 10,
      });

      expect(results.length).toBeGreaterThan(0);
      expect(results[0]?.memory.metadata?.siteId).toBe('site-123');
    });

    it('should filter by agentId', async () => {
      const embedding = await generateEmbedding('Agent-specific memory');
      const memory: AgentMemory = {
        id: `test-mem-${Date.now()}`,
        version: 1,
        content: 'Agent-specific memory',
        type: 'fact',
        source: { type: 'user', id: 'user-123', confidence: 1 },
        embedding,
        metadata: { custom: { agentId: 'agent-456' }, importance: 0.5 },
        createdAt: new Date().toISOString(),
        accessedAt: new Date().toISOString(),
        accessCount: 0,
        verified: false,
      };

      const created = await service.create(memory);
      testMemoryIds.push(created.id);

      const queryEmbedding = await generateEmbedding('Agent-specific memory');
      const results = await service.searchSimilar(queryEmbedding, {
        agentId: 'agent-456',
        limit: 10,
      });

      expect(results.length).toBeGreaterThan(0);
      expect(results[0]?.memory.metadata?.custom?.agentId).toBe('agent-456');
    });
  });

  describe('Embedding Conversion', () => {
    it('should correctly store and retrieve embeddings', async () => {
      // This test verifies that Drizzle's vector type conversion works correctly
      const embedding = await generateEmbedding('Test embedding conversion');
      const originalVector = embedding.vector;

      const memory: AgentMemory = {
        id: `test-mem-${Date.now()}`,
        version: 1,
        content: 'Test embedding conversion',
        type: 'fact',
        source: { type: 'user', id: 'user-123', confidence: 1 },
        embedding,
        metadata: { importance: 0.5 },
        createdAt: new Date().toISOString(),
        accessedAt: new Date().toISOString(),
        accessCount: 0,
        verified: false,
      };

      const created = await service.create(memory);
      testMemoryIds.push(created.id);

      // Verify embedding was stored correctly
      expect(created.embedding?.vector).toHaveLength(1536);
      const firstOriginalValue = originalVector[0];
      if (firstOriginalValue !== undefined) {
        expect(created.embedding?.vector[0]).toBeCloseTo(firstOriginalValue, 5);
      }

      // Retrieve and verify
      const retrieved = await service.getById(created.id);
      expect(retrieved?.embedding?.vector).toHaveLength(1536);
      if (firstOriginalValue !== undefined) {
        expect(retrieved?.embedding?.vector[0]).toBeCloseTo(firstOriginalValue, 5);
      }
    });

    it('should handle null embeddings', async () => {
      const memory: AgentMemory = {
        id: `test-mem-${Date.now()}`,
        version: 1,
        content: 'Memory without embedding',
        type: 'fact',
        source: { type: 'user', id: 'user-123', confidence: 1 },
        metadata: { importance: 0.5 },
        createdAt: new Date().toISOString(),
        accessedAt: new Date().toISOString(),
        accessCount: 0,
        verified: false,
      };

      const created = await service.create(memory);
      testMemoryIds.push(created.id);

      expect(created.embedding).toBeUndefined();

      const retrieved = await service.getById(created.id);
      expect(retrieved?.embedding).toBeUndefined();
    });
  });

  describe('Database Connection', () => {
    it('should use vector database client', async () => {
      // Verify that service uses vector client (not REST client)
      const db = getVectorClient();
      const result = await db.execute(sql`SELECT 1 as test`);

      expect(result).toBeDefined();
      // Vector client should be able to query agent_memories
      const tableExists = await db.execute(
        sql`SELECT EXISTS (
          SELECT FROM information_schema.tables
          WHERE table_name = 'agent_memories'
        ) as exists`,
      );

      expect(tableExists).toBeDefined();
    });
  });
});
