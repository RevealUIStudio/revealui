/**
 * Unit tests for getBlockSelect utility
 *
 * Tests actual utility from packages/core/src/utils/getBlockSelect.ts
 */

import { describe, expect, it } from 'vitest'
import type { SelectType } from '../../../../../packages/core/src/types/index.js'
// @ts-expect-error - Direct import for testing
import { getBlockSelect } from '../../../../../packages/core/src/utils/getBlockSelect.js'

describe('getBlockSelect', () => {
  const createTestBlock = () => ({
    slug: 'test-block',
  })

  describe('include mode', () => {
    it('should return block select configuration for matching block', () => {
      const block = createTestBlock()
      const select: SelectType = {
        'test-block': {
          title: true,
          content: true,
        },
      }

      const result = getBlockSelect({
        block,
        select,
        selectMode: 'include',
      })

      expect(result).toEqual({
        title: true,
        content: true,
      })
    })

    it('should return undefined for non-matching block', () => {
      const block = createTestBlock()
      const select: SelectType = {
        'other-block': {
          title: true,
        },
      }

      const result = getBlockSelect({
        block,
        select,
        selectMode: 'include',
      })

      expect(result).toBeUndefined()
    })

    it('should return undefined when select is undefined', () => {
      const block = createTestBlock()

      const result = getBlockSelect({
        block,
        select: undefined,
        selectMode: 'include',
      })

      expect(result).toBeUndefined()
    })

    it('should return undefined when select is null', () => {
      const block = createTestBlock()

      const result = getBlockSelect({
        block,
        select: null as unknown as SelectType,
        selectMode: 'include',
      })

      expect(result).toBeUndefined()
    })

    it('should handle nested select configuration', () => {
      const block = createTestBlock()
      const select: SelectType = {
        'test-block': {
          title: true,
          author: {
            name: true,
            email: true,
          },
        },
      }

      const result = getBlockSelect({
        block,
        select,
        selectMode: 'include',
      })

      expect(result).toEqual({
        title: true,
        author: {
          name: true,
          email: true,
        },
      })
    })

    it('should handle select with boolean values', () => {
      const block = createTestBlock()
      const select: SelectType = {
        'test-block': {
          title: true,
          content: false,
        },
      }

      const result = getBlockSelect({
        block,
        select,
        selectMode: 'include',
      })

      expect(result).toEqual({
        title: true,
        content: false,
      })
    })
  })

  describe('exclude mode', () => {
    it('should return undefined in exclude mode', () => {
      const block = createTestBlock()
      const select: SelectType = {
        'test-block': {
          title: true,
        },
      }

      const result = getBlockSelect({
        block,
        select,
        selectMode: 'exclude',
      })

      expect(result).toBeUndefined()
    })
  })

  describe('edge cases', () => {
    it('should handle empty select object', () => {
      const block = createTestBlock()
      const select: SelectType = {}

      const result = getBlockSelect({
        block,
        select,
        selectMode: 'include',
      })

      expect(result).toBeUndefined()
    })

    it('should handle select with null block config', () => {
      const block = createTestBlock()
      const select: SelectType = {
        'test-block': null as unknown,
      }

      const result = getBlockSelect({
        block,
        select,
        selectMode: 'include',
      })

      expect(result).toBeUndefined()
    })

    it('should handle select with primitive block config', () => {
      const block = createTestBlock()
      const select: SelectType = {
        'test-block': 'string' as unknown,
      }

      const result = getBlockSelect({
        block,
        select,
        selectMode: 'include',
      })

      expect(result).toBeUndefined()
    })

    it('should handle multiple blocks in select', () => {
      const block = createTestBlock()
      const select: SelectType = {
        'test-block': {
          title: true,
        },
        'other-block': {
          name: true,
        },
      }

      const result = getBlockSelect({
        block,
        select,
        selectMode: 'include',
      })

      expect(result).toEqual({
        title: true,
      })
    })

    it('should handle block slug with special characters', () => {
      const block = {
        slug: 'test-block-123',
      }
      const select: SelectType = {
        'test-block-123': {
          title: true,
        },
      }

      const result = getBlockSelect({
        block,
        select,
        selectMode: 'include',
      })

      expect(result).toEqual({
        title: true,
      })
    })
  })
})
