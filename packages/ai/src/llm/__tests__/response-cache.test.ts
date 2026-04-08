/**
 * Tests for Response Cache
 */

import { beforeEach, describe, expect, it } from 'vitest';
import type { Message } from '../providers/base.js';
import {
  type CachedResponse,
  calculateResponseCacheSavings,
  clearGlobalResponseCache,
  getGlobalResponseCache,
  ResponseCache,
} from '../response-cache.js';

describe('ResponseCache', () => {
  let cache: ResponseCache;

  beforeEach(() => {
    cache = new ResponseCache({ max: 10, ttl: 1000 });
  });

  describe('getCacheKey', () => {
    it('should generate consistent keys for same input', () => {
      const messages: Message[] = [
        { role: 'user', content: 'Hello' },
        { role: 'assistant', content: 'Hi there!' },
      ];

      const key1 = cache.getCacheKey(messages);
      const key2 = cache.getCacheKey(messages);

      expect(key1).toBe(key2);
      expect(key1).toHaveLength(64); // SHA-256 hex length
    });

    it('should generate different keys for different messages', () => {
      const messages1: Message[] = [{ role: 'user', content: 'Hello' }];
      const messages2: Message[] = [{ role: 'user', content: 'Goodbye' }];

      const key1 = cache.getCacheKey(messages1);
      const key2 = cache.getCacheKey(messages2);

      expect(key1).not.toBe(key2);
    });

    it('should include options in key generation', () => {
      const messages: Message[] = [{ role: 'user', content: 'Hello' }];

      const key1 = cache.getCacheKey(messages, { temperature: 0.7 });
      const key2 = cache.getCacheKey(messages, { temperature: 0.9 });

      expect(key1).not.toBe(key2);
    });

    it('should normalize messages (ignore cacheControl)', () => {
      const messages1: Message[] = [{ role: 'system', content: 'You are helpful' }];
      const messages2: Message[] = [
        { role: 'system', content: 'You are helpful', cacheControl: { type: 'ephemeral' } },
      ];

      const key1 = cache.getCacheKey(messages1);
      const key2 = cache.getCacheKey(messages2);

      // Should be same since cacheControl is not included in cache key
      expect(key1).toBe(key2);
    });
  });

  describe('get/set', () => {
    it('should store and retrieve responses', () => {
      const key = 'test-key';
      const response: CachedResponse = {
        content: 'Hello!',
        role: 'assistant',
        timestamp: Date.now(),
      };

      cache.set(key, response);
      const retrieved = cache.get(key);

      expect(retrieved).toEqual(response);
    });

    it('should return undefined for non-existent keys', () => {
      const retrieved = cache.get('non-existent');
      expect(retrieved).toBeUndefined();
    });

    it('should auto-set timestamp if missing', () => {
      const key = 'test-key';
      const response: CachedResponse = {
        content: 'Hello!',
        role: 'assistant',
        timestamp: 0, // Will be set automatically
      };

      const beforeSet = Date.now();
      cache.set(key, response);
      const retrieved = cache.get(key);
      const afterSet = Date.now();

      expect(retrieved?.timestamp).toBeGreaterThanOrEqual(beforeSet);
      expect(retrieved?.timestamp).toBeLessThanOrEqual(afterSet);
    });
  });

  describe('has', () => {
    it('should return true for existing keys', () => {
      const key = 'test-key';
      const response: CachedResponse = {
        content: 'Hello!',
        role: 'assistant',
        timestamp: Date.now(),
      };

      cache.set(key, response);
      expect(cache.has(key)).toBe(true);
    });

    it('should return false for non-existent keys', () => {
      expect(cache.has('non-existent')).toBe(false);
    });
  });

  describe('delete', () => {
    it('should remove entries', () => {
      const key = 'test-key';
      const response: CachedResponse = {
        content: 'Hello!',
        role: 'assistant',
        timestamp: Date.now(),
      };

      cache.set(key, response);
      expect(cache.has(key)).toBe(true);

      cache.delete(key);
      expect(cache.has(key)).toBe(false);
    });

    it('should return false for non-existent keys', () => {
      expect(cache.delete('non-existent')).toBe(false);
    });
  });

  describe('clear', () => {
    it('should remove all entries', () => {
      cache.set('key1', { content: 'A', role: 'assistant', timestamp: Date.now() });
      cache.set('key2', { content: 'B', role: 'assistant', timestamp: Date.now() });

      expect(cache.size).toBe(2);

      cache.clear();

      expect(cache.size).toBe(0);
      expect(cache.has('key1')).toBe(false);
      expect(cache.has('key2')).toBe(false);
    });
  });

  describe('statistics', () => {
    it('should track hits and misses', () => {
      const key = 'test-key';
      cache.set(key, { content: 'Hello!', role: 'assistant', timestamp: Date.now() });

      // Hit
      cache.get(key);
      // Miss
      cache.get('non-existent');
      // Another hit
      cache.get(key);

      const stats = cache.getStats();
      expect(stats.hits).toBe(2);
      expect(stats.misses).toBe(1);
      expect(stats.hitRate).toBeCloseTo(66.67, 1);
    });

    it('should track cache size', () => {
      expect(cache.size).toBe(0);

      cache.set('key1', { content: 'A', role: 'assistant', timestamp: Date.now() });
      expect(cache.size).toBe(1);

      cache.set('key2', { content: 'B', role: 'assistant', timestamp: Date.now() });
      expect(cache.size).toBe(2);

      cache.delete('key1');
      expect(cache.size).toBe(1);
    });

    it('should calculate hit rate correctly', () => {
      const key = 'test-key';
      cache.set(key, { content: 'Hello!', role: 'assistant', timestamp: Date.now() });

      // 100% hit rate
      cache.get(key);
      expect(cache.getStats().hitRate).toBe(100);

      // 50% hit rate
      cache.get('non-existent');
      expect(cache.getStats().hitRate).toBe(50);
    });

    it('should reset statistics', () => {
      cache.set('key1', { content: 'A', role: 'assistant', timestamp: Date.now() });
      cache.get('key1');
      cache.get('non-existent');

      expect(cache.getStats().hits).toBe(1);
      expect(cache.getStats().misses).toBe(1);

      cache.resetStats();

      const stats = cache.getStats();
      expect(stats.hits).toBe(0);
      expect(stats.misses).toBe(0);
      expect(stats.hitRate).toBe(0);
    });
  });

  describe('LRU eviction', () => {
    it('should evict oldest entries when max size exceeded', () => {
      // Cache max size is 10
      for (let i = 0; i < 12; i++) {
        cache.set(`key${i}`, { content: `${i}`, role: 'assistant', timestamp: Date.now() });
      }

      // Should have evicted first 2 entries
      expect(cache.size).toBe(10);
      expect(cache.has('key0')).toBe(false);
      expect(cache.has('key1')).toBe(false);
      expect(cache.has('key11')).toBe(true);
    });

    it('should track evictions', () => {
      for (let i = 0; i < 12; i++) {
        cache.set(`key${i}`, { content: `${i}`, role: 'assistant', timestamp: Date.now() });
      }

      const stats = cache.getStats();
      expect(stats.evictions).toBe(2);
    });
  });

  describe('TTL expiration', () => {
    it('should expire entries after TTL', async () => {
      const shortCache = new ResponseCache({ max: 10, ttl: 50 }); // 50ms TTL

      shortCache.set('key1', { content: 'A', role: 'assistant', timestamp: Date.now() });
      expect(shortCache.has('key1')).toBe(true);

      // Wait for expiration
      await new Promise((resolve) => setTimeout(resolve, 100));

      expect(shortCache.get('key1')).toBeUndefined();
    });
  });
});

