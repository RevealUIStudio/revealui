/**
 * useWorkingMemory Hook Tests
 *
 * Tests for the working memory management hook.
 *
 * @vitest-environment jsdom
 */

import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useWorkingMemory } from '../useWorkingMemory.js';

// Mock fetch globally
global.fetch = vi.fn();

describe('useWorkingMemory', () => {
  const mockUserId = 'user-123';
  const mockContext = {
    theme: 'dark',
    language: 'en',
  };
  const mockSessionState = {
    status: 'active' as const,
    focus: {
      siteId: 'site-1',
      pageId: 'page-1',
    },
    currentTask: {
      id: 'task-1',
      description: 'Build feature',
      status: 'running' as const,
      progress: 50,
    },
  };
  const mockAgent = {
    id: 'agent-1',
    name: 'Assistant',
    description: 'Helpful assistant',
    model: 'gpt-4',
    systemPrompt: 'You are helpful',
    tools: [],
    capabilities: ['chat', 'code'],
    temperature: 0.7,
    maxTokens: 2000,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Initial Load', () => {
    it('should load working memory on mount', async () => {
      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          context: mockContext,
          sessionState: mockSessionState,
          activeAgents: [mockAgent],
        }),
      });

      const { result } = renderHook(() => useWorkingMemory(mockUserId));

      expect(result.current.isLoading).toBe(true);

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.context).toEqual(mockContext);
      expect(result.current.sessionState).toEqual(mockSessionState);
      expect(result.current.activeAgents).toEqual([mockAgent]);
      expect(result.current.error).toBeNull();
    });

    it('should handle empty working memory', async () => {
      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: true,
        json: async () => ({}),
      });

      const { result } = renderHook(() => useWorkingMemory(mockUserId));

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.context).toEqual({});
      expect(result.current.sessionState).toEqual({ status: 'active' });
      expect(result.current.activeAgents).toEqual([]);
    });

    it('should handle fetch error', async () => {
      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: false,
        statusText: 'Not Found',
      });

      const { result } = renderHook(() => useWorkingMemory(mockUserId));

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.error).toBeInstanceOf(Error);
    });
  });

  describe('Context Operations', () => {
    it('should set context', async () => {
      const newContext = { theme: 'light', language: 'es' };
      (global.fetch as ReturnType<typeof vi.fn>)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ context: mockContext, sessionState: {}, activeAgents: [] }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({}),
        });

      const { result } = renderHook(() => useWorkingMemory(mockUserId));

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      await act(async () => {
        await result.current.setContext(newContext);
      });

      expect(global.fetch).toHaveBeenCalledWith(
        `/api/memory/working/${mockUserId}`,
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ context: newContext }),
        }),
      );
    });

    it('should update context', async () => {
      (global.fetch as ReturnType<typeof vi.fn>)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ context: mockContext, sessionState: {}, activeAgents: [] }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({}),
        });

      const { result } = renderHook(() => useWorkingMemory(mockUserId));

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      await act(async () => {
        await result.current.updateContext({ theme: 'light' });
      });

      expect(global.fetch).toHaveBeenCalledWith(
        `/api/memory/working/${mockUserId}`,
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ context: { theme: 'light', language: 'en' } }),
        }),
      );
    });

    it('should get context value', async () => {
      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ context: mockContext, sessionState: {}, activeAgents: [] }),
      });

      const { result } = renderHook(() => useWorkingMemory(mockUserId));

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.getContextValue('theme')).toBe('dark');
      expect(result.current.getContextValue('nonexistent')).toBeUndefined();
    });

    it('should set context value', async () => {
      (global.fetch as ReturnType<typeof vi.fn>)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ context: mockContext, sessionState: {}, activeAgents: [] }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({}),
        });

      const { result } = renderHook(() => useWorkingMemory(mockUserId));

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      await act(async () => {
        await result.current.setContextValue('theme', 'light');
      });

      expect(global.fetch).toHaveBeenCalledWith(
        `/api/memory/working/${mockUserId}`,
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ context: { theme: 'light', language: 'en' } }),
        }),
      );
    });
  });

  describe('Session State Operations', () => {
    it('should update session state', async () => {
      (global.fetch as ReturnType<typeof vi.fn>)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ context: {}, sessionState: mockSessionState, activeAgents: [] }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({}),
        });

      const { result } = renderHook(() => useWorkingMemory(mockUserId));

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      await act(async () => {
        await result.current.updateSessionState({ status: 'paused' });
      });

      expect(global.fetch).toHaveBeenCalledWith(
        `/api/memory/working/${mockUserId}`,
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ sessionState: { status: 'paused' } }),
        }),
      );
    });
  });

  describe('Agent Operations', () => {
    it('should add agent', async () => {
      (global.fetch as ReturnType<typeof vi.fn>)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ context: {}, sessionState: {}, activeAgents: [] }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({}),
        });

      const { result } = renderHook(() => useWorkingMemory(mockUserId));

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      await act(async () => {
        await result.current.addAgent(mockAgent);
      });

      expect(global.fetch).toHaveBeenCalledWith(
        `/api/memory/working/${mockUserId}`,
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ activeAgents: [mockAgent] }),
        }),
      );
    });

    it('should remove agent', async () => {
      (global.fetch as ReturnType<typeof vi.fn>)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ context: {}, sessionState: {}, activeAgents: [mockAgent] }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({}),
        });

      const { result } = renderHook(() => useWorkingMemory(mockUserId));

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      await act(async () => {
        await result.current.removeAgent('agent-1');
      });

      expect(global.fetch).toHaveBeenCalledWith(
        `/api/memory/working/${mockUserId}`,
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ activeAgents: [] }),
        }),
      );
    });
  });

  describe('Auto-sync', () => {
    it('should sync automatically when enabled', async () => {
      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
        ok: true,
        json: async () => ({ context: {}, sessionState: {}, activeAgents: [] }),
      });

      renderHook(() =>
        useWorkingMemory(mockUserId, {
          autoSync: true,
          syncInterval: 100, // Use shorter interval for testing
        }),
      );

      // Wait for initial load
      await waitFor(() => {
        expect((global.fetch as ReturnType<typeof vi.fn>).mock.calls.length).toBe(1);
      });

      // Wait for auto-sync to trigger
      await waitFor(
        () => {
          expect(
            (global.fetch as ReturnType<typeof vi.fn>).mock.calls.length,
          ).toBeGreaterThanOrEqual(2);
        },
        { timeout: 1000 },
      );
    });

    it('should manually sync', async () => {
      (global.fetch as ReturnType<typeof vi.fn>)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ context: {}, sessionState: {}, activeAgents: [] }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ context: { updated: true }, sessionState: {}, activeAgents: [] }),
        });

      const { result } = renderHook(() => useWorkingMemory(mockUserId));

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      await act(async () => {
        await result.current.sync();
      });

      await waitFor(() => {
        expect(result.current.context).toEqual({ updated: true });
      });
    });
  });

  describe('Edge Cases', () => {
    it('should handle invalid active agents', async () => {
      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          context: {},
          sessionState: {},
          activeAgents: [mockAgent, { invalid: 'agent' }, null],
        }),
      });

      const { result } = renderHook(() => useWorkingMemory(mockUserId));

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.activeAgents).toEqual([mockAgent]);
    });

    it('should handle invalid session status', async () => {
      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          context: {},
          sessionState: { status: 'invalid-status' },
          activeAgents: [],
        }),
      });

      const { result } = renderHook(() => useWorkingMemory(mockUserId));

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      // Should default to 'active'
      expect(result.current.sessionState.status).toBe('active');
    });
  });
});
