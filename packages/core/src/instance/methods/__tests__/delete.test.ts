/**
 * Delete Method Tests
 *
 * Unit tests for the delete instance method.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { RevealDocument, RevealUIInstance } from '../../../types/index.js'
import { deleteMethod } from '../delete.js'

describe('delete method', () => {
  const mockInstance: RevealUIInstance = {
    collections: {
      'test-collection': {
        delete: vi.fn(),
      } as never,
    },
    globals: {},
    config: {
      collections: [],
      globals: [],
    },
    db: null,
    logger: {
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      debug: vi.fn(),
    },
    secret: undefined,
  }

  const mockEnsureDbConnected = vi.fn().mockResolvedValue(undefined)

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should call collection delete method', async () => {
    const options = {
      collection: 'test-collection',
      id: 'test-id',
    }

    const mockResult: RevealDocument = { id: 'test-id' }

    vi.mocked(mockInstance.collections['test-collection'].delete).mockResolvedValue(mockResult)

    const result = await deleteMethod(mockInstance, mockEnsureDbConnected, options)

    expect(result).toEqual(mockResult)
    expect(mockEnsureDbConnected).toHaveBeenCalled()
    expect(mockInstance.collections['test-collection'].delete).toHaveBeenCalledWith(options)
  })

  it('should throw error if collection not found', async () => {
    const options = {
      collection: 'non-existent',
      id: 'test-id',
    }

    await expect(deleteMethod(mockInstance, mockEnsureDbConnected, options)).rejects.toThrow(
      "Collection 'non-existent' not found",
    )
  })
})
