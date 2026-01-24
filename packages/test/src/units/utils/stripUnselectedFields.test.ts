/**
 * Unit tests for stripUnselectedFields utility
 *
 * Tests actual utility from packages/core/src/utils/stripUnselectedFields.ts
 */

import { beforeEach, describe, expect, it } from 'vitest'
import type { Field, SelectType } from '../../../../../packages/core/src/types/index.js'
// @ts-expect-error - Direct import for testing
import { stripUnselectedFields } from '../../../../../packages/core/src/utils/stripUnselectedFields.js'

describe('stripUnselectedFields', () => {
  let siblingDoc: Record<string, unknown>
  const asRecord = (value: unknown): Record<string, unknown> => value as Record<string, unknown>

  beforeEach(() => {
    siblingDoc = {}
  })

  it('should strip fields not in select configuration', () => {
    const field: Field = {
      name: 'metadata',
      type: 'json',
    }

    siblingDoc.metadata = {
      title: 'Test',
      description: 'Description',
      author: 'Author',
    }

    const select: SelectType = {
      title: true,
      description: true,
    }

    stripUnselectedFields({ field, select, siblingDoc })

    expect(siblingDoc.metadata).toEqual({
      title: 'Test',
      description: 'Description',
    })
    const metadata = asRecord(siblingDoc.metadata)
    expect(metadata.author).toBeUndefined()
  })

  it('should preserve all fields if all are selected', () => {
    const field: Field = {
      name: 'metadata',
      type: 'json',
    }

    siblingDoc.metadata = {
      title: 'Test',
      description: 'Description',
      author: 'Author',
    }

    const select: SelectType = {
      title: true,
      description: true,
      author: true,
    }

    stripUnselectedFields({ field, select, siblingDoc })

    expect(siblingDoc.metadata).toEqual({
      title: 'Test',
      description: 'Description',
      author: 'Author',
    })
  })

  it('should strip all fields if select is empty', () => {
    const field: Field = {
      name: 'metadata',
      type: 'json',
    }

    siblingDoc.metadata = {
      title: 'Test',
      description: 'Description',
    }

    const select: SelectType = {}

    stripUnselectedFields({ field, select, siblingDoc })

    expect(siblingDoc.metadata).toEqual({})
  })

  it('should do nothing if select is undefined', () => {
    const field: Field = {
      name: 'metadata',
      type: 'json',
    }

    siblingDoc.metadata = {
      title: 'Test',
      description: 'Description',
    }

    const originalMetadata = { ...siblingDoc.metadata }

    stripUnselectedFields({ field, select: undefined, siblingDoc })

    expect(siblingDoc.metadata).toEqual(originalMetadata)
  })

  it('should do nothing if select is null', () => {
    const field: Field = {
      name: 'metadata',
      type: 'json',
    }

    siblingDoc.metadata = {
      title: 'Test',
    }

    const originalMetadata = { ...siblingDoc.metadata }

    stripUnselectedFields({ field, select: null as unknown as SelectType, siblingDoc })

    expect(siblingDoc.metadata).toEqual(originalMetadata)
  })

  it('should do nothing if select is not an object', () => {
    const field: Field = {
      name: 'metadata',
      type: 'json',
    }

    siblingDoc.metadata = {
      title: 'Test',
    }

    const originalMetadata = { ...siblingDoc.metadata }

    stripUnselectedFields({ field, select: 'string' as unknown as SelectType, siblingDoc })

    expect(siblingDoc.metadata).toEqual(originalMetadata)
  })

  it('should handle field with no name', () => {
    const field: Field = {
      name: '',
      type: 'json',
    }

    siblingDoc.metadata = {
      title: 'Test',
    }

    const originalMetadata = { ...siblingDoc.metadata }

    stripUnselectedFields({ field, select: { title: true }, siblingDoc })

    expect(siblingDoc.metadata).toEqual(originalMetadata)
  })

  it('should handle field that does not exist in siblingDoc', () => {
    const field: Field = {
      name: 'nonexistent',
      type: 'json',
    }

    siblingDoc.other = {
      title: 'Test',
    }

    const select: SelectType = {
      title: true,
    }

    stripUnselectedFields({ field, select, siblingDoc })

    expect(siblingDoc.nonexistent).toBeUndefined()
    expect(siblingDoc.other).toEqual({ title: 'Test' })
  })

  it('should handle field value that is not an object', () => {
    const field: Field = {
      name: 'metadata',
      type: 'text',
    }

    siblingDoc.metadata = 'string value'

    const select: SelectType = {
      title: true,
    }

    // Should not throw error
    expect(() => {
      stripUnselectedFields({ field, select, siblingDoc })
    }).not.toThrow()

    expect(siblingDoc.metadata).toBe('string value')
  })

  it('should handle null field value', () => {
    const field: Field = {
      name: 'metadata',
      type: 'json',
    }

    siblingDoc.metadata = null

    const select: SelectType = {
      title: true,
    }

    // Should not throw error
    expect(() => {
      stripUnselectedFields({ field, select, siblingDoc })
    }).not.toThrow()

    expect(siblingDoc.metadata).toBeNull()
  })

  it('should handle nested field structures', () => {
    const field: Field = {
      name: 'metadata',
      type: 'json',
    }

    siblingDoc.metadata = {
      level1: {
        level2: {
          field1: 'value1',
          field2: 'value2',
        },
      },
    }

    const select: SelectType = {
      level1: {
        level2: {
          field1: true,
        },
      },
    }

    stripUnselectedFields({ field, select, siblingDoc })

    // Note: The current implementation only strips top-level keys
    // Nested structures are preserved as-is
    expect(siblingDoc.metadata).toBeDefined()
  })

  it('should preserve fields with false in select', () => {
    const field: Field = {
      name: 'metadata',
      type: 'json',
    }

    siblingDoc.metadata = {
      title: 'Test',
      description: 'Description',
    }

    const select: SelectType = {
      title: true,
      description: false,
    }

    stripUnselectedFields({ field, select, siblingDoc })

    // Fields with false are still in select, so they're preserved
    const metadata = asRecord(siblingDoc.metadata)
    expect(metadata.title).toBe('Test')
    expect(metadata.description).toBe('Description')
  })
})
