import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook } from '@testing-library/react'
import { useConversations } from '../useConversations.js'

// Mock @electric-sql/react
vi.mock('@electric-sql/react', () => ({
  useShape: vi.fn(),
}))

import { useShape } from '@electric-sql/react'

const mockUseShape = useShape as ReturnType<typeof vi.fn>

describe('useConversations', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should return empty array when no data', () => {
    mockUseShape.mockReturnValue({
      data: null,
      isLoading: false,
      error: null,
    })

    const { result } = renderHook(() => useConversations('user-123'))

    expect(result.current.conversations).toEqual([])
    expect(result.current.isLoading).toBe(false)
    expect(result.current.error).toBeNull()
  })

  it('should transform data correctly', () => {
    const mockData = [
      { id: '1', title: 'Conversation 1' },
      { id: '2', title: 'Conversation 2' },
    ]

    mockUseShape.mockReturnValue({
      data: mockData,
      isLoading: false,
      error: null,
    })

    const { result } = renderHook(() => useConversations('user-123'))

    expect(result.current.conversations).toEqual(mockData)
    expect(result.current.isLoading).toBe(false)
    expect(result.current.error).toBeNull()
  })

  it('should handle loading state', () => {
    mockUseShape.mockReturnValue({
      data: null,
      isLoading: true,
      error: null,
    })

    const { result } = renderHook(() => useConversations('user-123'))

    expect(result.current.conversations).toEqual([])
    expect(result.current.isLoading).toBe(true)
    expect(result.current.error).toBeNull()
  })

  it('should handle error state', () => {
    const mockError = new Error('Failed to fetch')
    mockUseShape.mockReturnValue({
      data: null,
      isLoading: false,
      error: mockError,
    })

    const { result } = renderHook(() => useConversations('user-123'))

    expect(result.current.conversations).toEqual([])
    expect(result.current.isLoading).toBe(false)
    expect(result.current.error).toBe(mockError)
  })

  it('should filter by userId using parameterized query', () => {
    const userId = 'user-456'
    mockUseShape.mockReturnValue({
      data: [],
      isLoading: false,
      error: null,
    })

    renderHook(() => useConversations(userId))

    expect(mockUseShape).toHaveBeenCalledWith({
      url: '/api/shapes/conversations',
      params: {
        table: 'conversations',
        where: 'user_id = $1',
        'params[1]': userId,
      },
    })
  })

  it('should handle non-array data gracefully', () => {
    mockUseShape.mockReturnValue({
      data: 'invalid-data' as any,
      isLoading: false,
      error: null,
    })

    const { result } = renderHook(() => useConversations('user-123'))

    expect(result.current.conversations).toEqual([])
  })

  it('should handle conversations with null titles', () => {
    const mockData = [
      { id: '1', title: null },
      { id: '2', title: 'Valid Title' },
    ]

    mockUseShape.mockReturnValue({
      data: mockData,
      isLoading: false,
      error: null,
    })

    const { result } = renderHook(() => useConversations('user-123'))

    expect(result.current.conversations).toEqual(mockData)
    expect(result.current.conversations[0].title).toBeNull()
    expect(result.current.conversations[1].title).toBe('Valid Title')
  })

  it('should handle numeric conversation IDs', () => {
    const mockData = [
      { id: 1, title: 'Conversation 1' },
      { id: 2, title: 'Conversation 2' },
    ]

    mockUseShape.mockReturnValue({
      data: mockData,
      isLoading: false,
      error: null,
    })

    const { result } = renderHook(() => useConversations('user-123'))

    expect(result.current.conversations[0].id).toBe(1)
    expect(result.current.conversations[1].id).toBe(2)
  })
})
