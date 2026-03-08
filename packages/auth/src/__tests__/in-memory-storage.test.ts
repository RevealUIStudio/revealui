import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { InMemoryStorage } from '../server/storage/in-memory'

describe('InMemoryStorage', () => {
  let storage: InMemoryStorage

  beforeEach(() => {
    storage = new InMemoryStorage()
  })

  describe('get/set', () => {
    it('stores and retrieves a value', async () => {
      await storage.set('key', 'value')
      expect(await storage.get('key')).toBe('value')
    })

    it('returns null for missing key', async () => {
      expect(await storage.get('missing')).toBeNull()
    })

    it('overwrites existing value', async () => {
      await storage.set('key', 'first')
      await storage.set('key', 'second')
      expect(await storage.get('key')).toBe('second')
    })
  })

  describe('TTL expiration', () => {
    beforeEach(() => {
      vi.useFakeTimers()
    })

    afterEach(() => {
      vi.useRealTimers()
    })

    it('returns value before TTL expires', async () => {
      await storage.set('key', 'value', 60)
      vi.advanceTimersByTime(59_000)
      expect(await storage.get('key')).toBe('value')
    })

    it('returns null after TTL expires', async () => {
      await storage.set('key', 'value', 1)
      vi.advanceTimersByTime(1001)
      expect(await storage.get('key')).toBeNull()
    })

    it('exists returns false after TTL expires', async () => {
      await storage.set('key', 'value', 1)
      vi.advanceTimersByTime(1001)
      expect(await storage.exists('key')).toBe(false)
    })
  })

  describe('del', () => {
    it('deletes a key', async () => {
      await storage.set('key', 'value')
      await storage.del('key')
      expect(await storage.get('key')).toBeNull()
    })

    it('no-ops on missing key', async () => {
      await storage.del('missing')
      expect(await storage.get('missing')).toBeNull()
    })
  })

  describe('exists', () => {
    it('returns true for existing key', async () => {
      await storage.set('key', 'value')
      expect(await storage.exists('key')).toBe(true)
    })

    it('returns false for missing key', async () => {
      expect(await storage.exists('missing')).toBe(false)
    })
  })

  describe('incr', () => {
    it('increments from 0 when key does not exist', async () => {
      const val = await storage.incr('counter')
      expect(val).toBe(1)
    })

    it('increments existing value', async () => {
      await storage.set('counter', '5')
      const val = await storage.incr('counter')
      expect(val).toBe(6)
    })

    it('increments multiple times', async () => {
      await storage.incr('counter')
      await storage.incr('counter')
      const val = await storage.incr('counter')
      expect(val).toBe(3)
    })
  })

  describe('atomicUpdate', () => {
    it('creates entry when key does not exist', async () => {
      await storage.atomicUpdate('key', (existing) => {
        expect(existing).toBeNull()
        return { value: 'new', ttlSeconds: 60 }
      })
      expect(await storage.get('key')).toBe('new')
    })

    it('updates existing entry', async () => {
      await storage.set('key', 'old')
      await storage.atomicUpdate('key', (existing) => {
        expect(existing).toBe('old')
        return { value: 'updated', ttlSeconds: 60 }
      })
      expect(await storage.get('key')).toBe('updated')
    })

    it('treats expired entries as null', async () => {
      vi.useFakeTimers()
      await storage.set('key', 'expired', 1)
      vi.advanceTimersByTime(1001)
      await storage.atomicUpdate('key', (existing) => {
        expect(existing).toBeNull()
        return { value: 'fresh', ttlSeconds: 60 }
      })
      expect(await storage.get('key')).toBe('fresh')
      vi.useRealTimers()
    })
  })

  describe('cleanup', () => {
    it('removes expired entries', async () => {
      vi.useFakeTimers()
      await storage.set('expired', 'val', 1)
      await storage.set('alive', 'val', 300)
      vi.advanceTimersByTime(1001)
      storage.cleanup()
      expect(await storage.get('expired')).toBeNull()
      expect(await storage.get('alive')).toBe('val')
      vi.useRealTimers()
    })
  })

  describe('clear', () => {
    it('removes all entries', async () => {
      await storage.set('a', '1')
      await storage.set('b', '2')
      storage.clear()
      expect(await storage.get('a')).toBeNull()
      expect(await storage.get('b')).toBeNull()
    })
  })
})
