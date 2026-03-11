/**
 * Storage Interface
 *
 * Abstract interface for storage backends (in-memory, Redis, database)
 */

export interface Storage {
  /**
   * Get a value by key
   */
  get(key: string): Promise<string | null>;

  /**
   * Set a value with optional TTL (time to live in seconds)
   */
  set(key: string, value: string, ttlSeconds?: number): Promise<void>;

  /**
   * Delete a value by key
   */
  del(key: string): Promise<void>;

  /**
   * Increment a numeric value
   */
  incr(key: string): Promise<number>;

  /**
   * Check if a key exists
   */
  exists(key: string): Promise<boolean>;

  /**
   * Get multiple values by keys
   */
  mget?(keys: string[]): Promise<(string | null)[]>;

  /**
   * Set multiple key-value pairs
   */
  mset?(pairs: Array<[string, string]>, ttlSeconds?: number): Promise<void>;

  /**
   * Atomically read and update a value.
   * The updater receives the current value (or null) and returns the new value + TTL.
   * Implementations that support DB transactions should do so; others fall back to
   * a non-atomic get-then-set, which is safe for low-concurrency scenarios.
   */
  atomicUpdate?(
    key: string,
    updater: (existing: string | null) => { value: string; ttlSeconds: number },
  ): Promise<void>;
}
