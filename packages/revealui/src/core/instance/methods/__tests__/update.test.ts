/**
 * Update Method Tests
 *
 * Unit tests for the update instance method.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { RevealDocument, RevealUIInstance } from '../../../types/index'
import { callHooks } from '../hooks'
import { update } from '../update'

// Mock callHooks
vi.mock('../hooks', () => ({
  callHooks: vi.fn(),
}))

describe('update method', () => {
  const mockInstance: RevealUIInstance = {
    collections: {
      'test-collection': {
        findByID: vi.fn(),
        update: vi.fn(),
      } as never,
    },
    globals: {},
    config: {
      collections: [
        {
          slug: 'test-collection',
          hooks: {
            afterChange: [],
          },
        } as never,
      ],
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

  it('should call collection update method', async () => {
    const options = {
      collection: 'test-collection',
      id: 'test-id',
      data: {
        title: 'Updated',
      },
    }

    const mockPreviousDoc: RevealDocument = {
      id: 'test-id',
      title: 'Original',
    }

    const mockUpdatedDoc: RevealDocument = {
      id: 'test-id',
      title: 'Updated',
    }

    vi.mocked(mockInstance.collections['test-collection'].findByID).mockResolvedValue(
      mockPreviousDoc,
    )
    vi.mocked(mockInstance.collections['test-collection'].update).mockResolvedValue(mockUpdatedDoc)
    vi.mocked(callHooks).mockResolvedValue(mockUpdatedDoc)

    const result = await update(mockInstance, mockEnsureDbConnected, options)

    expect(result).toEqual(mockUpdatedDoc)
    expect(mockEnsureDbConnected).toHaveBeenCalled()
    expect(mockInstance.collections['test-collection'].update).toHaveBeenCalledWith(options)
  })

  it('should call hooks if configured', async () => {
    const options = {
      collection: 'test-collection',
      id: 'test-id',
      data: {
        title: 'Updated',
      },
      req: {} as never,
    }

    const mockDoc: RevealDocument = {
      id: 'test-id',
      title: 'Updated',
    }

    vi.mocked(mockInstance.collections['test-collection'].findByID).mockResolvedValue(mockDoc)
    vi.mocked(mockInstance.collections['test-collection'].update).mockResolvedValue(mockDoc)
    vi.mocked(callHooks).mockResolvedValue(mockDoc)

    await update(mockInstance, mockEnsureDbConnected, options)

    expect(callHooks).toHaveBeenCalled()
  })

  it('should throw error if collection not found', async () => {
    const options = {
      collection: 'non-existent',
      id: 'test-id',
      data: {
        title: 'Updated',
      },
    }

    await expect(update(mockInstance, mockEnsureDbConnected, options)).rejects.toThrow(
      "Collection 'non-existent' not found",
    )
  })
})
