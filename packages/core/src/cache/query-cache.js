/**
 * Query Result Caching with Redis
 *
 * Implements multi-layer caching for database queries
 */
import { logger } from '@revealui/core/observability/logger';

// Mock Redis for now - replace with actual Redis connection
class RedisCache {
  cache = new Map();
  stats = {
    hits: 0,
    misses: 0,
    sets: 0,
    deletes: 0,
    hitRate: 0,
  };
  async get(key) {
    const entry = this.cache.get(key);
    if (!entry) {
      this.stats.misses++;
      this.updateHitRate();
      return null;
    }
    if (Date.now() > entry.expires) {
      this.cache.delete(key);
      this.stats.misses++;
      this.updateHitRate();
      return null;
    }
    this.stats.hits++;
    this.updateHitRate();
    return entry.value;
  }
  async set(key, value, ttl) {
    this.cache.set(key, {
      value,
      expires: Date.now() + ttl * 1000,
    });
    this.stats.sets++;
  }
  async setex(key, ttl, value) {
    await this.set(key, value, ttl);
  }
  async del(...keys) {
    let deleted = 0;
    for (const key of keys) {
      if (this.cache.delete(key)) {
        deleted++;
        this.stats.deletes++;
      }
    }
    return deleted;
  }
  async keys(pattern) {
    const regex = new RegExp(pattern.replace('*', '.*'));
    return Array.from(this.cache.keys()).filter((key) => regex.test(key));
  }
  async flushall() {
    this.cache.clear();
  }
  getStats() {
    return { ...this.stats };
  }
  updateHitRate() {
    const total = this.stats.hits + this.stats.misses;
    this.stats.hitRate = total > 0 ? (this.stats.hits / total) * 100 : 0;
  }
}
const redis = new RedisCache();
/**
 * Cache a query result
 */
export async function cacheQuery(key, queryFn, options = {}) {
  const {
    ttl = 300, // 5 minutes default
    prefix = 'query',
  } = options;
  const cacheKey = `${prefix}:${key}`;
  // Try cache first
  const cached = await redis.get(cacheKey);
  if (cached) {
    try {
      return JSON.parse(cached);
    } catch (error) {
      logger.error('Cache parse error', error instanceof Error ? error : new Error(String(error)));
      // Continue to execute query
    }
  }
  // Execute query
  const result = await queryFn();
  // Cache result
  try {
    await redis.setex(cacheKey, ttl, JSON.stringify(result));
  } catch (error) {
    logger.error('Cache set error', error instanceof Error ? error : new Error(String(error)));
    // Continue even if caching fails
  }
  return result;
}
/**
 * Invalidate cache by key
 */
export async function invalidateCache(key) {
  await redis.del(key);
}
/**
 * Invalidate cache by pattern
 */
export async function invalidateCachePattern(pattern) {
  const keys = await redis.keys(pattern);
  if (keys.length > 0) {
    await redis.del(...keys);
  }
}
/**
 * Invalidate cache by tags
 */
export async function invalidateCacheTags(tags) {
  for (const tag of tags) {
    await invalidateCachePattern(`*:tag:${tag}:*`);
  }
}
/**
 * Clear all cache
 */
export async function clearCache() {
  await redis.flushall();
}
/**
 * Get cache statistics
 */
export function getCacheStats() {
  return redis.getStats();
}
/**
 * Cache for list queries
 */
export async function cacheList(resource, filters, queryFn, ttl = 300) {
  const filterKey = Object.entries(filters)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${k}=${v}`)
    .join('&');
  const cacheKey = `list:${resource}:${filterKey}`;
  return cacheQuery(cacheKey, queryFn, { ttl, prefix: 'list' });
}
/**
 * Cache for single item queries
 */
export async function cacheItem(resource, id, queryFn, ttl = 300) {
  const cacheKey = `item:${resource}:${id}`;
  return cacheQuery(cacheKey, queryFn, { ttl, prefix: 'item' });
}
/**
 * Cache for count queries
 */
export async function cacheCount(resource, filters, queryFn, ttl = 300) {
  const filterKey = Object.entries(filters)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${k}=${v}`)
    .join('&');
  const cacheKey = `count:${resource}:${filterKey}`;
  return cacheQuery(cacheKey, queryFn, { ttl, prefix: 'count' });
}
/**
 * Invalidate resource cache
 */
export async function invalidateResource(resource) {
  await invalidateCachePattern(`*:${resource}:*`);
}
/**
 * Warm cache with data
 */
export async function warmCache(key, data, ttl = 300) {
  await redis.setex(`query:${key}`, ttl, JSON.stringify(data));
}
/**
 * Get cached value without executing query
 */
export async function getCached(key) {
  const cached = await redis.get(`query:${key}`);
  if (!cached) return null;
  try {
    return JSON.parse(cached);
  } catch {
    return null;
  }
}
/**
 * Check if key exists in cache
 */
export async function cacheExists(key) {
  const cached = await redis.get(`query:${key}`);
  return cached !== null;
}
/**
 * Memoize function with cache
 */
export function memoize(fn, options = {}) {
  return async (...args) => {
    const key = `memoize:${fn.name}:${JSON.stringify(args)}`;
    return cacheQuery(key, () => fn(...args), options);
  };
}
/**
 * Create cache wrapper for query function
 */
export function withCache(queryFn, options) {
  return async (...args) => {
    const key = options.keyFn(...args);
    return cacheQuery(key, () => queryFn(...args), {
      ttl: options.ttl,
      prefix: options.prefix,
    });
  };
}
/**
 * Batch cache operations
 */
export async function batchCache(operations) {
  return Promise.all(operations.map(({ key, queryFn, ttl }) => cacheQuery(key, queryFn, { ttl })));
}
/**
 * Cache with stale-while-revalidate pattern
 */
export async function cacheSWR(key, queryFn, options = {}) {
  const { ttl = 300, staleTime = 60 } = options;
  const cacheKey = `query:${key}`;
  const staleKey = `${cacheKey}:stale`;
  // Try fresh cache
  const cached = await redis.get(cacheKey);
  if (cached) {
    return JSON.parse(cached);
  }
  // Try stale cache while revalidating
  const stale = await redis.get(staleKey);
  if (stale) {
    // Return stale data immediately
    const staleData = JSON.parse(stale);
    // Revalidate in background
    queryFn()
      .then((fresh) => {
        redis.setex(cacheKey, ttl, JSON.stringify(fresh));
        redis.setex(staleKey, staleTime, JSON.stringify(fresh));
      })
      .catch((error) => {
        logger.error(
          'SWR revalidation error',
          error instanceof Error ? error : new Error(String(error)),
        );
      });
    return staleData;
  }
  // No cache, execute query
  const result = await queryFn();
  // Cache both fresh and stale
  await Promise.all([
    redis.setex(cacheKey, ttl, JSON.stringify(result)),
    redis.setex(staleKey, staleTime, JSON.stringify(result)),
  ]);
  return result;
}
//# sourceMappingURL=query-cache.js.map
