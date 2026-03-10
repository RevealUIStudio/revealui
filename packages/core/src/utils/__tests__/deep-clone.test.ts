import { describe, expect, it } from 'vitest'
import { deepClone } from '../deep-clone.js'

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------
describe('deepClone', () => {
  describe('primitives', () => {
    it('clones null', () => {
      expect(deepClone(null)).toBeNull()
    })

    it('clones undefined', () => {
      expect(deepClone(undefined)).toBeUndefined()
    })

    it('clones numbers', () => {
      expect(deepClone(42)).toBe(42)
    })

    it('clones strings', () => {
      expect(deepClone('hello')).toBe('hello')
    })

    it('clones booleans', () => {
      expect(deepClone(true)).toBe(true)
    })
  })

  describe('objects', () => {
    it('deep clones a plain object', () => {
      const original = { a: 1, b: { c: 2 } }
      const cloned = deepClone(original)

      expect(cloned).toEqual(original)
      expect(cloned).not.toBe(original)
      expect(cloned.b).not.toBe(original.b)
    })

    it('skips undefined values in objects', () => {
      const original = { a: 1, b: undefined, c: 3 }
      const cloned = deepClone(original)

      expect(cloned.a).toBe(1)
      expect(cloned.c).toBe(3)
      expect(cloned).not.toHaveProperty('b')
    })

    it('preserves null values in objects', () => {
      const original = { a: null }
      const cloned = deepClone(original)

      expect(cloned.a).toBeNull()
    })
  })

  describe('arrays', () => {
    it('deep clones arrays', () => {
      const original = [1, [2, 3], { a: 4 }]
      const cloned = deepClone(original)

      expect(cloned).toEqual(original)
      expect(cloned).not.toBe(original)
      expect(cloned[1]).not.toBe(original[1])
      expect(cloned[2]).not.toBe(original[2])
    })
  })

  describe('special types', () => {
    it('clones Date objects', () => {
      const date = new Date('2025-01-01')
      const cloned = deepClone(date)

      expect(cloned).toEqual(date)
      expect(cloned).not.toBe(date)
      expect(cloned.getTime()).toBe(date.getTime())
    })

    it('clones RegExp objects', () => {
      const regex = /test/gi
      const cloned = deepClone(regex)

      expect(cloned.source).toBe('test')
      expect(cloned.flags).toBe('gi')
      expect(cloned).not.toBe(regex)
    })

    it('clones Map objects', () => {
      const map = new Map([
        ['a', 1],
        ['b', 2],
      ])
      const cloned = deepClone(map)

      expect(cloned.get('a')).toBe(1)
      expect(cloned.get('b')).toBe(2)
      expect(cloned).not.toBe(map)
    })

    it('clones Set objects', () => {
      const set = new Set([1, 2, 3])
      const cloned = deepClone(set)

      expect(cloned.has(1)).toBe(true)
      expect(cloned.has(3)).toBe(true)
      expect(cloned.size).toBe(3)
      expect(cloned).not.toBe(set)
    })

    it('clones Uint8Array', () => {
      const arr = new Uint8Array([1, 2, 3])
      const cloned = deepClone(arr)

      expect(cloned).toEqual(arr)
      expect(cloned.buffer).not.toBe(arr.buffer)
    })

    it('clones ArrayBuffer', () => {
      const buf = new ArrayBuffer(8)
      const cloned = deepClone(buf)

      expect(cloned.byteLength).toBe(8)
      expect(cloned).not.toBe(buf)
    })
  })

  describe('circular references', () => {
    it('throws on circular reference', () => {
      // biome-ignore lint/suspicious/noExplicitAny: test helper
      const obj: any = { a: 1 }
      obj.self = obj

      expect(() => deepClone(obj)).toThrow('Circular reference')
    })
  })

  describe('edge cases', () => {
    it('clones nested Maps with objects', () => {
      const map = new Map([['key', { nested: true }]])
      const cloned = deepClone(map)

      const original = map.get('key')
      const clonedValue = cloned.get('key')
      expect(clonedValue).toEqual({ nested: true })
      expect(clonedValue).not.toBe(original)
    })

    it('clones empty objects', () => {
      expect(deepClone({})).toEqual({})
    })

    it('clones empty arrays', () => {
      expect(deepClone([])).toEqual([])
    })
  })
})
