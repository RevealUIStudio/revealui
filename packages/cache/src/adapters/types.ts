/**
 * Cache Store Adapter Interface
 *
 * Unified interface for pluggable cache backends.
 * Implementations: InMemoryCacheStore (Map), PGliteCacheStore (PostgreSQL-compatible).
 */

export interface CacheEntry<T = unknown> {
  key: string;
  value: T;
  expiresAt: number; // Unix timestamp in ms
  tags?: string[];
}

export interface CacheStore {
  /** Get a cached value by key. Returns null if missing or expired. */
  get<T = unknown>(key: string): Promise<T | null>;

  /** Set a value with TTL in seconds. Overwrites existing entries. */
  set<T = unknown>(key: string, value: T, ttlSeconds: number, tags?: string[]): Promise<void>;

  /** Delete one or more keys. Returns count of deleted entries. */
  delete(...keys: string[]): Promise<number>;

  /** Delete all entries whose key starts with the given prefix. */
  deleteByPrefix(prefix: string): Promise<number>;

  /** Delete all entries tagged with any of the given tags. */
  deleteByTags(tags: string[]): Promise<number>;

  /** Remove all entries from the store. */
  clear(): Promise<void>;

  /** Return approximate number of live (non-expired) entries. */
  size(): Promise<number>;

  /** Clean up expired entries. Called periodically or on demand. */
  prune(): Promise<number>;

  /** Tear down the store (close connections, free resources). */
  close(): Promise<void>;
}
