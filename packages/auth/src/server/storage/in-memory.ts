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
      expiresAt: ttlSeconds ? Date.now() + ttlSeconds * 1000 : undefined,
    }

    this.store.set(key, entry)
  }

  async del(key: string): Promise<void> {
    this.store.delete(key)
  }

  async incr(key: string): Promise<number> {
    const current = await this.get(key)
    const newValue = current ? parseInt(current, 10) + 1 : 1
    await this.set(key, String(newValue))
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
