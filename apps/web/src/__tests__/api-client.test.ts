/**
 * API Client Tests
 *
 * Tests the type-safe API wrapper for apps/api endpoints.
 * Mocks fetch to verify request formatting, error handling, and response parsing.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { boardsApi, labelsApi, ticketsApi } from '../utils/api-client'

const mockFetch = vi.fn()

beforeEach(() => {
  mockFetch.mockReset()
  vi.stubGlobal('fetch', mockFetch)
})

afterEach(() => {
  vi.restoreAllMocks()
})

function mockJsonResponse(data: unknown, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(data),
  }
}

describe('apiFetch wrapper', () => {
  it('should set Content-Type header on all requests', async () => {
    mockFetch.mockResolvedValueOnce(mockJsonResponse({ success: true, data: [] }))

    await boardsApi.getAll()

    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/tickets/boards'),
      expect.objectContaining({
        headers: expect.objectContaining({
          'Content-Type': 'application/json',
        }),
      }),
    )
  })

  it('should return error response on HTTP error status', async () => {
    mockFetch.mockResolvedValueOnce(mockJsonResponse({ error: 'Not found' }, 404))

    const result = await boardsApi.getById('nonexistent')

    expect(result.success).toBe(false)
    expect(result.error).toBe('Not found')
  })

  it('should return generic error message when no error in response body', async () => {
    mockFetch.mockResolvedValueOnce(mockJsonResponse({}, 500))

    const result = await boardsApi.getById('broken')

    expect(result.success).toBe(false)
    expect(result.error).toContain('HTTP error 500')
  })

  it('should handle network errors gracefully', async () => {
    mockFetch.mockRejectedValueOnce(new Error('Failed to fetch'))

    const result = await boardsApi.getAll()

    expect(result.success).toBe(false)
    expect(result.error).toBe('Failed to fetch')
  })

  it('should handle non-Error thrown objects', async () => {
    mockFetch.mockRejectedValueOnce('string error')

    const result = await boardsApi.getAll()

    expect(result.success).toBe(false)
    expect(result.error).toBe('Network error')
  })
})

describe('boardsApi', () => {
  it('getAll calls GET /api/tickets/boards', async () => {
    mockFetch.mockResolvedValueOnce(
      mockJsonResponse({ success: true, data: [{ id: '1', name: 'Board 1' }] }),
    )

    const result = await boardsApi.getAll()

    expect(result.success).toBe(true)
    expect(result.data).toHaveLength(1)
    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/tickets/boards'),
      expect.any(Object),
    )
  })

  it('create sends POST with JSON body', async () => {
    mockFetch.mockResolvedValueOnce(
      mockJsonResponse({ success: true, data: { id: '1', name: 'New Board', slug: 'new-board' } }),
    )

    await boardsApi.create({ name: 'New Board', slug: 'new-board' })

    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/tickets/boards'),
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ name: 'New Board', slug: 'new-board' }),
      }),
    )
  })

  it('update sends PATCH to correct endpoint', async () => {
    mockFetch.mockResolvedValueOnce(
      mockJsonResponse({ success: true, data: { id: 'abc', name: 'Updated' } }),
    )

    await boardsApi.update('abc', { name: 'Updated' })

    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/tickets/boards/abc'),
      expect.objectContaining({
        method: 'PATCH',
        body: JSON.stringify({ name: 'Updated' }),
      }),
    )
  })

  it('delete sends DELETE to correct endpoint', async () => {
    mockFetch.mockResolvedValueOnce(
      mockJsonResponse({ success: true, data: { message: 'Deleted' } }),
    )

    await boardsApi.delete('abc')

    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/tickets/boards/abc'),
      expect.objectContaining({ method: 'DELETE' }),
    )
  })
})

describe('ticketsApi', () => {
  it('getByBoard includes filter query params', async () => {
    mockFetch.mockResolvedValueOnce(mockJsonResponse({ success: true, data: [] }))

    await ticketsApi.getByBoard('board-1', { status: 'open', priority: 'high' })

    const calledUrl = mockFetch.mock.calls[0]![0] as string
    expect(calledUrl).toContain('/api/tickets/boards/board-1/tickets')
    expect(calledUrl).toContain('status=open')
    expect(calledUrl).toContain('priority=high')
  })

  it('move sends POST with columnId and position', async () => {
    mockFetch.mockResolvedValueOnce(mockJsonResponse({ success: true, data: { id: 't1' } }))

    await ticketsApi.move('t1', 'col-2', 3)

    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/tickets/tickets/t1/move'),
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ columnId: 'col-2', sortOrder: 3 }),
      }),
    )
  })

  it('addComment sends POST with body content', async () => {
    mockFetch.mockResolvedValueOnce(mockJsonResponse({ success: true, data: { id: 'c1' } }))

    await ticketsApi.addComment('t1', 'Great work!')

    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/tickets/tickets/t1/comments'),
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ body: 'Great work!', authorId: undefined }),
      }),
    )
  })
})

describe('labelsApi', () => {
  it('create sends POST with label data', async () => {
    mockFetch.mockResolvedValueOnce(
      mockJsonResponse({ success: true, data: { id: 'l1', name: 'Bug', slug: 'bug' } }),
    )

    await labelsApi.create({ name: 'Bug', slug: 'bug', color: '#ff0000' })

    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/tickets/labels'),
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ name: 'Bug', slug: 'bug', color: '#ff0000' }),
      }),
    )
  })
})
