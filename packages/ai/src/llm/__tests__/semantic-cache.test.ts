/**
 * Tests for SemanticCache
 *
 * Verifies vector-based similarity caching functionality
 */

import { beforeEach, describe, expect, test, vi } from 'vitest';
import type { Memory } from '../../memory/vector/types.js';
import type { VectorMemoryService } from '../../memory/vector/vector-memory-service.js';
import { calculateSemanticCacheSavings, SemanticCache } from '../semantic-cache.js';

// Mock dependencies
vi.mock('../../embeddings/index.js', () => ({
  generateEmbedding: vi.fn(async (_text: string) => ({
    vector: new Array(1536).fill(0).map((_, i) => i / 1536), // Deterministic vector
    model: 'text-embedding-3-small',
    usage: { promptTokens: 10, totalTokens: 10 },
  })),
}));

vi.mock('../../memory/vector/vector-memory-service.js', () => {
  return {
    // biome-ignore lint/suspicious/noExplicitAny: vi mock constructor requires `this: any` to assign properties dynamically
    VectorMemoryService: vi.fn(function (this: any) {
      this.searchSimilar = vi.fn();
      this.create = vi.fn();
    }),
  };
});

describe('SemanticCache', () => {
  let cache: SemanticCache;
  let mockVectorService: VectorMemoryService;

  beforeEach(() => {
    vi.clearAllMocks();
    cache = new SemanticCache({
      similarityThreshold: 0.95,
      ttl: 60 * 60 * 1000, // 1 hour
      enableStats: true,
    });
    // biome-ignore lint/suspicious/noExplicitAny: accessing private internal property in test  -  no public API available
    mockVectorService = (cache as any).vectorService;
  });

  describe('get()', () => {
    test('should return undefined on cache miss', async () => {
      // Mock: No similar results found
      vi.spyOn(mockVectorService, 'searchSimilar').mockResolvedValue([]);

      const result = await cache.get('How do I reset my password?');

      expect(result).toBeUndefined();
      expect(mockVectorService.searchSimilar).toHaveBeenCalledWith(
        expect.any(Array),
        expect.objectContaining({
          limit: 1,
          threshold: 0.95,
          userId: 'global',
          siteId: 'global',
          type: 'semantic_cache',
        }),
      );
    });

    test('should return cached response on cache hit', async () => {
      const mockMemory: Memory = {
        id: 'mem-1',
        userId: 'global',
        siteId: 'global',
        content: 'How do I reset my password?',
        embedding: {
          vector: new Array(1536).fill(0.5),
          model: 'text-embedding-3-small',
        },
        type: 'fact',
        metadata: {
          siteId: 'global',
          importance: 0.5,
          tags: ['cache', 'llm_response'],
          custom: {
            response: 'Go to Settings > Security > Reset Password',
            usage: {
              promptTokens: 100,
              completionTokens: 50,
              totalTokens: 150,
            },
            cachedAt: Date.now(),
            cacheType: 'semantic',
          },
        },
        source: {
          type: 'system',
          id: 'semantic-cache',
          context: 'semantic_cache',
          confidence: 1,
        },
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      // Mock: Similar result found
      vi.spyOn(mockVectorService, 'searchSimilar').mockResolvedValue([
        {
          memory: mockMemory,
          similarity: 0.98,
          distance: 0.02,
        },
      ]);

      const result = await cache.get('How can I reset my password?');

      expect(result).toBeDefined();
      expect(result?.query).toBe('How do I reset my password?');
      expect(result?.response).toBe('Go to Settings > Security > Reset Password');
      expect(result?.similarity).toBe(0.98);
      expect(result?.usage).toEqual({
        promptTokens: 100,
        completionTokens: 50,
        totalTokens: 150,
      });
    });

    test('should respect similarity threshold', async () => {
      const lowSimilarityCache = new SemanticCache({
        similarityThreshold: 0.99, // Very high threshold
      });
      // biome-ignore lint/suspicious/noExplicitAny: accessing private internal property in test  -  no public API available
      const mockService = (lowSimilarityCache as any).vectorService;

      // Mock: No results above threshold
      vi.spyOn(mockService, 'searchSimilar').mockResolvedValue([]);

      const result = await lowSimilarityCache.get('Similar but not identical query');

      expect(result).toBeUndefined();
      expect(mockService.searchSimilar).toHaveBeenCalledWith(
        expect.any(Array),
        expect.objectContaining({ threshold: 0.99 }),
      );
    });

    test('should reject expired cache entries', async () => {
      const expiredMemory: Memory = {
        id: 'mem-1',
        userId: 'global',
        siteId: 'global',
        content: 'Old query',
        embedding: {
          vector: new Array(1536).fill(0.5),
          model: 'text-embedding-3-small',
        },
        type: 'fact',
        metadata: {
          siteId: 'global',
          importance: 0.5,
          tags: ['cache', 'llm_response'],
          custom: {
            response: 'Old response',
            cachedAt: Date.now() - 2 * 60 * 60 * 1000,
            cacheType: 'semantic',
          },
        },
        source: {
          type: 'system',
          id: 'semantic-cache',
          context: 'semantic_cache',
          confidence: 1,
        },
        createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000), // 2 hours ago
        updatedAt: new Date(Date.now() - 2 * 60 * 60 * 1000),
      };

      vi.spyOn(mockVectorService, 'searchSimilar').mockResolvedValue([
        {
          memory: expiredMemory,
          similarity: 0.98,
          distance: 0.02,
        },
      ]);

      const result = await cache.get('Old query');

      expect(result).toBeUndefined(); // Should be rejected due to TTL
    });

    test('should track statistics on cache hit', async () => {
      const mockMemory: Memory = {
        id: 'mem-1',
        userId: 'global',
        siteId: 'global',
        content: 'Test query',
        embedding: {
          vector: new Array(1536).fill(0.5),
          model: 'text-embedding-3-small',
        },
        type: 'fact',
        metadata: {
          siteId: 'global',
          importance: 0.5,
          tags: ['cache', 'llm_response'],
          custom: {
            response: 'Test response',
            cachedAt: Date.now(),
            cacheType: 'semantic',
          },
        },
        source: {
          type: 'system',
          id: 'semantic-cache',
          context: 'semantic_cache',
          confidence: 1,
        },
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      vi.spyOn(mockVectorService, 'searchSimilar').mockResolvedValue([
        {
          memory: mockMemory,
          similarity: 0.97,
          distance: 0.03,
        },
      ]);

      await cache.get('Test query');

      const stats = cache.getStats();
      expect(stats.hits).toBe(1);
      expect(stats.misses).toBe(0);
      expect(stats.hitRate).toBe(100);
      expect(stats.avgSimilarity).toBe(0.97);
    });

    test('should track statistics on cache miss', async () => {
      vi.spyOn(mockVectorService, 'searchSimilar').mockResolvedValue([]);

      await cache.get('Unknown query');

      const stats = cache.getStats();
      expect(stats.hits).toBe(0);
      expect(stats.misses).toBe(1);
      expect(stats.hitRate).toBe(0);
    });

    test('should handle errors gracefully', async () => {
      vi.spyOn(mockVectorService, 'searchSimilar').mockRejectedValue(new Error('Database error'));

      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const result = await cache.get('Query that causes error');

      expect(result).toBeUndefined();
      expect(consoleErrorSpy).toHaveBeenCalled();
      const logOutput = String(consoleErrorSpy.mock.calls[0]?.[0] ?? '');
      expect(logOutput).toContain('Semantic cache error');
      expect(logOutput).toContain('Database error');

      consoleErrorSpy.mockRestore();
    });
  });

  describe('set()', () => {
    test('should store query and response in vector database', async () => {
      const storeSpy = vi.spyOn(mockVectorService, 'create').mockResolvedValue();

      await cache.set('How do I reset my password?', 'Go to Settings > Security', {
        promptTokens: 100,
        completionTokens: 50,
        totalTokens: 150,
      });

      expect(storeSpy).toHaveBeenCalledWith({
        version: 1,
        content: 'How do I reset my password?',
        embedding: expect.any(Object),
        type: 'fact',
        source: {
          type: 'system',
          id: 'semantic-cache',
          context: 'semantic_cache',
          confidence: 1,
        },
        metadata: {
          siteId: 'global',
          importance: 0.5,
          tags: ['cache', 'llm_response'],
          custom: {
            response: 'Go to Settings > Security',
            usage: {
              promptTokens: 100,
              completionTokens: 50,
              totalTokens: 150,
            },
            cachedAt: expect.any(Number),
            cacheType: 'semantic',
          },
        },
        accessCount: 0,
        verified: false,
      });
    });

    test('should store without usage stats', async () => {
      const storeSpy = vi.spyOn(mockVectorService, 'create').mockResolvedValue();

      await cache.set('Simple query', 'Simple response');

      expect(storeSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          content: 'Simple query',
          type: 'fact',
          metadata: expect.objectContaining({
            custom: {
              response: 'Simple response',
              usage: undefined,
              cachedAt: expect.any(Number),
              cacheType: 'semantic',
            },
          }),
        }),
      );
    });

    test('should handle storage errors gracefully', async () => {
      vi.spyOn(mockVectorService, 'create').mockRejectedValue(new Error('Storage error'));

      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      // Should not throw
      await expect(cache.set('Query', 'Response')).resolves.toBeUndefined();

      expect(consoleErrorSpy).toHaveBeenCalled();
      const logOutput = String(consoleErrorSpy.mock.calls[0]?.[0] ?? '');
      expect(logOutput).toContain('Failed to store in semantic cache');
      expect(logOutput).toContain('Storage error');

      consoleErrorSpy.mockRestore();
    });
  });

  describe('extractQuery()', () => {
    test('should combine user messages into query string', () => {
      const messages = [
        { role: 'system' as const, content: 'You are a helpful assistant.' },
        { role: 'user' as const, content: 'Hello' },
        { role: 'assistant' as const, content: 'Hi there!' },
        { role: 'user' as const, content: 'How are you?' },
      ];

      const query = cache.extractQuery(messages);

      expect(query).toBe('Hello How are you?');
    });

    test('should handle empty messages array', () => {
      const query = cache.extractQuery([]);
      expect(query).toBe('');
    });

    test('should handle messages with only system/assistant roles', () => {
      const messages = [
        { role: 'system' as const, content: 'System prompt' },
        { role: 'assistant' as const, content: 'Assistant message' },
      ];

      const query = cache.extractQuery(messages);
      expect(query).toBe('');
    });
  });

  describe('getStats()', () => {
    test('should return accurate statistics', async () => {
      const mockMemory: Memory = {
        id: 'mem-1',
        userId: 'global',
        siteId: 'global',
        content: 'Query',
        embedding: {
          vector: new Array(1536).fill(0.5),
          model: 'text-embedding-3-small',
        },
        type: 'fact',
        metadata: {
          siteId: 'global',
          importance: 0.5,
          tags: ['cache', 'llm_response'],
          custom: {
            response: 'Response',
            cachedAt: Date.now(),
            cacheType: 'semantic',
          },
        },
        source: {
          type: 'system',
          id: 'semantic-cache',
          context: 'semantic_cache',
          confidence: 1,
        },
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      // 3 hits
      vi.spyOn(mockVectorService, 'searchSimilar').mockResolvedValue([
        { memory: mockMemory, similarity: 0.98, distance: 0.02 },
      ]);
      await cache.get('Query 1');
      await cache.get('Query 2');
      await cache.get('Query 3');

      // 2 misses
      vi.spyOn(mockVectorService, 'searchSimilar').mockResolvedValue([]);
      await cache.get('Unknown 1');
      await cache.get('Unknown 2');

      const stats = cache.getStats();

      expect(stats.hits).toBe(3);
      expect(stats.misses).toBe(2);
      expect(stats.totalQueries).toBe(5);
      expect(stats.hitRate).toBe(60); // 3/5 = 60%
      expect(stats.avgSimilarity).toBe(0.98);
    });

    test('should handle zero queries', () => {
      const stats = cache.getStats();

      expect(stats.hits).toBe(0);
      expect(stats.misses).toBe(0);
      expect(stats.totalQueries).toBe(0);
      expect(stats.hitRate).toBe(0);
      expect(stats.avgSimilarity).toBe(0);
    });
  });

  describe('resetStats()', () => {
    test('should reset all statistics', async () => {
      const mockMemory: Memory = {
        id: 'mem-1',
        userId: 'global',
        siteId: 'global',
        content: 'Query',
        embedding: {
          vector: new Array(1536).fill(0.5),
          model: 'text-embedding-3-small',
        },
        type: 'fact',
        metadata: {
          siteId: 'global',
          importance: 0.5,
          tags: ['cache', 'llm_response'],
          custom: {
            response: 'Response',
            cachedAt: Date.now(),
            cacheType: 'semantic',
          },
        },
        source: {
          type: 'system',
          id: 'semantic-cache',
          context: 'semantic_cache',
          confidence: 1,
        },
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      vi.spyOn(mockVectorService, 'searchSimilar').mockResolvedValue([
        { memory: mockMemory, similarity: 0.98, distance: 0.02 },
      ]);
      await cache.get('Query');

      // Verify stats are non-zero
      let stats = cache.getStats();
      expect(stats.hits).toBe(1);

      // Reset
      cache.resetStats();

      // Verify stats are zeroed
      stats = cache.getStats();
      expect(stats.hits).toBe(0);
      expect(stats.misses).toBe(0);
      expect(stats.totalQueries).toBe(0);
      expect(stats.hitRate).toBe(0);
      expect(stats.avgSimilarity).toBe(0);
    });
  });

  describe('warmCache()', () => {
    test('should pre-populate cache with FAQ entries', async () => {
      const setSpy = vi.spyOn(mockVectorService, 'create').mockResolvedValue();

      const faqEntries = [
        { query: 'How do I reset my password?', response: 'Go to Settings...' },
        { query: 'What are your hours?', response: 'We are open 9-5...' },
        { query: 'Where is my order?', response: 'Check Order Status...' },
      ];

      await cache.warmCache(faqEntries);

      expect(setSpy).toHaveBeenCalledTimes(3);
      expect(setSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          content: 'How do I reset my password?',
          type: 'fact',
          metadata: expect.objectContaining({
            custom: expect.objectContaining({
              response: 'Go to Settings...',
            }),
          }),
        }),
      );
    });
  });

  describe('multi-tenant support', () => {
    test('should isolate cache by userId and siteId', async () => {
      const userCache = new SemanticCache({
        userId: 'user-123',
        siteId: 'site-456',
      });
      // biome-ignore lint/suspicious/noExplicitAny: accessing private internal property in test  -  no public API available
      const mockService = (userCache as any).vectorService;
      const searchSpy = vi.spyOn(mockService, 'searchSimilar').mockResolvedValue([]);

      await userCache.get('Test query');

      expect(searchSpy).toHaveBeenCalledWith(
        expect.any(Array),
        expect.objectContaining({
          userId: 'user-123',
          siteId: 'site-456',
          type: 'semantic_cache',
        }),
      );
    });
  });
});

describe('calculateSemanticCacheSavings()', () => {
  test('should calculate cost savings accurately', () => {
    const stats = {
      hits: 100,
      misses: 50,
      hitRate: 66.67,
      avgSimilarity: 0.97,
      totalQueries: 150,
    };

    const savings = calculateSemanticCacheSavings(stats, {
      avgTokensPerQuery: 3500,
      costPerMTokens: 3.0,
    });

    expect(savings.queriesAvoided).toBe(100);
    expect(savings.tokensAvoided).toBe(350000); // 100 * 3500
    expect(savings.totalSaved).toBe(1.05); // (350000 * 3.0) / 1,000,000
  });

  test('should handle zero hits', () => {
    const stats = {
      hits: 0,
      misses: 100,
      hitRate: 0,
      avgSimilarity: 0,
      totalQueries: 100,
    };

    const savings = calculateSemanticCacheSavings(stats, {
      avgTokensPerQuery: 3500,
      costPerMTokens: 3.0,
    });

    expect(savings.queriesAvoided).toBe(0);
    expect(savings.tokensAvoided).toBe(0);
    expect(savings.totalSaved).toBe(0);
  });
});
