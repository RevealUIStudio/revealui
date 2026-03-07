import { renderHook } from '@testing-library/react'
import type { ReactNode } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ElectricProvider } from '../../provider/index.js'
import { useAgentContexts } from '../useAgentContexts.js'

vi.mock('@electric-sql/react', () => ({
  useShape: vi.fn(),
}))

import { useShape } from '@electric-sql/react'

const mockUseShape = useShape as ReturnType<typeof vi.fn>

describe('useAgentContexts', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should return empty array when no data', () => {
    mockUseShape.mockReturnValue({ data: null, isLoading: false, error: null })

    const { result } = renderHook(() => useAgentContexts())

    expect(result.current.contexts).toEqual([])
    expect(result.current.isLoading).toBe(false)
    expect(result.current.error).toBeNull()
  })

  it('should return contexts data', () => {
    const mockData = [
      {
        id: 'ctx-1',
        session_id: 'sess-1',
        agent_id: 'agent-1',
        context: { key: 'value' },
        priority: 1,
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z',
      },
    ]
    mockUseShape.mockReturnValue({ data: mockData, isLoading: false, error: null })

    const { result } = renderHook(() => useAgentContexts())

    expect(result.current.contexts).toEqual(mockData)
    expect(result.current.isLoading).toBe(false)
    expect(result.current.error).toBeNull()
  })

  it('should handle loading state', () => {
    mockUseShape.mockReturnValue({ data: null, isLoading: true, error: null })

    const { result } = renderHook(() => useAgentContexts())

    expect(result.current.contexts).toEqual([])
    expect(result.current.isLoading).toBe(true)
  })

  it('should handle error state', () => {
    const mockError = new Error('Shape fetch failed')
    mockUseShape.mockReturnValue({ data: null, isLoading: false, error: mockError })

    const { result } = renderHook(() => useAgentContexts())

    expect(result.current.contexts).toEqual([])
    expect(result.current.error).toBe(mockError)
  })

  it('should call useShape with default relative URL when no proxyBaseUrl', () => {
    mockUseShape.mockReturnValue({ data: [], isLoading: false, error: null })

    renderHook(() => useAgentContexts())

    expect(mockUseShape).toHaveBeenCalledWith({
      url: '/api/shapes/agent-contexts',
    })
  })

  it('should use proxyBaseUrl from ElectricProvider when provided', () => {
    mockUseShape.mockReturnValue({ data: [], isLoading: false, error: null })

    const wrapper = ({ children }: { children: ReactNode }) => (
      <ElectricProvider proxyBaseUrl="https://cms.example.com">{children}</ElectricProvider>
    )

    renderHook(() => useAgentContexts(), { wrapper })

    expect(mockUseShape).toHaveBeenCalledWith({
      url: 'https://cms.example.com/api/shapes/agent-contexts',
    })
  })

  it('should handle non-array data gracefully', () => {
    mockUseShape.mockReturnValue({
      data: 'invalid' as unknown,
      isLoading: false,
      error: null,
    })

    const { result } = renderHook(() => useAgentContexts())

    expect(result.current.contexts).toEqual([])
  })
})
