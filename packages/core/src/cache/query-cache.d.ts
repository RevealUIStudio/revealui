/**
 * Query Result Caching with Redis
 *
 * Implements multi-layer caching for database queries
 */
interface CacheOptions {
    ttl?: number;
    prefix?: string;
    tags?: string[];
}
interface CacheStats {
    hits: number;
    misses: number;
    sets: number;
    deletes: number;
    hitRate: number;
}
/**
 * Cache a query result
 */
export declare function cacheQuery<T>(key: string, queryFn: () => Promise<T>, options?: CacheOptions): Promise<T>;
/**
 * Invalidate cache by key
 */
export declare function invalidateCache(key: string): Promise<void>;
/**
 * Invalidate cache by pattern
 */
export declare function invalidateCachePattern(pattern: string): Promise<void>;
/**
 * Invalidate cache by tags
 */
export declare function invalidateCacheTags(tags: string[]): Promise<void>;
/**
 * Clear all cache
 */
export declare function clearCache(): Promise<void>;
/**
 * Get cache statistics
 */
export declare function getCacheStats(): CacheStats;
/**
 * Cache for list queries
 */
export declare function cacheList<T>(resource: string, filters: Record<string, unknown>, queryFn: () => Promise<T[]>, ttl?: number): Promise<T[]>;
/**
 * Cache for single item queries
 */
export declare function cacheItem<T>(resource: string, id: string | number, queryFn: () => Promise<T>, ttl?: number): Promise<T>;
/**
 * Cache for count queries
 */
export declare function cacheCount(resource: string, filters: Record<string, unknown>, queryFn: () => Promise<number>, ttl?: number): Promise<number>;
/**
 * Invalidate resource cache
 */
export declare function invalidateResource(resource: string): Promise<void>;
/**
 * Warm cache with data
 */
export declare function warmCache<T>(key: string, data: T, ttl?: number): Promise<void>;
/**
 * Get cached value without executing query
 */
export declare function getCached<T>(key: string): Promise<T | null>;
/**
 * Check if key exists in cache
 */
export declare function cacheExists(key: string): Promise<boolean>;
/**
 * Memoize function with cache
 */
export declare function memoize<T extends (...args: unknown[]) => Promise<unknown>>(fn: T, options?: CacheOptions): T;
/**
 * Create cache wrapper for query function
 */
export declare function withCache<T extends (...args: unknown[]) => Promise<unknown>>(queryFn: T, options: {
    keyFn: (...args: Parameters<T>) => string;
    ttl?: number;
    prefix?: string;
}): T;
/**
 * Batch cache operations
 */
export declare function batchCache<T>(operations: Array<{
    key: string;
    queryFn: () => Promise<T>;
    ttl?: number;
}>): Promise<T[]>;
/**
 * Cache with stale-while-revalidate pattern
 */
export declare function cacheSWR<T>(key: string, queryFn: () => Promise<T>, options?: {
    ttl?: number;
    staleTime?: number;
}): Promise<T>;
export {};
//# sourceMappingURL=query-cache.d.ts.map