/**
 * Delete Operation Tests
 *
 * Unit tests for the delete operation function.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest'
import type {
  DatabaseResult,
  RevealCollectionConfig,
  RevealDeleteOptions,
} from '../../../types/index.js'
import { deleteDocument } from '../delete.js'

describe('delete operation', () => {
  const mockConfig: RevealCollectionConfig = {
    slug: 'test-collection',
    fields: [],
  }

  const mockDb = {
    query: vi.fn(),
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should delete a document by ID', async () => {
    const options: RevealDeleteOptions = {
      id: 'test-id',
    }

    mockDb.query.mockResolvedValue({ rows: [] } as DatabaseResult)

    const result = await deleteDocument(mockConfig, mockDb as never, options)

    expect(result).toEqual({ id: 'test-id' })
    expect(mockDb.query).toHaveBeenCalledWith('DELETE FROM "test-collection" WHERE id = $1', [
      'test-id',
    ])
  })

  it('should handle string and number IDs', async () => {
    mockDb.query.mockResolvedValue({ rows: [] } as DatabaseResult)

    const result1 = await deleteDocument(mockConfig, mockDb as never, {
      id: '123',
    })
    expect(result1).toEqual({ id: '123' })

    const result2 = await deleteDocument(mockConfig, mockDb as never, {
      id: 123,
    })
    expect(result2).toEqual({ id: 123 })
  })

  it('should return document ID when db is null', async () => {
    const options: RevealDeleteOptions = {
      id: 'test-id',
    }

    const result = await deleteDocument(mockConfig, null, options)

    expect(result).toEqual({ id: 'test-id' })
    expect(mockDb.query).not.toHaveBeenCalled()
  })
})
