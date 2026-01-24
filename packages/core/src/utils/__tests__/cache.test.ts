import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { LRUCache } from '../cache.js'

describe('LRUCache', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  describe('constructor', () => {
    it('should create cache with default options', () => {
      const cache = new LRUCache()
      expect(cache.size).toBe(0)
    })

    it('should create cache with custom options', () => {
      const cache = new LRUCache({ maxSize: 50, ttlMs: 1000 })
      expect(cache.size).toBe(0)
    })
  })

  describe('fetch', () => {
    it('should fetch and cache value', async () => {
      const cache = new LRUCache({ maxSize: 10, ttlMs: 5000 })
      const fetcher = vi.fn().mockResolvedValue('test-value')

      const result = await cache.fetch('key1', fetcher)

      expect(result).toBe('test-value')
      expect(fetcher).toHaveBeenCalledTimes(1)
      expect(cache.size).toBe(1)
    })

    it('should return cached value on second fetch', async () => {
      const cache = new LRUCache({ maxSize: 10, ttlMs: 5000 })
      const fetcher = vi.fn().mockResolvedValue('test-value')

      await cache.fetch('key1', fetcher)
      const result = await cache.fetch('key1', fetcher)

      expect(result).toBe('test-value')
      expect(fetcher).toHaveBeenCalledTimes(1) // Should not call again
    })

    it('should fetch new value after TTL expires', async () => {
      const cache = new LRUCache({ maxSize: 10, ttlMs: 5000 })
      const fetcher = vi.fn().mockResolvedValue('test-value')

      await cache.fetch('key1', fetcher)
      expect(fetcher).toHaveBeenCalledTimes(1)

      // Advance time past TTL
      vi.advanceTimersByTime(6000)

      const result = await cache.fetch('key1', fetcher)
      expect(result).toBe('test-value')
      expect(fetcher).toHaveBeenCalledTimes(2) // Should fetch again
    })

    it('should evict least recently used entry when at capacity', async () => {
      const cache = new LRUCache({ maxSize: 2, ttlMs: 5000 })
      const fetcher1 = vi.fn().mockResolvedValue('value1')
      const fetcher2 = vi.fn().mockResolvedValue('value2')
      const fetcher3 = vi.fn().mockResolvedValue('value3')

      await cache.fetch('key1', fetcher1)
      await cache.fetch('key2', fetcher2)
      await cache.fetch('key3', fetcher3)

      expect(cache.size).toBe(2)
      expect(fetcher1).toHaveBeenCalledTimes(1)
      expect(fetcher2).toHaveBeenCalledTimes(1)
      expect(fetcher3).toHaveBeenCalledTimes(1)

      // key1 should be evicted (LRU)
      const result = await cache.fetch('key1', () => Promise.resolve('value1-new'))
      expect(result).toBe('value1-new')
    })

    it('should handle synchronous fetcher', async () => {
      const cache = new LRUCache({ maxSize: 10, ttlMs: 5000 })
      const fetcher = vi.fn().mockReturnValue('sync-value')

      const result = await cache.fetch('key1', fetcher)

      expect(result).toBe('sync-value')
      expect(fetcher).toHaveBeenCalledTimes(1)
    })
  })

  describe('get', () => {
    it('should return undefined for non-existent key', () => {
      const cache = new LRUCache()
      expect(cache.get('nonexistent')).toBeUndefined()
    })

    it('should return cached value', async () => {
      const cache = new LRUCache({ maxSize: 10, ttlMs: 5000 })
      await cache.fetch('key1', () => Promise.resolve('value1'))

      expect(cache.get('key1')).toBe('value1')
    })

    it('should return undefined for expired entry', async () => {
      const cache = new LRUCache({ maxSize: 10, ttlMs: 5000 })
      await cache.fetch('key1', () => Promise.resolve('value1'))

      vi.advanceTimersByTime(6000)

      expect(cache.get('key1')).toBeUndefined()
      expect(cache.size).toBe(0) // Expired entry should be removed
    })
  })

  describe('set', () => {
    it('should set value in cache', () => {
      const cache = new LRUCache({ maxSize: 10, ttlMs: 5000 })
      cache.set('key1', 'value1')

      expect(cache.get('key1')).toBe('value1')
      expect(cache.size).toBe(1)
    })

    it('should evict if at capacity', () => {
      const cache = new LRUCache({ maxSize: 2, ttlMs: 5000 })
      cache.set('key1', 'value1')
      cache.set('key2', 'value2')
      cache.set('key3', 'value3')

      expect(cache.size).toBe(2)
      expect(cache.get('key1')).toBeUndefined() // Should be evicted
    })
  })

  describe('delete', () => {
    it('should delete entry from cache', async () => {
      const cache = new LRUCache({ maxSize: 10, ttlMs: 5000 })
      await cache.fetch('key1', () => Promise.resolve('value1'))

      expect(cache.delete('key1')).toBe(true)
      expect(cache.get('key1')).toBeUndefined()
      expect(cache.size).toBe(0)
    })

    it('should return false for non-existent key', () => {
      const cache = new LRUCache()
      expect(cache.delete('nonexistent')).toBe(false)
    })
  })

  describe('clear', () => {
    it('should clear all entries', async () => {
      const cache = new LRUCache({ maxSize: 10, ttlMs: 5000 })
      await cache.fetch('key1', () => Promise.resolve('value1'))
      await cache.fetch('key2', () => Promise.resolve('value2'))

      cache.clear()

      expect(cache.size).toBe(0)
      expect(cache.get('key1')).toBeUndefined()
      expect(cache.get('key2')).toBeUndefined()
    })
  })

  describe('cleanup', () => {
    it('should remove expired entries', async () => {
      const cache = new LRUCache({ maxSize: 10, ttlMs: 5000 })
      await cache.fetch('key1', () => Promise.resolve('value1'))
      await cache.fetch('key2', () => Promise.resolve('value2'))

      vi.advanceTimersByTime(6000)

      cache.cleanup()

      expect(cache.size).toBe(0)
      expect(cache.get('key1')).toBeUndefined()
      expect(cache.get('key2')).toBeUndefined()
    })

    it('should keep valid entries after cleanup', async () => {
      const cache = new LRUCache({ maxSize: 10, ttlMs: 5000 })
      await cache.fetch('key1', () => Promise.resolve('value1'))

      vi.advanceTimersByTime(3000)
      await cache.fetch('key2', () => Promise.resolve('value2'))

      vi.advanceTimersByTime(3000) // key1 expired, key2 still valid

      cache.cleanup()

      expect(cache.size).toBe(1)
      expect(cache.get('key1')).toBeUndefined()
      expect(cache.get('key2')).toBe('value2')
    })
  })

  describe('size property', () => {
    it('should return correct size', async () => {
      const cache = new LRUCache({ maxSize: 10, ttlMs: 5000 })

      expect(cache.size).toBe(0)

      await cache.fetch('key1', () => Promise.resolve('value1'))
      expect(cache.size).toBe(1)

      await cache.fetch('key2', () => Promise.resolve('value2'))
      expect(cache.size).toBe(2)
    })
  })
})
