/**
 * Find By ID Method Tests
 *
 * Unit tests for the findByID instance method.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { RevealDocument, RevealUIInstance } from '../../../types/index.js'
import { findByID } from '../findById.js'

// Mock validateJWTFromRequest
vi.mock('../../../utils/jwt-validation', () => ({
  validateJWTFromRequest: vi.fn(),
}))

// Mock getDataLoader
vi.mock('../../../dataloader', () => ({
  getDataLoader: vi.fn(() => ({})),
}))

describe('findByID method', () => {
  const mockInstance: RevealUIInstance = {
    collections: {
      'test-collection': {
        findByID: vi.fn(),
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

  it('should call collection findByID method', async () => {
    const options = {
      collection: 'test-collection',
      id: 'test-id',
    }

    const mockDoc: RevealDocument = {
      id: 'test-id',
      title: 'Test',
    }

    vi.mocked(mockInstance.collections['test-collection'].findByID).mockResolvedValue(mockDoc)

    const result = await findByID(mockInstance, mockEnsureDbConnected, options)

    expect(result).toEqual(mockDoc)
    expect(mockEnsureDbConnected).toHaveBeenCalled()
    expect(mockInstance.collections['test-collection'].findByID).toHaveBeenCalledWith(options)
  })

  it('should throw error if collection not found', async () => {
    const options = {
      collection: 'non-existent',
      id: 'test-id',
    }

    await expect(findByID(mockInstance, mockEnsureDbConnected, options)).rejects.toThrow(
      "Collection 'non-existent' not found",
    )
  })

  it('should initialize DataLoader if not present', async () => {
    const options = {
      collection: 'test-collection',
      id: 'test-id',
      req: {
        dataLoader: undefined,
      },
    }

    vi.mocked(mockInstance.collections['test-collection'].findByID).mockResolvedValue(null)

    await findByID(mockInstance, mockEnsureDbConnected, options)

    expect(options.req?.dataLoader).toBeDefined()
    expect(options.req?.revealui).toBe(mockInstance)
  })
})
