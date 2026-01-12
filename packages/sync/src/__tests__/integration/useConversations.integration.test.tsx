/**
 * useConversations Hook Integration Tests
 *
 * Tests the hybrid approach: ElectricSQL shapes for reads, RevealUI API for mutations
 */

import { renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useConversations } from '../../hooks/useConversations'
import type { Conversation } from '../../schema'
import { createWrapper, mockRevealUIAPI } from '../utils/test-utils'

// Mock useShape from @electric-sql/react
const mockUseShape = vi.fn()
vi.mock('@electric-sql/react', () => ({
  useShape: (params: unknown) => mockUseShape(params),
}))

describe('useConversations Hook - Integration Tests', () => {
  let mockFetch: { restore: () => void }

  beforeEach(() => {
    vi.clearAllMocks()

    mockUseShape.mockReturnValue({
      data: [],
      isLoading: false,
      error: null,
      isError: false,
    })

    // Mock the API response - the hook expects the full conversation object
    const mockConversation = {
      id: 'conv-123',
      version: 1,
      session_id: 'session-456',
      user_id: 'user-123',
      agent_id: 'agent-456',
      messages: null,
      status: 'active',
      metadata: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }

    // Mock responses - use path-only keys for matching
    mockFetch = mockRevealUIAPI({
      '/api/conversations': mockConversation, // For POST requests
      'POST /api/conversations': mockConversation,
      '/api/conversations/conv-123': { success: true }, // For PATCH/DELETE
      'PATCH /api/conversations/conv-123': { success: true },
      'DELETE /api/conversations/conv-123': { success: true },
    })
  })

  afterEach(() => {
    mockFetch.restore()
  })

  describe('Reads via ElectricSQL Shapes', () => {
    it('should use ElectricSQL useShape for reading conversations', () => {
      const mockConversations: Conversation[] = [
        {
          id: 'conv-1',
          version: 1,
          session_id: 'session-123',
          user_id: 'user-123',
          agent_id: 'agent-456',
          messages: [],
          status: 'active',
          metadata: null,
          created_at: new Date(),
          updated_at: new Date(),
        },
      ]

      mockUseShape.mockReturnValue({
        data: mockConversations,
        isLoading: false,
        error: null,
        isError: false,
      })

      const { result } = renderHook(() => useConversations('user-123'), {
        wrapper: createWrapper(),
      })

      expect(mockUseShape).toHaveBeenCalled()
      expect(result.current.conversations).toHaveLength(1)
      expect(result.current.conversations[0].id).toBe('conv-1')
    })
  })

  describe('Mutations via RevealUI API', () => {
    it('should call RevealUI API for creating conversations', async () => {
      const { result } = renderHook(() => useConversations('user-123'), {
        wrapper: createWrapper(),
      })

      const fetchSpy = vi.spyOn(global, 'fetch')

      const conversation = await result.current.createConversation({
        session_id: 'session-456',
        user_id: 'user-123',
        agent_id: 'agent-456',
        status: 'active',
        messages: null,
        metadata: null,
      })

      expect(fetchSpy).toHaveBeenCalledWith(
        expect.stringContaining('/api/conversations'),
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'Content-Type': 'application/json',
          }),
          body: expect.stringContaining('session-456'),
        }),
      )

      expect(conversation).toBeDefined()
      // The hook generates its own ID and returns the conversation object
      // The API response is merged with the generated ID
      expect(conversation).toHaveProperty('id')
      expect(conversation).toHaveProperty('session_id', 'session-456')
      expect(conversation).toHaveProperty('user_id', 'user-123')
      expect(conversation).toHaveProperty('agent_id', 'agent-456')
    })

    it('should call RevealUI API for updating conversations', async () => {
      const { result } = renderHook(() => useConversations('user-123'), {
        wrapper: createWrapper(),
      })

      const fetchSpy = vi.spyOn(global, 'fetch')

      await result.current.updateConversation('conv-123', {
        status: 'completed',
      })

      expect(fetchSpy).toHaveBeenCalledWith(
        expect.stringContaining('/api/conversations/conv-123'),
        expect.objectContaining({
          method: 'PATCH',
          body: expect.stringContaining('completed'),
        }),
      )
    })

    it('should call RevealUI API for deleting conversations', async () => {
      const { result } = renderHook(() => useConversations('user-123'), {
        wrapper: createWrapper(),
      })

      const fetchSpy = vi.spyOn(global, 'fetch')

      await result.current.deleteConversation('conv-123')

      expect(fetchSpy).toHaveBeenCalledWith(
        expect.stringContaining('/api/conversations/conv-123'),
        expect.objectContaining({
          method: 'DELETE',
        }),
      )
    })

    it('should handle API errors gracefully', async () => {
      global.fetch = vi.fn(() =>
        Promise.resolve({
          ok: false,
          status: 404,
          text: () => Promise.resolve('Not found'),
        } as Response),
      )

      const { result } = renderHook(() => useConversations('user-123'), {
        wrapper: createWrapper(),
      })

      await expect(
        result.current.createConversation({
          session_id: 'session-456',
          user_id: 'user-123',
          agent_id: 'agent-456',
          status: 'active',
          messages: null,
          metadata: null,
        }),
      ).rejects.toThrow()
    })
  })

  describe('Hybrid Approach Verification', () => {
    it('should use ElectricSQL for reads and RevealUI API for mutations', async () => {
      const mockConversations: Conversation[] = [
        {
          id: 'conv-1',
          version: 1,
          session_id: 'session-123',
          user_id: 'user-123',
          agent_id: 'agent-456',
          messages: [],
          status: 'active',
          metadata: null,
          created_at: new Date(),
          updated_at: new Date(),
        },
      ]

      mockUseShape.mockReturnValue({
        data: mockConversations,
        isLoading: false,
        error: null,
        isError: false,
      })

      const { result } = renderHook(() => useConversations('user-123'), {
        wrapper: createWrapper(),
      })

      // Verify read uses ElectricSQL
      expect(mockUseShape).toHaveBeenCalled()
      expect(result.current.conversations).toHaveLength(1)

      // Verify mutation uses RevealUI API (not ElectricSQL REST)
      const fetchSpy = vi.spyOn(global, 'fetch')
      await result.current.createConversation({
        session_id: 'session-456',
        user_id: 'user-123',
        agent_id: 'agent-456',
        status: 'active',
        messages: null,
        metadata: null,
      })

      expect(fetchSpy).toHaveBeenCalledWith(
        expect.stringContaining('/api/conversations'),
        expect.any(Object),
      )
      expect(fetchSpy).not.toHaveBeenCalledWith(
        expect.stringContaining('/v1/conversations'),
        expect.any(Object),
      )
    })
  })
})
