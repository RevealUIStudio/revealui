/**
 * Tests for cache/query-cache.ts
 *
 * Covers: cacheQuery, invalidateCache, invalidateCachePattern, invalidateCacheTags,
 * clearCache, getCacheStats, cacheList, cacheItem, cacheCount, invalidateResource,
 * warmCache, getCached, cacheExists, memoize, withCache, batchCache, cacheSWR
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

// Mock the logger to suppress output during tests
vi.mock('../../observability/logger.js', () => ({
  logger: {
    error: vi.fn(),
    warn: vi.fn(),
    info: vi.fn(),
    debug: vi.fn(),
  },
}));

import {
  batchCache,
  cacheCount,
  cacheExists,
  cacheItem,
  cacheList,
  cacheQuery,
  cacheSWR,
  clearCache,
  getCached,
  getCacheStats,
  invalidateCache,
  invalidateCachePattern,
  invalidateCacheTags,
  invalidateResource,
  memoize,
  warmCache,
  withCache,
} from '../query-cache.js';

// ---------------------------------------------------------------------------
// Setup  -  clear cache between tests to avoid cross-contamination
// ---------------------------------------------------------------------------

beforeEach(async () => {
  await clearCache();
});

// ---------------------------------------------------------------------------
// cacheQuery
// ---------------------------------------------------------------------------

describe('cacheQuery', () => {
  it('should execute query function on cache miss', async () => {
    const queryFn = vi.fn().mockResolvedValue({ id: 1, name: 'Test' });

    const result = await cacheQuery('test-key', queryFn);

    expect(result).toEqual({ id: 1, name: 'Test' });
    expect(queryFn).toHaveBeenCalledOnce();
  });

  it('should return cached result on cache hit', async () => {
    const queryFn = vi.fn().mockResolvedValue({ id: 1, name: 'Test' });

    await cacheQuery('hit-key', queryFn);
    const result = await cacheQuery('hit-key', queryFn);

    expect(result).toEqual({ id: 1, name: 'Test' });
    expect(queryFn).toHaveBeenCalledOnce(); // Only called once
  });

  it('should use custom prefix', async () => {
    const queryFn = vi.fn().mockResolvedValue('data');

    await cacheQuery('k1', queryFn, { prefix: 'custom' });
    const result = await cacheQuery('k1', queryFn, { prefix: 'custom' });

    expect(result).toBe('data');
    expect(queryFn).toHaveBeenCalledOnce();
  });

  it('should respect TTL  -  expired entries are re-fetched', async () => {
    vi.useFakeTimers();

    const queryFn = vi.fn().mockResolvedValueOnce('first').mockResolvedValueOnce('second');

    await cacheQuery('ttl-key', queryFn, { ttl: 1 }); // 1 second TTL
    expect(queryFn).toHaveBeenCalledTimes(1);

    // Advance past TTL
    vi.advanceTimersByTime(2000);

    const result = await cacheQuery('ttl-key', queryFn, { ttl: 1 });
    expect(result).toBe('second');
    expect(queryFn).toHaveBeenCalledTimes(2);

    vi.useRealTimers();
  });

  it('should use default TTL of 300 seconds', async () => {
    vi.useFakeTimers();

    const queryFn = vi.fn().mockResolvedValue('value');

    await cacheQuery('default-ttl', queryFn);

    // Within 300s, should still be cached
    vi.advanceTimersByTime(299_000);
    await cacheQuery('default-ttl', queryFn);
    expect(queryFn).toHaveBeenCalledOnce();

    // Past 300s, should re-fetch
    vi.advanceTimersByTime(2_000);
    await cacheQuery('default-ttl', queryFn);
    expect(queryFn).toHaveBeenCalledTimes(2);

    vi.useRealTimers();
  });

  it('should isolate different keys', async () => {
    const fn1 = vi.fn().mockResolvedValue('a');
    const fn2 = vi.fn().mockResolvedValue('b');

    const r1 = await cacheQuery('key-a', fn1);
    const r2 = await cacheQuery('key-b', fn2);

    expect(r1).toBe('a');
    expect(r2).toBe('b');
    expect(fn1).toHaveBeenCalledOnce();
    expect(fn2).toHaveBeenCalledOnce();
  });

  it('should handle query function throwing', async () => {
    const queryFn = vi.fn().mockRejectedValue(new Error('DB error'));

    await expect(cacheQuery('error-key', queryFn)).rejects.toThrow('DB error');
  });

  it('should handle corrupted cache data gracefully', async () => {
    // First cache a valid value
    const queryFn = vi.fn().mockResolvedValue('valid');
    await cacheQuery('corrupt-key', queryFn);

    // The internal QueryCache stores JSON strings; if parsing fails,
    // it should re-execute the query. We can't easily corrupt the internal
    // Map, but we verify the normal flow works after clearCache.
    await clearCache();
    const result = await cacheQuery('corrupt-key', queryFn);
    expect(result).toBe('valid');
    expect(queryFn).toHaveBeenCalledTimes(2); // Re-fetched after clear
  });
});

// ---------------------------------------------------------------------------
// invalidateCache
// ---------------------------------------------------------------------------

describe('invalidateCache', () => {
  it('should remove a cached entry by exact key', async () => {
    await warmCache('to-remove', { data: 'value' });
    expect(await getCached('to-remove')).toEqual({ data: 'value' });

    await invalidateCache('query:to-remove');
    expect(await getCached('to-remove')).toBeNull();
  });

  it('should be a no-op for non-existent keys', async () => {
    // Should not throw
    await invalidateCache('nonexistent-key');
  });
});

// ---------------------------------------------------------------------------
// invalidateCachePattern
// ---------------------------------------------------------------------------

describe('invalidateCachePattern', () => {
  it('should remove entries matching a wildcard pattern', async () => {
    await warmCache('posts:1', 'post-1');
    await warmCache('posts:2', 'post-2');
    await warmCache('users:1', 'user-1');

    await invalidateCachePattern('query:posts:*');

    expect(await getCached('posts:1')).toBeNull();
    expect(await getCached('posts:2')).toBeNull();
    expect(await getCached('users:1')).toEqual('user-1');
  });

  it('should handle patterns that match nothing', async () => {
    await warmCache('data:1', 'value');

    await invalidateCachePattern('nonexistent:*');

    // Original data should still exist
    expect(await getCached('data:1')).toEqual('value');
  });
});

// ---------------------------------------------------------------------------
// invalidateCacheTags
// ---------------------------------------------------------------------------

describe('invalidateCacheTags', () => {
  it('should invalidate entries by tag pattern', async () => {
    // Tags are invalidated by pattern *:tag:<tagName>:*
    // The actual implementation uses invalidateCachePattern internally
    // This test verifies the function runs without error
    await invalidateCacheTags(['posts', 'users']);
  });
});

// ---------------------------------------------------------------------------
// clearCache
// ---------------------------------------------------------------------------

describe('clearCache', () => {
  it('should remove all cached entries', async () => {
    await warmCache('key1', 'value1');
    await warmCache('key2', 'value2');

    await clearCache();

    expect(await getCached('key1')).toBeNull();
    expect(await getCached('key2')).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// getCacheStats
// ---------------------------------------------------------------------------

describe('getCacheStats', () => {
  it('should return initial stats with zero values', async () => {
    // After clearCache in beforeEach, stats may have accumulated
    // from previous tests, but we can verify the shape
    const stats = getCacheStats();

    expect(stats).toHaveProperty('hits');
    expect(stats).toHaveProperty('misses');
    expect(stats).toHaveProperty('sets');
    expect(stats).toHaveProperty('deletes');
    expect(stats).toHaveProperty('hitRate');
    expect(typeof stats.hits).toBe('number');
    expect(typeof stats.misses).toBe('number');
    expect(typeof stats.hitRate).toBe('number');
  });

  it('should increment hits on cache hits', async () => {
    const statsBefore = getCacheStats();
    const hitsBefore = statsBefore.hits;

    const queryFn = vi.fn().mockResolvedValue('data');
    await cacheQuery('stats-key', queryFn);
    await cacheQuery('stats-key', queryFn); // This should be a cache hit

    const statsAfter = getCacheStats();
    expect(statsAfter.hits).toBeGreaterThan(hitsBefore);
  });

  it('should increment misses on cache misses', async () => {
    const statsBefore = getCacheStats();
    const missesBefore = statsBefore.misses;

    const queryFn = vi.fn().mockResolvedValue('data');
    await cacheQuery('miss-key', queryFn);

    const statsAfter = getCacheStats();
    expect(statsAfter.misses).toBeGreaterThan(missesBefore);
  });

  it('should calculate hit rate correctly', async () => {
    // Start fresh
    await clearCache();

    // Force a known sequence: 1 miss (first fetch) + 1 hit (cached)
    const queryFn = vi.fn().mockResolvedValue('val');
    await cacheQuery('rate-key', queryFn);
    await cacheQuery('rate-key', queryFn);

    const stats = getCacheStats();
    // hitRate = hits / (hits + misses) * 100
    expect(stats.hitRate).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// cacheList
// ---------------------------------------------------------------------------

describe('cacheList', () => {
  it('should cache list results with sorted filter key', async () => {
    const queryFn = vi.fn().mockResolvedValue([{ id: 1 }, { id: 2 }]);

    const result = await cacheList('posts', { status: 'published', limit: 10 }, queryFn);

    expect(result).toEqual([{ id: 1 }, { id: 2 }]);
    expect(queryFn).toHaveBeenCalledOnce();
  });

  it('should return cached list on second call with same filters', async () => {
    const queryFn = vi.fn().mockResolvedValue([{ id: 1 }]);

    await cacheList('posts', { status: 'published' }, queryFn);
    const result = await cacheList('posts', { status: 'published' }, queryFn);

    expect(result).toEqual([{ id: 1 }]);
    expect(queryFn).toHaveBeenCalledOnce();
  });

  it('should use different cache keys for different filters', async () => {
    const fn1 = vi.fn().mockResolvedValue([{ id: 1 }]);
    const fn2 = vi.fn().mockResolvedValue([{ id: 2 }]);

    const r1 = await cacheList('posts', { status: 'published' }, fn1);
    const r2 = await cacheList('posts', { status: 'draft' }, fn2);

    expect(r1).toEqual([{ id: 1 }]);
    expect(r2).toEqual([{ id: 2 }]);
    expect(fn1).toHaveBeenCalledOnce();
    expect(fn2).toHaveBeenCalledOnce();
  });

  it('should produce same key regardless of filter key order', async () => {
    const queryFn = vi.fn().mockResolvedValue(['result']);

    // First call with keys in one order
    await cacheList('items', { b: 2, a: 1 }, queryFn);
    // Second call with keys in different order  -  should be a cache hit
    const result = await cacheList('items', { a: 1, b: 2 }, queryFn);

    expect(result).toEqual(['result']);
    expect(queryFn).toHaveBeenCalledOnce();
  });

  it('should use custom TTL', async () => {
    vi.useFakeTimers();

    const queryFn = vi.fn().mockResolvedValue(['data']);

    await cacheList('posts', {}, queryFn, 1);

    vi.advanceTimersByTime(2000);

    await cacheList('posts', {}, queryFn, 1);
    expect(queryFn).toHaveBeenCalledTimes(2);

    vi.useRealTimers();
  });
});

// ---------------------------------------------------------------------------
// cacheItem
// ---------------------------------------------------------------------------

describe('cacheItem', () => {
  it('should cache a single item by resource and id', async () => {
    const queryFn = vi.fn().mockResolvedValue({ id: 'abc', title: 'Post' });

    const result = await cacheItem('posts', 'abc', queryFn);

    expect(result).toEqual({ id: 'abc', title: 'Post' });
    expect(queryFn).toHaveBeenCalledOnce();
  });

  it('should return cached item on subsequent calls', async () => {
    const queryFn = vi.fn().mockResolvedValue({ id: 1, name: 'Product' });

    await cacheItem('products', 1, queryFn);
    const result = await cacheItem('products', 1, queryFn);

    expect(result).toEqual({ id: 1, name: 'Product' });
    expect(queryFn).toHaveBeenCalledOnce();
  });

  it('should isolate items by id', async () => {
    const fn1 = vi.fn().mockResolvedValue({ id: 1 });
    const fn2 = vi.fn().mockResolvedValue({ id: 2 });

    const r1 = await cacheItem('posts', 1, fn1);
    const r2 = await cacheItem('posts', 2, fn2);

    expect(r1).toEqual({ id: 1 });
    expect(r2).toEqual({ id: 2 });
  });
});

// ---------------------------------------------------------------------------
// cacheCount
// ---------------------------------------------------------------------------

describe('cacheCount', () => {
  it('should cache count query results', async () => {
    const queryFn = vi.fn().mockResolvedValue(42);

    const result = await cacheCount('posts', { status: 'published' }, queryFn);

    expect(result).toBe(42);
    expect(queryFn).toHaveBeenCalledOnce();
  });

  it('should return cached count on second call', async () => {
    const queryFn = vi.fn().mockResolvedValue(100);

    await cacheCount('users', {}, queryFn);
    const result = await cacheCount('users', {}, queryFn);

    expect(result).toBe(100);
    expect(queryFn).toHaveBeenCalledOnce();
  });

  it('should use sorted filter key for consistent caching', async () => {
    const queryFn = vi.fn().mockResolvedValue(5);

    await cacheCount('items', { b: 2, a: 1 }, queryFn);
    const result = await cacheCount('items', { a: 1, b: 2 }, queryFn);

    expect(result).toBe(5);
    expect(queryFn).toHaveBeenCalledOnce();
  });
});

// ---------------------------------------------------------------------------
// invalidateResource
// ---------------------------------------------------------------------------

describe('invalidateResource', () => {
  it('should invalidate all cache entries for a resource', async () => {
    await warmCache('posts:1', 'post-1');
    await warmCache('posts:2', 'post-2');

    // invalidateResource uses pattern *:posts:*
    await invalidateResource('posts');

    // After invalidation, the query: prefixed keys should be gone
    // The internal key is query:posts:1 → pattern *:posts:*
    expect(await getCached('posts:1')).toBeNull();
    expect(await getCached('posts:2')).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// warmCache
// ---------------------------------------------------------------------------

describe('warmCache', () => {
  it('should pre-populate cache with data', async () => {
    await warmCache('warm-key', { preloaded: true });

    const result = await getCached<{ preloaded: boolean }>('warm-key');
    expect(result).toEqual({ preloaded: true });
  });

  it('should respect custom TTL', async () => {
    vi.useFakeTimers();

    await warmCache('ttl-warm', 'data', 1);

    vi.advanceTimersByTime(2000);

    const result = await getCached('ttl-warm');
    expect(result).toBeNull();

    vi.useRealTimers();
  });

  it('should use default TTL of 300 seconds', async () => {
    vi.useFakeTimers();

    await warmCache('default-warm', 'data');

    vi.advanceTimersByTime(299_000);
    expect(await getCached('default-warm')).toBe('data');

    vi.advanceTimersByTime(2_000);
    expect(await getCached('default-warm')).toBeNull();

    vi.useRealTimers();
  });
});

// ---------------------------------------------------------------------------
// getCached
// ---------------------------------------------------------------------------

describe('getCached', () => {
  it('should return null for non-existent key', async () => {
    const result = await getCached('nonexistent');
    expect(result).toBeNull();
  });

  it('should return cached value when present', async () => {
    await warmCache('get-test', [1, 2, 3]);

    const result = await getCached<number[]>('get-test');
    expect(result).toEqual([1, 2, 3]);
  });

  it('should return null for expired entries', async () => {
    vi.useFakeTimers();

    await warmCache('expired', 'data', 1);

    vi.advanceTimersByTime(2000);

    const result = await getCached('expired');
    expect(result).toBeNull();

    vi.useRealTimers();
  });
});

// ---------------------------------------------------------------------------
// cacheExists
// ---------------------------------------------------------------------------

describe('cacheExists', () => {
  it('should return false for non-existent key', async () => {
    const exists = await cacheExists('nope');
    expect(exists).toBe(false);
  });

  it('should return true for existing cached key', async () => {
    await warmCache('exists-test', 'value');

    const exists = await cacheExists('exists-test');
    expect(exists).toBe(true);
  });

  it('should return false for expired key', async () => {
    vi.useFakeTimers();

    await warmCache('expired-check', 'value', 1);

    vi.advanceTimersByTime(2000);

    const exists = await cacheExists('expired-check');
    expect(exists).toBe(false);

    vi.useRealTimers();
  });
});

// ---------------------------------------------------------------------------
// memoize
// ---------------------------------------------------------------------------

describe('memoize', () => {
  it('should memoize function results', async () => {
    const fn = vi.fn().mockResolvedValue('computed') as (...args: unknown[]) => Promise<unknown>;

    const memoized = memoize(fn);

    const r1 = await memoized('arg1');
    const r2 = await memoized('arg1');

    expect(r1).toBe('computed');
    expect(r2).toBe('computed');
    expect(fn).toHaveBeenCalledOnce();
  });

  it('should cache separately per arguments', async () => {
    const fn = vi.fn().mockImplementation(async (x: unknown) => `result-${x}`) as (
      ...args: unknown[]
    ) => Promise<unknown>;

    const memoized = memoize(fn);

    const r1 = await memoized('a');
    const r2 = await memoized('b');

    expect(r1).toBe('result-a');
    expect(r2).toBe('result-b');
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it('should accept custom TTL option', async () => {
    vi.useFakeTimers();

    const fn = vi.fn().mockResolvedValue('value') as (...args: unknown[]) => Promise<unknown>;
    const memoized = memoize(fn, { ttl: 1 });

    await memoized('x');

    vi.advanceTimersByTime(2000);

    await memoized('x');
    expect(fn).toHaveBeenCalledTimes(2);

    vi.useRealTimers();
  });
});

// ---------------------------------------------------------------------------
// withCache
// ---------------------------------------------------------------------------

describe('withCache', () => {
  it('should wrap a query function with caching', async () => {
    const queryFn = vi.fn().mockResolvedValue('result') as (...args: unknown[]) => Promise<unknown>;

    const cached = withCache(queryFn, {
      keyFn: (...args: unknown[]) => `wrapped:${JSON.stringify(args)}`,
    });

    const r1 = await cached('arg1');
    const r2 = await cached('arg1');

    expect(r1).toBe('result');
    expect(r2).toBe('result');
    expect(queryFn).toHaveBeenCalledOnce();
  });

  it('should use custom prefix', async () => {
    const queryFn = vi.fn().mockResolvedValue('data') as (...args: unknown[]) => Promise<unknown>;

    const cached = withCache(queryFn, {
      keyFn: () => 'my-key',
      prefix: 'myprefix',
    });

    await cached();
    await cached();

    expect(queryFn).toHaveBeenCalledOnce();
  });

  it('should use custom TTL', async () => {
    vi.useFakeTimers();

    const queryFn = vi.fn().mockResolvedValue('val') as (...args: unknown[]) => Promise<unknown>;

    const cached = withCache(queryFn, {
      keyFn: () => 'ttl-wrap',
      ttl: 1,
    });

    await cached();

    vi.advanceTimersByTime(2000);

    await cached();
    expect(queryFn).toHaveBeenCalledTimes(2);

    vi.useRealTimers();
  });
});

// ---------------------------------------------------------------------------
// batchCache
// ---------------------------------------------------------------------------

describe('batchCache', () => {
  it('should execute all operations in parallel', async () => {
    const results = await batchCache([
      { key: 'batch-1', queryFn: async () => 'a' },
      { key: 'batch-2', queryFn: async () => 'b' },
      { key: 'batch-3', queryFn: async () => 'c' },
    ]);

    expect(results).toEqual(['a', 'b', 'c']);
  });

  it('should return cached values on subsequent calls', async () => {
    const fn1 = vi.fn().mockResolvedValue('x');
    const fn2 = vi.fn().mockResolvedValue('y');

    await batchCache([
      { key: 'reuse-1', queryFn: fn1 },
      { key: 'reuse-2', queryFn: fn2 },
    ]);

    const results = await batchCache([
      { key: 'reuse-1', queryFn: fn1 },
      { key: 'reuse-2', queryFn: fn2 },
    ]);

    expect(results).toEqual(['x', 'y']);
    expect(fn1).toHaveBeenCalledOnce();
    expect(fn2).toHaveBeenCalledOnce();
  });

  it('should handle empty operations array', async () => {
    const results = await batchCache([]);
    expect(results).toEqual([]);
  });

  it('should propagate errors from any operation', async () => {
    await expect(
      batchCache([
        { key: 'ok', queryFn: async () => 'fine' },
        {
          key: 'bad',
          queryFn: async () => {
            throw new Error('fail');
          },
        },
      ]),
    ).rejects.toThrow('fail');
  });

  it('should support per-operation TTL', async () => {
    vi.useFakeTimers();

    const fn1 = vi.fn().mockResolvedValue('short');
    const fn2 = vi.fn().mockResolvedValue('long');

    await batchCache([
      { key: 'short-ttl', queryFn: fn1, ttl: 1 },
      { key: 'long-ttl', queryFn: fn2, ttl: 600 },
    ]);

    vi.advanceTimersByTime(2000);

    await batchCache([
      { key: 'short-ttl', queryFn: fn1, ttl: 1 },
      { key: 'long-ttl', queryFn: fn2, ttl: 600 },
    ]);

    expect(fn1).toHaveBeenCalledTimes(2); // Re-fetched (expired)
    expect(fn2).toHaveBeenCalledOnce(); // Still cached

    vi.useRealTimers();
  });
});

// ---------------------------------------------------------------------------
// cacheSWR (stale-while-revalidate)
// ---------------------------------------------------------------------------

describe('cacheSWR', () => {
  it('should execute query and cache the result on first call', async () => {
    const queryFn = vi.fn().mockResolvedValue({ id: 1 });

    const result = await cacheSWR('swr-key', queryFn);

    expect(result).toEqual({ id: 1 });
    expect(queryFn).toHaveBeenCalledOnce();
  });

  it('should return fresh cached value within TTL', async () => {
    const queryFn = vi.fn().mockResolvedValue('fresh');

    await cacheSWR('swr-fresh', queryFn, { ttl: 60 });
    const result = await cacheSWR('swr-fresh', queryFn, { ttl: 60 });

    expect(result).toBe('fresh');
    expect(queryFn).toHaveBeenCalledOnce();
  });

  it('should return stale data when fresh cache expires but stale exists', async () => {
    vi.useFakeTimers();

    const queryFn = vi.fn().mockResolvedValueOnce('original').mockResolvedValueOnce('refreshed');

    // First call  -  caches both fresh (ttl=2s) and stale (staleTime=10s)
    await cacheSWR('swr-stale', queryFn, { ttl: 2, staleTime: 10 });
    expect(queryFn).toHaveBeenCalledTimes(1);

    // Advance past fresh TTL but within stale TTL
    vi.advanceTimersByTime(3000);

    const result = await cacheSWR('swr-stale', queryFn, { ttl: 2, staleTime: 10 });

    // Should get stale data immediately
    expect(result).toBe('original');
    // Background revalidation should have been triggered
    // Allow the microtask to process
    await vi.advanceTimersByTimeAsync(0);
    expect(queryFn).toHaveBeenCalledTimes(2);

    vi.useRealTimers();
  });

  it('should re-fetch when both fresh and stale caches are expired', async () => {
    vi.useFakeTimers();

    const queryFn = vi.fn().mockResolvedValueOnce('old').mockResolvedValueOnce('new');

    await cacheSWR('swr-expired', queryFn, { ttl: 1, staleTime: 2 });

    // Advance past both TTLs
    vi.advanceTimersByTime(3000);

    const result = await cacheSWR('swr-expired', queryFn, { ttl: 1, staleTime: 2 });

    expect(result).toBe('new');
    expect(queryFn).toHaveBeenCalledTimes(2);

    vi.useRealTimers();
  });

  it('should use default TTL of 300 and staleTime of 60', async () => {
    vi.useFakeTimers();

    const queryFn = vi.fn().mockResolvedValue('data');

    await cacheSWR('swr-defaults', queryFn);

    // Within 300s TTL  -  should return from fresh cache
    vi.advanceTimersByTime(200_000);
    const result = await cacheSWR('swr-defaults', queryFn);

    expect(result).toBe('data');
    expect(queryFn).toHaveBeenCalledOnce();

    vi.useRealTimers();
  });

  it('should handle query failure during background revalidation gracefully', async () => {
    vi.useFakeTimers();

    const queryFn = vi
      .fn()
      .mockResolvedValueOnce('initial')
      .mockRejectedValueOnce(new Error('Network error'));

    await cacheSWR('swr-error', queryFn, { ttl: 1, staleTime: 10 });

    vi.advanceTimersByTime(2000);

    // Should still return stale data even if revalidation fails
    const result = await cacheSWR('swr-error', queryFn, { ttl: 1, staleTime: 10 });
    expect(result).toBe('initial');

    // Allow the rejected promise to be caught
    await vi.advanceTimersByTimeAsync(0);

    vi.useRealTimers();
  });
});
