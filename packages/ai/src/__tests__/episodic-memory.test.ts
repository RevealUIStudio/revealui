import type { AgentMemory } from '@revealui/contracts/agents';
import type { Database } from '@revealui/db/client';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { EpisodicMemory } from '../memory/stores/episodic-memory.js';

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
    create = vi.fn().mockImplementation((memory: AgentMemory) => Promise.resolve(memory));
    getById = vi.fn().mockResolvedValue(mockMemory);
    update = vi.fn().mockResolvedValue({ ...mockMemory, accessCount: 1 });
    delete = vi.fn().mockResolvedValue(true);
    searchSimilar = vi.fn().mockResolvedValue([]);
  }

  return {
    VectorMemoryService: MockVectorMemoryService,
  };
});

// Mock database
const mockDb = {
  query: {
    agentMemories: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
    },
  },
  insert: vi.fn().mockReturnValue({
    values: vi.fn(),
  }),
  delete: vi.fn().mockReturnValue({
    where: vi.fn(),
  }),
  update: vi.fn().mockReturnValue({
    set: vi.fn().mockReturnValue({
      where: vi.fn(),
    }),
  }),
  execute: vi.fn().mockResolvedValue([]), // Add execute method for raw SQL queries
} as unknown as Database;

describe('EpisodicMemory', () => {
  let memory: EpisodicMemory;
  const userId = 'user-123';
  const nodeId = 'node-abc';

  beforeEach(() => {
    memory = new EpisodicMemory(userId, nodeId, mockDb);
    vi.clearAllMocks();
  });

  describe('Memory Operations', () => {
    const testMemory: AgentMemory = {
      id: 'mem-1',
      version: 1,
      content: 'User prefers dark theme',
      type: 'preference',
      source: {
        type: 'user',
        id: userId,
        confidence: 1,
      },
      metadata: {
        importance: 0.8,
      },
      createdAt: new Date().toISOString(),
      accessedAt: new Date().toISOString(),
      accessCount: 0,
      verified: false,
    };

    const testMemoryWithEmbedding: AgentMemory = {
      ...testMemory,
      id: 'mem-2',
      embedding: {
        model: 'openai-text-embedding-3-small',
        vector: Array(1536).fill(0.1),
        dimension: 1536,
        generatedAt: new Date().toISOString(),
      },
    };

    it('should add a memory', async () => {
      mockDb.insert.mockReturnValue({
        values: vi.fn().mockResolvedValue(undefined),
      });

      const tag = await memory.add(testMemory);
      expect(tag).toBeTruthy();
      expect(memory.getMemoryIds()).toContain('mem-1');
    });

    it('should add a memory with embedding', async () => {
      mockDb.insert.mockReturnValue({
        values: vi.fn().mockResolvedValue(undefined),
      });

      const tag = await memory.add(testMemoryWithEmbedding);
      expect(tag).toBeTruthy();
      expect(memory.getMemoryIds()).toContain('mem-2');
    });

    it('should remove a memory by tag', () => {
      // First add it (without DB for this test)
      const tag = memory.memories.add('mem-1');
      const removed = memory.remove(tag);
      expect(removed).toBe(true);
      expect(memory.getMemoryIds()).not.toContain('mem-1');
    });

    it('should remove a memory by ID', async () => {
      // Add memory ID to ORSet
      memory.memories.add('mem-1');

      mockDb.delete.mockReturnValue({
        where: vi.fn().mockResolvedValue(undefined),
      });

      const count = await memory.removeById('mem-1');
      expect(count).toBeGreaterThan(0);
      expect(memory.getMemoryIds()).not.toContain('mem-1');
    });

    it('should get memory IDs', () => {
      memory.memories.add('mem-1');
      memory.memories.add('mem-2');
      const ids = memory.getMemoryIds();
      expect(ids).toContain('mem-1');
      expect(ids).toContain('mem-2');
    });
  });

  describe('Access Counter', () => {
    it('should increment access counter', async () => {
      const initialCount = memory.getAccessCount();
      await memory.incrementAccess();
      expect(memory.getAccessCount()).toBe(initialCount + 1);
    });

    it('should get access count', () => {
      memory.accessCounter.increment(5);
      expect(memory.getAccessCount()).toBe(5);
    });
  });

  describe('Merge Operations', () => {
    it('should merge two EpisodicMemory instances', () => {
      const memory1 = new EpisodicMemory(userId, 'node-1', mockDb);
      const memory2 = new EpisodicMemory(userId, 'node-2', mockDb);

      memory1.memories.add('mem-1');
      memory2.memories.add('mem-2');

      const merged = memory1.merge(memory2);
      const ids = merged.getMemoryIds();
      expect(ids).toContain('mem-1');
      expect(ids).toContain('mem-2');
    });

    it('should merge access counters', () => {
      const memory1 = new EpisodicMemory(userId, 'node-1', mockDb);
      const memory2 = new EpisodicMemory(userId, 'node-2', mockDb);

      memory1.accessCounter.increment(10);
      memory2.accessCounter.increment(5);

      const merged = memory1.merge(memory2);
      expect(merged.getAccessCount()).toBe(15);
    });
  });

  describe('Serialization', () => {
    it('should serialize to data', () => {
      memory.memories.add('mem-1');
      memory.accessCounter.increment(5);
      const data = memory.toData();
      expect(data.userId).toBe(userId);
      expect(data.nodeId).toBe(nodeId);
      expect(data.memories).toBeDefined();
      expect(data.accessCounter).toBeDefined();
    });

    it('should deserialize from data', () => {
      memory.memories.add('mem-1');
      const data = memory.toData();
      const restored = EpisodicMemory.fromData(data, mockDb);
      expect(restored.getMemoryIds()).toEqual(memory.getMemoryIds());
    });

    it('should clone EpisodicMemory', () => {
      memory.memories.add('mem-1');
      const cloned = memory.clone();
      expect(cloned.getMemoryIds()).toEqual(memory.getMemoryIds());
      expect(cloned).not.toBe(memory);
    });
  });

  describe('Getters', () => {
    it('should get user ID', () => {
      expect(memory.getUserId()).toBe(userId);
    });

    it('should get node ID', () => {
      expect(memory.getNodeId()).toBe(nodeId);
    });
  });
});
