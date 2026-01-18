/**
 * Find Method Tests
 *
 * Unit tests for the find instance method.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest'
import type {
  RevealFindOptions,
  RevealPaginatedResult,
  RevealUIInstance,
} from '../../../types/index.js'
import { find } from '../find.js'

// Mock validateJWTFromRequest
vi.mock('../../../utils/jwt-validation', () => ({
  validateJWTFromRequest: vi.fn(),
}))

// Mock getDataLoader
vi.mock('../../../dataloader', () => ({
  getDataLoader: vi.fn(() => ({})),
}))

describe('find method', () => {
  const mockInstance: RevealUIInstance = {
    collections: {
      'test-collection': {
        find: vi.fn(),
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

  it('should call collection find method', async () => {
    const options: RevealFindOptions & { collection: string } = {
      collection: 'test-collection',
      limit: 10,
      page: 1,
    }

    const mockResult: RevealPaginatedResult = {
      docs: [{ id: '1', title: 'Test' }],
      totalDocs: 1,
      limit: 10,
      totalPages: 1,
      page: 1,
      pagingCounter: 1,
      hasPrevPage: false,
      hasNextPage: false,
      prevPage: null,
      nextPage: null,
    }

    vi.mocked(mockInstance.collections['test-collection'].find).mockResolvedValue(mockResult)

    const result = await find(mockInstance, mockEnsureDbConnected, options)

    expect(result).toEqual(mockResult)
    expect(mockEnsureDbConnected).toHaveBeenCalled()
    expect(mockInstance.collections['test-collection'].find).toHaveBeenCalledWith(options)
  })

  it('should throw error if collection not found', async () => {
    const options: RevealFindOptions & { collection: string } = {
      collection: 'non-existent',
    }

    await expect(find(mockInstance, mockEnsureDbConnected, options)).rejects.toThrow(
      "Collection 'non-existent' not found",
    )
  })

  it('should initialize DataLoader if not present', async () => {
    const options: RevealFindOptions & { collection: string; req?: any } = {
      collection: 'test-collection',
      req: {
        dataLoader: undefined,
      },
    }

    const mockResult: RevealPaginatedResult = {
      docs: [],
      totalDocs: 0,
      limit: 10,
      totalPages: 0,
      page: 1,
      pagingCounter: 0,
      hasPrevPage: false,
      hasNextPage: false,
      prevPage: null,
      nextPage: null,
    }

    vi.mocked(mockInstance.collections['test-collection'].find).mockResolvedValue(mockResult)

    await find(mockInstance, mockEnsureDbConnected, options)

    expect(options.req?.dataLoader).toBeDefined()
    expect(options.req?.revealui).toBe(mockInstance)
  })
})
