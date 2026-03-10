/**
 * In-Memory Storage
 *
 * Simple in-memory storage implementation for development
 * Data is lost on server restart
 */

import type { Storage } from './interface.js'

interface StorageEntry {
  value: string
  expiresAt?: number
}

export class InMemoryStorage implements Storage {
  private store: Map<string, StorageEntry> = new Map()

  async get(key: string): Promise<string | null> {
    const entry = this.store.get(key)

    if (!entry) {
      return null
    }

    // Check if expired
    if (entry.expiresAt && entry.expiresAt < Date.now()) {
      this.store.delete(key)
      return null
    }

    return entry.value
  }

  async set(key: string, value: string, ttlSeconds?: number): Promise<void> {
    const entry: StorageEntry = {
      value,
      ...(ttlSeconds && { expiresAt: Date.now() + ttlSeconds * 1000 }),
    }

    this.store.set(key, entry)
  }

  async del(key: string): Promise<void> {
    this.store.delete(key)
  }

  async incr(key: string): Promise<number> {
    // Read and write synchronously on the Map to avoid yielding to the event loop
    // between read and write (same approach as atomicUpdate).
    const now = Date.now()
    const entry = this.store.get(key)
    const current = entry && (!entry.expiresAt || entry.expiresAt >= now) ? entry.value : null
    const newValue = current ? parseInt(current, 10) + 1 : 1
    // Preserve the original TTL if the entry exists
    this.store.set(key, { value: String(newValue), expiresAt: entry?.expiresAt })
    return newValue
  }

  async exists(key: string): Promise<boolean> {
    const entry = this.store.get(key)

    if (!entry) {
      return false
    }

    // Check if expired
    if (entry.expiresAt && entry.expiresAt < Date.now()) {
      this.store.delete(key)
      return false
    }

    return true
  }

  async atomicUpdate(
    key: string,
    updater: (existing: string | null) => { value: string; ttlSeconds: number },
  ): Promise<void> {
    // Read synchronously from the Map to avoid yielding to the event loop between
    // read and write (JavaScript is single-threaded; no I/O = no interleaving).
    const now = Date.now()
    const entry = this.store.get(key)
    const existing = entry && (!entry.expiresAt || entry.expiresAt >= now) ? entry.value : null
    const { value, ttlSeconds } = updater(existing)
    this.store.set(key, { value, expiresAt: now + ttlSeconds * 1000 })
  }

  /**
   * Clean up expired entries (should be called periodically)
   */
  cleanup(): void {
    const now = Date.now()
    for (const [key, entry] of this.store.entries()) {
      if (entry.expiresAt && entry.expiresAt < now) {
        this.store.delete(key)
      }
    }
  }

  /**
   * Clear all entries (for testing)
   */
  clear(): void {
    this.store.clear()
  }
}
