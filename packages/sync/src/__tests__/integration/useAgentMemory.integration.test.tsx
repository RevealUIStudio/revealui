/**
 * useAgentMemory Hook Integration Tests
 *
 * Tests the hybrid approach: ElectricSQL shapes for reads, RevealUI API for mutations
 */

import { renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useAgentMemory } from '../../hooks/useAgentMemory'
import type { AgentMemory } from '../../schema'
import { createWrapper, mockRevealUIAPI } from '../utils/test-utils'

// Mock useShape from @electric-sql/react
const mockUseShape = vi.fn()
vi.mock('@electric-sql/react', () => ({
  useShape: (params: unknown) => mockUseShape(params),
}))

describe('useAgentMemory Hook - Integration Tests', () => {
  let mockFetch: { restore: () => void }

  beforeEach(() => {
    vi.clearAllMocks()

    mockUseShape.mockReturnValue({
      data: [],
      isLoading: false,
      error: null,
      isError: false,
    })

    mockFetch = mockRevealUIAPI({
      'POST /api/memory/episodic/agent-123': { success: true },
      'PUT /api/memory/episodic/agent-123/memory-id': { success: true },
      'DELETE /api/memory/episodic/agent-123/memory-id': { success: true },
    })
  })

  afterEach(() => {
    mockFetch.restore()
  })

  describe('Reads via ElectricSQL Shapes', () => {
    it('should use ElectricSQL useShape for reading memories', () => {
      const mockMemories: AgentMemory[] = [
        {
          id: 'memory-1',
          version: 1,
          content: 'Test memory',
          type: 'fact',
          source: { type: 'user', id: 'user-123' },
          metadata: null,
          access_count: null,
          accessed_at: null,
          verified: null,
          verified_by: null,
          verified_at: null,
          site_id: null,
          agent_id: 'agent-123',
          created_at: new Date(),
          expires_at: null,
        },
      ]

      mockUseShape.mockReturnValue({
        data: mockMemories,
        isLoading: false,
        error: null,
        isError: false,
      })

      const { result } = renderHook(() => useAgentMemory('agent-123'), { wrapper: createWrapper() })

      expect(mockUseShape).toHaveBeenCalled()
      expect(result.current.memories).toHaveLength(1)
      expect(result.current.memories[0].content).toBe('Test memory')
    })
  })

  describe('Mutations via RevealUI API', () => {
    it('should call RevealUI API for creating memories', async () => {
      const { result } = renderHook(() => useAgentMemory('agent-123'), { wrapper: createWrapper() })

      const fetchSpy = vi.spyOn(global, 'fetch')

      await result.current.addMemory({
        content: 'New memory',
        type: 'fact',
        source: { type: 'user', id: 'user-123' },
        metadata: null,
      })

      expect(fetchSpy).toHaveBeenCalledWith(
        expect.stringContaining('/api/memory/episodic/agent-123'),
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'Content-Type': 'application/json',
          }),
          body: expect.stringContaining('New memory'),
        }),
      )
    })

    it('should call RevealUI API for updating memories', async () => {
      const { result } = renderHook(() => useAgentMemory('agent-123'), { wrapper: createWrapper() })

      const fetchSpy = vi.spyOn(global, 'fetch')

      await result.current.updateMemory('memory-id', {
        metadata: { importance: 0.9 },
      })

      expect(fetchSpy).toHaveBeenCalledWith(
        expect.stringContaining('/api/memory/episodic/agent-123/memory-id'),
        expect.objectContaining({
          method: 'PUT',
        }),
      )
    })

    it('should call RevealUI API for deleting memories', async () => {
      const { result } = renderHook(() => useAgentMemory('agent-123'), { wrapper: createWrapper() })

      const fetchSpy = vi.spyOn(global, 'fetch')

      await result.current.deleteMemory('memory-id')

      expect(fetchSpy).toHaveBeenCalledWith(
        expect.stringContaining('/api/memory/episodic/agent-123/memory-id'),
        expect.objectContaining({
          method: 'DELETE',
        }),
      )
    })

    it('should handle API errors gracefully', async () => {
      global.fetch = vi.fn(() =>
        Promise.resolve({
          ok: false,
          status: 400,
          text: () => Promise.resolve('Bad request'),
        } as Response),
      )

      const { result } = renderHook(() => useAgentMemory('agent-123'), { wrapper: createWrapper() })

      await expect(
        result.current.addMemory({
          content: 'Test',
          type: 'fact',
          source: { type: 'user', id: 'user-123' },
        }),
      ).rejects.toThrow()
    })
  })

  describe('Hybrid Approach Verification', () => {
    it('should use ElectricSQL for reads and RevealUI API for mutations', async () => {
      const mockMemories: AgentMemory[] = [
        {
          id: 'memory-1',
          version: 1,
          content: 'Initial memory',
          type: 'fact',
          source: { type: 'user', id: 'user-123' },
          metadata: null,
          access_count: null,
          accessed_at: null,
          verified: null,
          verified_by: null,
          verified_at: null,
          site_id: null,
          agent_id: 'agent-123',
          created_at: new Date(),
          expires_at: null,
        },
      ]

      mockUseShape.mockReturnValue({
        data: mockMemories,
        isLoading: false,
        error: null,
        isError: false,
      })

      const { result } = renderHook(() => useAgentMemory('agent-123'), { wrapper: createWrapper() })

      // Verify read uses ElectricSQL
      expect(mockUseShape).toHaveBeenCalled()
      expect(result.current.memories).toHaveLength(1)

      // Verify mutation uses RevealUI API (not ElectricSQL REST)
      const fetchSpy = vi.spyOn(global, 'fetch')
      await result.current.addMemory({
        content: 'New memory',
        type: 'fact',
        source: { type: 'user', id: 'user-123' },
      })

      expect(fetchSpy).toHaveBeenCalledWith(
        expect.stringContaining('/api/memory/episodic'),
        expect.any(Object),
      )
      expect(fetchSpy).not.toHaveBeenCalledWith(
        expect.stringContaining('/v1/agent_memories'),
        expect.any(Object),
      )
    })
  })
})
