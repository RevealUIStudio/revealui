import { renderHook } from '@testing-library/react'
import type { ReactNode } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ElectricProvider } from '../../provider/index.js'
import { useAgentMemory } from '../useAgentMemory.js'

vi.mock('@electric-sql/react', () => ({
  useShape: vi.fn(),
}))

import { useShape } from '@electric-sql/react'

const mockUseShape = useShape as ReturnType<typeof vi.fn>

describe('useAgentMemory', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should return empty array when no data', () => {
    mockUseShape.mockReturnValue({ data: null, isLoading: false, error: null })

    const { result } = renderHook(() => useAgentMemory('agent-123'))

    expect(result.current.memories).toEqual([])
    expect(result.current.isLoading).toBe(false)
    expect(result.current.error).toBeNull()
  })

  it('should return memory data for valid agentId', () => {
    const mockData = [
      {
        id: 'mem-1',
        agent_id: 'agent-123',
        content: 'some memory',
        type: 'episodic',
        metadata: {},
        created_at: '2024-01-01T00:00:00Z',
        expires_at: null,
      },
    ]
    mockUseShape.mockReturnValue({ data: mockData, isLoading: false, error: null })

    const { result } = renderHook(() => useAgentMemory('agent-123'))

    expect(result.current.memories).toEqual(mockData)
    expect(result.current.error).toBeNull()
  })

  it('should handle loading state', () => {
    mockUseShape.mockReturnValue({ data: null, isLoading: true, error: null })

    const { result } = renderHook(() => useAgentMemory('agent-123'))

    expect(result.current.memories).toEqual([])
    expect(result.current.isLoading).toBe(true)
  })

  it('should handle error state from shape', () => {
    const mockError = new Error('Shape fetch failed')
    mockUseShape.mockReturnValue({ data: null, isLoading: false, error: mockError })

    const { result } = renderHook(() => useAgentMemory('agent-123'))

    expect(result.current.memories).toEqual([])
    expect(result.current.error).toBe(mockError)
  })

  it('should call useShape with agentId param for valid id', () => {
    mockUseShape.mockReturnValue({ data: [], isLoading: false, error: null })

    renderHook(() => useAgentMemory('my-agent_01'))

    expect(mockUseShape).toHaveBeenCalledWith({
      url: '/api/shapes/agent-memories',
      params: { agent_id: 'my-agent_01' },
    })
  })

  it('should return error immediately for empty agentId without calling shape with bad param', () => {
    mockUseShape.mockReturnValue({ data: null, isLoading: false, error: null })

    const { result } = renderHook(() => useAgentMemory(''))

    expect(result.current.memories).toEqual([])
    expect(result.current.isLoading).toBe(false)
    expect(result.current.error?.message).toMatch(/Invalid agentId/)
    // Shape is still called (rules of hooks) but with __invalid__ sentinel
    expect(mockUseShape).toHaveBeenCalledWith({
      url: '/api/shapes/agent-memories',
      params: { agent_id: '__invalid__' },
    })
  })

  it('should return error for agentId with special characters', () => {
    mockUseShape.mockReturnValue({ data: null, isLoading: false, error: null })

    const { result } = renderHook(() => useAgentMemory('agent/bad;id'))

    expect(result.current.error?.message).toMatch(/Invalid agentId/)
    expect(mockUseShape).toHaveBeenCalledWith({
      url: '/api/shapes/agent-memories',
      params: { agent_id: '__invalid__' },
    })
  })

  it('should use proxyBaseUrl from ElectricProvider when provided', () => {
    mockUseShape.mockReturnValue({ data: [], isLoading: false, error: null })

    const wrapper = ({ children }: { children: ReactNode }) => (
      <ElectricProvider proxyBaseUrl="https://cms.example.com">{children}</ElectricProvider>
    )

    renderHook(() => useAgentMemory('agent-123'), { wrapper })

    expect(mockUseShape).toHaveBeenCalledWith({
      url: 'https://cms.example.com/api/shapes/agent-memories',
      params: { agent_id: 'agent-123' },
    })
  })

  it('should handle non-array data gracefully', () => {
    mockUseShape.mockReturnValue({
      data: 'invalid' as unknown,
      isLoading: false,
      error: null,
    })

    const { result } = renderHook(() => useAgentMemory('agent-123'))

    expect(result.current.memories).toEqual([])
  })
})
