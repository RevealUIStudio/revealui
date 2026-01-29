/**
 * Unit tests for test helper utilities
 *
 * Tests the test utilities themselves to ensure they work correctly
 */

import { describe, expect, it } from 'vitest'
import {
  assertDefined,
  createTestId,
  deepClone,
  deepEqual,
  retry,
  sleep,
  waitFor,
} from '../../utils/test-helpers.js'

describe('Test Helpers', () => {
  describe('waitFor', () => {
    it('should resolve when condition is immediately true', async () => {
      await expect(waitFor(() => true, 1000)).resolves.toBeUndefined()
    })

    it('should resolve when condition becomes true', async () => {
      let condition = false
      setTimeout(() => {
        condition = true
      }, 100)

      await expect(waitFor(() => condition, 1000)).resolves.toBeUndefined()
    })

    it('should timeout when condition never becomes true', async () => {
      await expect(waitFor(() => false, 100)).rejects.toThrow('Condition not met')
    })

    it('should work with async conditions', async () => {
      let resolved = false
      setTimeout(() => {
        resolved = true
      }, 50)

      await expect(
        waitFor(async () => {
          await sleep(10)
          return resolved
        }, 200),
      ).resolves.toBeUndefined()
    })
  })

  describe('retry', () => {
    it('should succeed on first attempt', async () => {
      const fn = async () => 'success'
      await expect(retry(fn)).resolves.toBe('success')
    })

    it('should retry on failure and eventually succeed', async () => {
      let attempts = 0
      const fn = async () => {
        attempts++
        if (attempts < 3) {
          throw new Error('Failed')
        }
        return 'success'
      }

      await expect(retry(fn, 3)).resolves.toBe('success')
      expect(attempts).toBe(3)
    })

    it('should throw after max retries', async () => {
      const fn = async () => {
        throw new Error('Always fails')
      }

      await expect(retry(fn, 2)).rejects.toThrow('Always fails')
    })
  })

  describe('createTestId', () => {
    it('should create unique IDs', () => {
      const id1 = createTestId()
      const id2 = createTestId()
      expect(id1).not.toBe(id2)
    })

    it('should include prefix', () => {
      const id = createTestId('my-prefix')
      expect(id).toContain('my-prefix')
    })

    it('should create different IDs with same prefix', () => {
      const id1 = createTestId('prefix')
      const id2 = createTestId('prefix')
      expect(id1).not.toBe(id2)
    })
  })

  describe('sleep', () => {
    it('should wait for specified duration', async () => {
      const start = Date.now()
      await sleep(50)
      const duration = Date.now() - start
      expect(duration).toBeGreaterThanOrEqual(45)
      expect(duration).toBeLessThan(100)
    })
  })

  describe('assertDefined', () => {
    it('should not throw for defined values', () => {
      expect(() => assertDefined('value')).not.toThrow()
      expect(() => assertDefined(0)).not.toThrow()
      expect(() => assertDefined(false)).not.toThrow()
      expect(() => assertDefined({})).not.toThrow()
      expect(() => assertDefined([])).not.toThrow()
    })

    it('should throw for null', () => {
      expect(() => assertDefined(null)).toThrow()
    })

    it('should throw for undefined', () => {
      expect(() => assertDefined(undefined)).toThrow()
    })

    it('should use custom error message', () => {
      expect(() => assertDefined(null, 'Custom error')).toThrow('Custom error')
    })
  })

  describe('deepClone', () => {
    it('should clone primitive values', () => {
      expect(deepClone(42)).toBe(42)
      expect(deepClone('string')).toBe('string')
      expect(deepClone(true)).toBe(true)
      expect(deepClone(null)).toBe(null)
    })

    it('should clone arrays', () => {
      const original = [1, 2, 3]
      const cloned = deepClone(original)
      expect(cloned).toEqual(original)
      expect(cloned).not.toBe(original)
    })

    it('should clone objects', () => {
      const original = { a: 1, b: { c: 2 } }
      const cloned = deepClone(original)
      expect(cloned).toEqual(original)
      expect(cloned).not.toBe(original)
      expect(cloned.b).not.toBe(original.b)
    })

    it('should clone nested structures', () => {
      const original = {
        a: 1,
        b: [2, 3, { c: 4 }],
        d: { e: { f: 5 } },
      }
      const cloned = deepClone(original)
      expect(cloned).toEqual(original)
      expect(cloned.b[2]).not.toBe(original.b[2])
      expect(cloned.d.e).not.toBe(original.d.e)
    })

    it('should clone dates', () => {
      const original = new Date('2025-01-01')
      const cloned = deepClone(original)
      expect(cloned).toEqual(original)
      expect(cloned).not.toBe(original)
      expect(cloned.getTime()).toBe(original.getTime())
    })
  })

  describe('deepEqual', () => {
    it('should return true for identical primitives', () => {
      expect(deepEqual(1, 1)).toBe(true)
      expect(deepEqual('a', 'a')).toBe(true)
      expect(deepEqual(true, true)).toBe(true)
      expect(deepEqual(null, null)).toBe(true)
    })

    it('should return false for different primitives', () => {
      expect(deepEqual(1, 2)).toBe(false)
      expect(deepEqual('a', 'b')).toBe(false)
      expect(deepEqual(true, false)).toBe(false)
    })

    it('should return true for equal arrays', () => {
      expect(deepEqual([1, 2, 3], [1, 2, 3])).toBe(true)
    })

    it('should return false for different arrays', () => {
      expect(deepEqual([1, 2, 3], [1, 2, 4])).toBe(false)
      expect(deepEqual([1, 2, 3], [1, 2])).toBe(false)
    })

    it('should return true for equal objects', () => {
      expect(deepEqual({ a: 1, b: 2 }, { a: 1, b: 2 })).toBe(true)
      expect(deepEqual({ a: 1, b: 2 }, { b: 2, a: 1 })).toBe(true)
    })

    it('should return false for different objects', () => {
      expect(deepEqual({ a: 1, b: 2 }, { a: 1, b: 3 })).toBe(false)
      expect(deepEqual({ a: 1, b: 2 }, { a: 1 })).toBe(false)
    })

    it('should handle nested structures', () => {
      const obj1 = { a: 1, b: { c: 2, d: [3, 4] } }
      const obj2 = { a: 1, b: { c: 2, d: [3, 4] } }
      const obj3 = { a: 1, b: { c: 2, d: [3, 5] } }

      expect(deepEqual(obj1, obj2)).toBe(true)
      expect(deepEqual(obj1, obj3)).toBe(false)
    })
  })
})
