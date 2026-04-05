/**
 * In-Memory Cache Store
 *
 * Map-backed cache store. Fast, zero-dependency, single-instance only.
 * Use for development, testing, or when distributed state isn't needed.
 */

import type { CacheStore } from './types.js';

interface MemoryEntry {
  value: string; // JSON-serialized
  expiresAt: number;
  tags: string[];
}

export class InMemoryCacheStore implements CacheStore {
  private store = new Map<string, MemoryEntry>();
  private maxEntries: number;

  constructor(options?: { maxEntries?: number }) {
    this.maxEntries = options?.maxEntries ?? 10_000;
  }

  async get<T = unknown>(key: string): Promise<T | null> {
    const entry = this.store.get(key);
    if (!entry) return null;

    if (Date.now() > entry.expiresAt) {
      this.store.delete(key);
      return null;
    }

    return JSON.parse(entry.value) as T;
  }

  async set<T = unknown>(
    key: string,
    value: T,
    ttlSeconds: number,
    tags?: string[],
  ): Promise<void> {
    // Evict oldest if at capacity
    if (this.store.size >= this.maxEntries && !this.store.has(key)) {
      const firstKey = this.store.keys().next().value;
      if (firstKey !== undefined) {
        this.store.delete(firstKey);
      }
    }

    this.store.set(key, {
      value: JSON.stringify(value),
      expiresAt: Date.now() + ttlSeconds * 1000,
      tags: tags ?? [],
    });
  }

  async delete(...keys: string[]): Promise<number> {
    let count = 0;
    for (const key of keys) {
      if (this.store.delete(key)) count++;
    }
    return count;
  }

  async deleteByPrefix(prefix: string): Promise<number> {
    let count = 0;
    for (const key of this.store.keys()) {
      if (key.startsWith(prefix)) {
        this.store.delete(key);
        count++;
      }
    }
    return count;
  }

  async deleteByTags(tags: string[]): Promise<number> {
    const tagSet = new Set(tags);
    let count = 0;
    for (const [key, entry] of this.store.entries()) {
      if (entry.tags.some((t) => tagSet.has(t))) {
        this.store.delete(key);
        count++;
      }
    }
    return count;
  }

  async clear(): Promise<void> {
    this.store.clear();
  }

  async size(): Promise<number> {
    // Count only non-expired entries
    const now = Date.now();
    let count = 0;
    for (const entry of this.store.values()) {
      if (entry.expiresAt > now) count++;
    }
    return count;
  }

  async prune(): Promise<number> {
    const now = Date.now();
    let pruned = 0;
    for (const [key, entry] of this.store.entries()) {
      if (entry.expiresAt <= now) {
        this.store.delete(key);
        pruned++;
      }
    }
    return pruned;
  }

  async close(): Promise<void> {
    this.store.clear();
  }
}
