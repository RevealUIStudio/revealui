/**
 * LRU Cache with TTL (Time To Live)
 *
 * Provides a cache implementation with:
 * - TTL (Time To Live) expiration
 * - Size limits with LRU eviction
 * - Type-safe generic interface
 *
 * @example
 * ```typescript
 * const cache = new LRUCache<string, User>({ maxSize: 100, ttlMs: 5 * 60 * 1000 })
 * const user = await cache.fetch('user:123', () => fetchUserFromDB('123'))
 * ```
 */

export interface LRUCacheOptions {
	/**
	 * Maximum number of entries in the cache
	 * @default 100
	 */
	maxSize?: number;

	/**
	 * Time to live in milliseconds
	 * @default 5 minutes (300000)
	 */
	ttlMs?: number;
}

interface CacheEntry<T> {
	data: T;
	expiresAt: number;
	lastAccessed: number;
}

/**
 * LRU Cache with TTL for storing key-value pairs
 *
 * Features:
 * - Automatic expiration based on TTL
 * - Size limits with LRU (Least Recently Used) eviction
 * - Type-safe generic interface
 */
export class LRUCache<K = string, V = unknown> {
	private cache = new Map<K, CacheEntry<V>>();
	private readonly maxSize: number;
	private readonly ttlMs: number;

	constructor(options: LRUCacheOptions = {}) {
		this.maxSize = options.maxSize ?? 100;
		this.ttlMs = options.ttlMs ?? 5 * 60 * 1000; // 5 minutes default
	}

	/**
	 * Fetch a value from cache or compute it using the fetcher function
	 *
	 * @param key - Cache key
	 * @param fetcher - Function to fetch the value if not in cache
	 * @returns The cached or newly fetched value
	 */
	async fetch(key: K, fetcher: () => Promise<V> | V): Promise<V> {
		const now = Date.now();
		const cached = this.cache.get(key);

		// Check if cached entry exists and is still valid
		if (cached && cached.expiresAt > now) {
			// Update last accessed time for LRU
			cached.lastAccessed = now;
			return cached.data;
		}

		// Remove expired entry if present
		if (cached) {
			this.cache.delete(key);
		}

		// Evict least recently used entries if at capacity
		this.evictIfNeeded();

		// Fetch fresh data
		const data = await fetcher();
		this.cache.set(key, {
			data,
			expiresAt: now + this.ttlMs,
			lastAccessed: now,
		});

		return data;
	}

	/**
	 * Get a value from cache without fetching (returns undefined if not found or expired)
	 *
	 * @param key - Cache key
	 * @returns The cached value or undefined
	 */
	get(key: K): V | undefined {
		const now = Date.now();
		const cached = this.cache.get(key);

		if (cached && cached.expiresAt > now) {
			cached.lastAccessed = now;
			return cached.data;
		}

		// Remove expired entry
		if (cached) {
			this.cache.delete(key);
		}

		return undefined;
	}

	/**
	 * Set a value in the cache
	 *
	 * @param key - Cache key
	 * @param value - Value to cache
	 */
	set(key: K, value: V): void {
		const now = Date.now();
		this.evictIfNeeded();

		this.cache.set(key, {
			data: value,
			expiresAt: now + this.ttlMs,
			lastAccessed: now,
		});
	}

	/**
	 * Delete a value from the cache
	 *
	 * @param key - Cache key
	 * @returns true if the entry was deleted, false if it didn't exist
	 */
	delete(key: K): boolean {
		return this.cache.delete(key);
	}

	/**
	 * Clear all entries from the cache
	 */
	clear(): void {
		this.cache.clear();
	}

	/**
	 * Get the current size of the cache
	 */
	get size(): number {
		return this.cache.size;
	}

	/**
	 * Evict expired entries and LRU entries if at capacity
	 */
	private evictIfNeeded(): void {
		const now = Date.now();

		// First, remove all expired entries
		for (const [key, entry] of this.cache.entries()) {
			if (entry.expiresAt <= now) {
				this.cache.delete(key);
			}
		}

		// If still at capacity, remove least recently used entry
		if (this.cache.size >= this.maxSize) {
			let lruKey: K | undefined;
			let lruTime = Infinity;

			for (const [key, entry] of this.cache.entries()) {
				if (entry.lastAccessed < lruTime) {
					lruTime = entry.lastAccessed;
					lruKey = key;
				}
			}

			if (lruKey !== undefined) {
				this.cache.delete(lruKey);
			}
		}
	}

	/**
	 * Clean up expired entries (can be called periodically)
	 */
	cleanup(): void {
		const now = Date.now();
		for (const [key, entry] of this.cache.entries()) {
			if (entry.expiresAt <= now) {
				this.cache.delete(key);
			}
		}
	}
}