describe('Global Response Cache', () => {
  beforeEach(() => {
    clearGlobalResponseCache();
  });

  it('should return singleton instance', () => {
    const cache1 = getGlobalResponseCache();
    const cache2 = getGlobalResponseCache();

    expect(cache1).toBe(cache2);
  });

  it('should share state across instances', () => {
    const cache1 = getGlobalResponseCache();
    const cache2 = getGlobalResponseCache();

    cache1.set('key1', { content: 'A', role: 'assistant', timestamp: Date.now() });

    expect(cache2.has('key1')).toBe(true);
    expect(cache2.get('key1')?.content).toBe('A');
  });

  it('should clear global cache', () => {
    const cache = getGlobalResponseCache();
    cache.set('key1', { content: 'A', role: 'assistant', timestamp: Date.now() });

    clearGlobalResponseCache();

    expect(cache.size).toBe(0);
  });
});

describe('calculateResponseCacheSavings', () => {
  it('should calculate savings correctly', () => {
    const stats = {
      hits: 100,
      misses: 50,
      evictions: 10,
      hitRate: 66.67,
      size: 40,
    };

    const pricing = {
      avgInputTokens: 3000,
      avgOutputTokens: 500,
      inputCostPerM: 3.0,
      outputCostPerM: 15.0,
    };

    const savings = calculateResponseCacheSavings(stats, pricing);

    // 100 hits * (3000 input + 500 output) = 350,000 tokens
    expect(savings.tokensAvoided).toBe(350_000);
    expect(savings.requestsAvoided).toBe(100);

    // (100 * 3000 * $3) / 1M + (100 * 500 * $15) / 1M
    // = $0.90 + $0.75 = $1.65
    expect(savings.totalSaved).toBeCloseTo(1.65, 2);
  });

  it('should handle zero hits', () => {
    const stats = {
      hits: 0,
      misses: 100,
      evictions: 0,
      hitRate: 0,
      size: 0,
    };

    const pricing = {
      avgInputTokens: 3000,
      avgOutputTokens: 500,
      inputCostPerM: 3.0,
      outputCostPerM: 15.0,
    };

    const savings = calculateResponseCacheSavings(stats, pricing);

    expect(savings.tokensAvoided).toBe(0);
    expect(savings.requestsAvoided).toBe(0);
    expect(savings.totalSaved).toBe(0);
  });
});
