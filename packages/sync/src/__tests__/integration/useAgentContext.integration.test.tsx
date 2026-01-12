/**
 * useAgentContext Hook Integration Tests
 *
 * Tests the hybrid approach: ElectricSQL shapes for reads, RevealUI API for mutations
 */

import { renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useAgentContext } from '../../hooks/useAgentContext'
import type { AgentContext } from '../../schema'
import { createWrapper, mockRevealUIAPI } from '../utils/test-utils'

// Mock useShape from @electric-sql/react
const mockUseShape = vi.fn()
vi.mock('@electric-sql/react', () => ({
  useShape: (params: unknown) => mockUseShape(params),
}))

describe('useAgentContext Hook - Integration Tests', () => {
  let mockFetch: { restore: () => void }

  beforeEach(() => {
    // Reset mocks
    vi.clearAllMocks()

    // Mock useShape to return empty data by default
    mockUseShape.mockReturnValue({
      data: [],
      isLoading: false,
      error: null,
      isError: false,
    })

    // Mock RevealUI API
    mockFetch = mockRevealUIAPI({
      'POST /api/memory/context/session-123/agent-456': { success: true },
    })
  })

  afterEach(() => {
    mockFetch.restore()
  })

  describe('Reads via ElectricSQL Shapes', () => {
    it('should use ElectricSQL useShape for reading contexts', () => {
      const mockContexts: AgentContext[] = [
        {
          id: 'session-123:agent-456',
          version: 1,
          session_id: 'session-123',
          agent_id: 'agent-456',
          context: { tokensUsed: 100 },
          priority: 0.5,
          created_at: new Date(),
          updated_at: new Date(),
        },
      ]

      mockUseShape.mockReturnValue({
        data: mockContexts,
        isLoading: false,
        error: null,
        isError: false,
      })

      const { result } = renderHook(
        () => useAgentContext('agent-456', { sessionId: 'session-123' }),
        { wrapper: createWrapper() },
      )

      expect(mockUseShape).toHaveBeenCalled()
      expect(result.current.context).toBeDefined()
      expect(result.current.isLoading).toBe(false)
    })

    it('should handle loading state from useShape', () => {
      mockUseShape.mockReturnValue({
        data: [],
        isLoading: true,
        error: null,
        isError: false,
      })

      const { result } = renderHook(() => useAgentContext('agent-456'), {
        wrapper: createWrapper(),
      })

      expect(result.current.isLoading).toBe(true)
    })

    it('should handle errors from useShape', () => {
      const mockError = new Error('Shape subscription failed')
      mockUseShape.mockReturnValue({
        data: [],
        isLoading: false,
        error: mockError,
        isError: true,
      })

      const { result } = renderHook(() => useAgentContext('agent-456'), {
        wrapper: createWrapper(),
      })

      expect(result.current.error).toBeDefined()
      expect(result.current.error?.message).toContain('Shape subscription failed')
    })
  })

  describe('Mutations via RevealUI API', () => {
    it('should call RevealUI API for context updates', async () => {
      const { result } = renderHook(
        () => useAgentContext('agent-456', { sessionId: 'session-123' }),
        { wrapper: createWrapper() },
      )

      const updateSpy = vi.spyOn(global, 'fetch')

      await result.current.updateContext({
        context: { tokensUsed: 150 },
      })

      expect(updateSpy).toHaveBeenCalledWith(
        expect.stringContaining('/api/memory/context/session-123/agent-456'),
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'Content-Type': 'application/json',
          }),
          body: expect.stringContaining('tokensUsed'),
        }),
      )
    })

    it('should handle API errors gracefully', async () => {
      // Mock API failure
      global.fetch = vi.fn(() =>
        Promise.resolve({
          ok: false,
          status: 500,
          text: () => Promise.resolve('Internal server error'),
        } as Response),
      )

      const { result } = renderHook(
        () => useAgentContext('agent-456', { sessionId: 'session-123' }),
        { wrapper: createWrapper() },
      )

      await expect(result.current.updateContext({ context: { test: 'value' } })).rejects.toThrow()
    })

    it('should use correct sessionId when provided', async () => {
      const { result } = renderHook(
        () => useAgentContext('agent-456', { sessionId: 'custom-session' }),
        { wrapper: createWrapper() },
      )

      const updateSpy = vi.spyOn(global, 'fetch')

      await result.current.updateContext({
        context: { test: 'value' },
      })

      expect(updateSpy).toHaveBeenCalledWith(
        expect.stringContaining('/api/memory/context/custom-session/agent-456'),
        expect.any(Object),
      )
    })

    it('should use default sessionId when not provided', async () => {
      const mockContexts: AgentContext[] = [
        {
          id: 'default:agent-456',
          version: 1,
          session_id: 'default',
          agent_id: 'agent-456',
          context: {},
          priority: 0.5,
          created_at: new Date(),
          updated_at: new Date(),
        },
      ]

      mockUseShape.mockReturnValue({
        data: mockContexts,
        isLoading: false,
        error: null,
        isError: false,
      })

      const { result } = renderHook(() => useAgentContext('agent-456'), {
        wrapper: createWrapper(),
      })

      const updateSpy = vi.spyOn(global, 'fetch')

      await result.current.updateContext({
        context: { test: 'value' },
      })

      // Should use 'default' as sessionId
      expect(updateSpy).toHaveBeenCalledWith(
        expect.stringContaining('/api/memory/context/default/agent-456'),
        expect.any(Object),
      )
    })
  })

  describe('Hybrid Approach Verification', () => {
    it('should use ElectricSQL for reads and RevealUI API for mutations', async () => {
      const mockContexts: AgentContext[] = [
        {
          id: 'session-123:agent-456',
          version: 1,
          session_id: 'session-123',
          agent_id: 'agent-456',
          context: { initial: 'data' },
          priority: 0.5,
          created_at: new Date(),
          updated_at: new Date(),
        },
      ]

      mockUseShape.mockReturnValue({
        data: mockContexts,
        isLoading: false,
        error: null,
        isError: false,
      })

      const { result } = renderHook(
        () => useAgentContext('agent-456', { sessionId: 'session-123' }),
        { wrapper: createWrapper() },
      )

      // Verify read uses ElectricSQL
      expect(mockUseShape).toHaveBeenCalled()
      expect(result.current.context).toBeDefined()
      expect(result.current.context?.context).toEqual({ initial: 'data' })

      // Verify mutation uses RevealUI API
      const fetchSpy = vi.spyOn(global, 'fetch')
      await result.current.updateContext({ context: { updated: 'data' } })

      expect(fetchSpy).toHaveBeenCalledWith(
        expect.stringContaining('/api/memory/context'),
        expect.any(Object),
      )
      expect(fetchSpy).not.toHaveBeenCalledWith(
        expect.stringContaining('/v1/agent_contexts'),
        expect.any(Object),
      )
    })
  })
})
