/**
 * Unit tests for REAL framework utilities
 *
 * Tests actual utilities from packages/core/src/utils
 */

import { describe, expect, it } from 'vitest'
// @ts-expect-error - Direct import for testing
import { isValidID } from '../../../../../packages/core/src/utils/isValidID.js'

describe('Framework Utilities (Real Code)', () => {
  describe('isValidID', () => {
    describe('text ID type', () => {
      it('should accept valid string IDs', () => {
        expect(isValidID('abc123', 'text')).toBe(true)
        expect(isValidID('user-123', 'text')).toBe(true)
        expect(isValidID('test', 'text')).toBe(true)
      })

      it('should accept valid number IDs (converted to string)', () => {
        expect(isValidID(123, 'text')).toBe(true)
        expect(isValidID(0, 'text')).toBe(true)
        expect(isValidID(999, 'text')).toBe(true)
      })

      it('should reject empty strings', () => {
        expect(isValidID('', 'text')).toBe(false)
      })

      it('should reject invalid types', () => {
        expect(isValidID(null, 'text')).toBe(false)
        expect(isValidID(undefined, 'text')).toBe(false)
        expect(isValidID({}, 'text')).toBe(false)
        expect(isValidID([], 'text')).toBe(false)
        expect(isValidID(true, 'text')).toBe(false)
      })

      it('should reject NaN and Infinity', () => {
        expect(isValidID(NaN, 'text')).toBe(false)
        expect(isValidID(Infinity, 'text')).toBe(false)
        expect(isValidID(-Infinity, 'text')).toBe(false)
      })
    })

    describe('number ID type', () => {
      it('should accept valid numbers', () => {
        expect(isValidID(123, 'number')).toBe(true)
        expect(isValidID(0, 'number')).toBe(true)
        expect(isValidID(-1, 'number')).toBe(true)
        expect(isValidID(999999, 'number')).toBe(true)
      })

      it('should reject strings', () => {
        expect(isValidID('123', 'number')).toBe(false)
        expect(isValidID('abc', 'number')).toBe(false)
      })

      it('should reject invalid types', () => {
        expect(isValidID(null, 'number')).toBe(false)
        expect(isValidID(undefined, 'number')).toBe(false)
        expect(isValidID({}, 'number')).toBe(false)
        expect(isValidID([], 'number')).toBe(false)
        expect(isValidID(true, 'number')).toBe(false)
      })

      it('should reject NaN and Infinity', () => {
        expect(isValidID(NaN, 'number')).toBe(false)
        expect(isValidID(Infinity, 'number')).toBe(false)
        expect(isValidID(-Infinity, 'number')).toBe(false)
      })
    })

    describe('default behavior (text)', () => {
      it('should default to text ID type', () => {
        expect(isValidID('test')).toBe(true)
        expect(isValidID(123)).toBe(true)
        expect(isValidID('')).toBe(false)
        expect(isValidID(null)).toBe(false)
      })
    })
  })
})
