/**
 * Query Result Caching
 *
 * In-memory Map-based cache for database queries. No external dependencies
 * (Redis, Memcached, etc.)  -  RevealUI uses PostgreSQL + ElectricSQL/PGlite
 * for all persistence and sync.
 */

import { logger } from '../observability/logger.js';

interface CacheOptions {
  ttl?: number; // Time to live in seconds
  prefix?: string; // Cache key prefix
  tags?: string[]; // Cache tags for invalidation
}

interface CacheStats {
  hits: number;
  misses: number;
  sets: number;
  deletes: number;
  hitRate: number;
}

class QueryCache {
  private cache = new Map<string, { value: string; expires: number }>();
  private stats: CacheStats = {
    hits: 0,
    misses: 0,
    sets: 0,
    deletes: 0,
    hitRate: 0,
  };

  get(key: string): string | null {
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

  set(key: string, value: string, ttlSeconds: number): void {
    this.cache.set(key, {
      value,
      expires: Date.now() + ttlSeconds * 1000,
    });
    this.stats.sets++;
  }

  del(...keys: string[]): number {
    let deleted = 0;
    for (const key of keys) {
      if (this.cache.delete(key)) {
        deleted++;
        this.stats.deletes++;
      }
    }
    return deleted;
  }

  keys(pattern: string): string[] {
    const startsWild = pattern.startsWith('*');
    const endsWild = pattern.endsWith('*');
    const core = pattern.slice(startsWild ? 1 : 0, endsWild ? -1 : undefined);

    return Array.from(this.cache.keys()).filter((key) => {
      if (startsWild && endsWild) return key.includes(core);
      if (startsWild) return key.endsWith(core);
      if (endsWild) return key.startsWith(core);
      return key === core;
    });
  }

  clear(): void {
    this.cache.clear();
  }

  getStats(): CacheStats {
    return { ...this.stats };
  }

  private updateHitRate(): void {
    const total = this.stats.hits + this.stats.misses;
    this.stats.hitRate = total > 0 ? (this.stats.hits / total) * 100 : 0;
  }
}

const cache = new QueryCache();

/**
 * Cache a query result
 */
export async function cacheQuery<T>(
  key: string,
  queryFn: () => Promise<T>,
  options: CacheOptions = {},
): Promise<T> {
  const {
    ttl = 300, // 5 minutes default
    prefix = 'query',
  } = options;

  const cacheKey = `${prefix}:${key}`;

  // Try cache first
  const cached = cache.get(cacheKey);
  if (cached) {
    try {
      return JSON.parse(cached) as T;
    } catch (error) {
      logger.error('Cache parse error', error instanceof Error ? error : new Error(String(error)));
      // Continue to execute query
    }
  }

  // Execute query
  const result = await queryFn();

  // Cache result
  try {
    cache.set(cacheKey, JSON.stringify(result), ttl);
  } catch (error) {
    logger.error('Cache set error', error instanceof Error ? error : new Error(String(error)));
    // Continue even if caching fails
  }

  return result;
}

/**
 * Invalidate cache by key
 */
export function invalidateCache(key: string): void {
  cache.del(key);
}

/**
 * Invalidate cache by pattern
 */
export function invalidateCachePattern(pattern: string): void {
  const keys = cache.keys(pattern);
  if (keys.length > 0) {
    cache.del(...keys);
  }
}

/**
 * Invalidate cache by tags
 */
export function invalidateCacheTags(tags: string[]): void {
  for (const tag of tags) {
    invalidateCachePattern(`*:tag:${tag}:*`);
  }
}

/**
 * Clear all cache
 */
export function clearCache(): void {
  cache.clear();
}

/**
 * Get cache statistics
 */
export function getCacheStats(): CacheStats {
  return cache.getStats();
}

/**
 * Cache for list queries
 */
export async function cacheList<T>(
  resource: string,
  filters: Record<string, unknown>,
  queryFn: () => Promise<T[]>,
  ttl = 300,
): Promise<T[]> {
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
export async function cacheItem<T>(
  resource: string,
  id: string | number,
  queryFn: () => Promise<T>,
  ttl = 300,
): Promise<T> {
  const cacheKey = `item:${resource}:${id}`;

  return cacheQuery(cacheKey, queryFn, { ttl, prefix: 'item' });
}

/**
 * Cache for count queries
 */
export async function cacheCount(
  resource: string,
  filters: Record<string, unknown>,
  queryFn: () => Promise<number>,
  ttl = 300,
): Promise<number> {
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
export function invalidateResource(resource: string): void {
  invalidateCachePattern(`*:${resource}:*`);
}

/**
 * Warm cache with data
 */
export function warmCache<T>(key: string, data: T, ttl = 300): void {
  cache.set(`query:${key}`, JSON.stringify(data), ttl);
}

/**
 * Get cached value without executing query
 */
export function getCached<T>(key: string): T | null {
  const cached = cache.get(`query:${key}`);
  if (!cached) return null;

  try {
    return JSON.parse(cached) as T;
  } catch {
    return null;
  }
}

/**
 * Check if key exists in cache
 */
export function cacheExists(key: string): boolean {
  const cached = cache.get(`query:${key}`);
  return cached !== null;
}

/**
 * Memoize function with cache
 */
export function memoize<T extends (...args: unknown[]) => Promise<unknown>>(
  fn: T,
  options: CacheOptions = {},
): T {
  return (async (...args: unknown[]) => {
    const key = `memoize:${fn.name}:${JSON.stringify(args)}`;
    return cacheQuery(key, () => fn(...args), options);
  }) as T;
}

/**
 * Create cache wrapper for query function
 */
export function withCache<T extends (...args: unknown[]) => Promise<unknown>>(
  queryFn: T,
  options: {
    keyFn: (...args: Parameters<T>) => string;
    ttl?: number;
    prefix?: string;
  },
): T {
  return (async (...args: unknown[]) => {
    const key = options.keyFn(...(args as Parameters<T>));
    return cacheQuery(key, () => queryFn(...args), {
      ttl: options.ttl,
      prefix: options.prefix,
    });
  }) as T;
}

/**
 * Batch cache operations
 */
export async function batchCache<T>(
  operations: Array<{
    key: string;
    queryFn: () => Promise<T>;
    ttl?: number;
  }>,
): Promise<T[]> {
  return Promise.all(operations.map(({ key, queryFn, ttl }) => cacheQuery(key, queryFn, { ttl })));
}

/**
 * Cache with stale-while-revalidate pattern
 */
export async function cacheSWR<T>(
  key: string,
  queryFn: () => Promise<T>,
  options: {
    ttl?: number;
    staleTime?: number;
  } = {},
): Promise<T> {
  const { ttl = 300, staleTime = 60 } = options;

  const cacheKey = `query:${key}`;
  const staleKey = `${cacheKey}:stale`;

  // Try fresh cache
  const cached = cache.get(cacheKey);
  if (cached) {
    return JSON.parse(cached) as T;
  }

  // Try stale cache while revalidating
  const stale = cache.get(staleKey);
  if (stale) {
    // Return stale data immediately
    const staleData = JSON.parse(stale) as T;

    // Revalidate in background
    queryFn()
      .then((fresh) => {
        cache.set(cacheKey, JSON.stringify(fresh), ttl);
        cache.set(staleKey, JSON.stringify(fresh), staleTime);
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
  cache.set(cacheKey, JSON.stringify(result), ttl);
  cache.set(staleKey, JSON.stringify(result), staleTime);

  return result;
}
