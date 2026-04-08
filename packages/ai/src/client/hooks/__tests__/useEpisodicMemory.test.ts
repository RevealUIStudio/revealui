/**
 * useEpisodicMemory Hook Tests
 *
 * Tests for the episodic memory management hook.
 *
 * @vitest-environment jsdom
 */

import type { AgentMemory } from '@revealui/contracts/agents';
import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useEpisodicMemory } from '../useEpisodicMemory.js';

// Mock fetch globally
global.fetch = vi.fn();

describe('useEpisodicMemory', () => {
  const mockUserId = 'user-123';
  const mockMemory: AgentMemory = {
    id: 'mem-1',
    version: 1,
    content: 'User prefers dark theme',
    type: 'preference',
    source: { type: 'user', id: 'user-123', confidence: 1 },
    metadata: { importance: 0.8 },
    accessCount: 0,
    accessedAt: new Date().toISOString(),
    verified: false,
    createdAt: new Date().toISOString(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Initial Load', () => {
    it('should load memories on mount', async () => {
      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          memories: [mockMemory],
          accessCount: 5,
        }),
      });

      const { result } = renderHook(() => useEpisodicMemory(mockUserId));

      expect(result.current.isLoading).toBe(true);

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.memories).toEqual([mockMemory]);
      expect(result.current.accessCount).toBe(5);
      expect(result.current.error).toBeNull();
      expect(global.fetch).toHaveBeenCalledWith(`/api/memory/episodic/${mockUserId}`);
    });

    it('should handle empty memories', async () => {
      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          memories: [],
          accessCount: 0,
        }),
      });

      const { result } = renderHook(() => useEpisodicMemory(mockUserId));

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.memories).toEqual([]);
      expect(result.current.accessCount).toBe(0);
    });

    it('should filter out invalid memories', async () => {
      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          memories: [mockMemory, { invalid: 'memory' }, null, undefined],
          accessCount: 1,
        }),
      });

      const { result } = renderHook(() => useEpisodicMemory(mockUserId));

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.memories).toEqual([mockMemory]);
    });

    it('should handle fetch error', async () => {
      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: false,
        statusText: 'Internal Server Error',
      });

      const { result } = renderHook(() => useEpisodicMemory(mockUserId));

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.error).toBeInstanceOf(Error);
      expect(result.current.error?.message).toContain('Failed to load episodic memory');
      expect(result.current.memories).toEqual([]);
    });
  });

  describe('Memory Operations', () => {
    it('should add memory', async () => {
      const newMemory: AgentMemory = {
        ...mockMemory,
        id: 'mem-2',
        content: 'New memory',
      };

      (global.fetch as ReturnType<typeof vi.fn>)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ memories: [mockMemory], accessCount: 1 }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ tag: 'tag-123' }),
        });

      const { result } = renderHook(() => useEpisodicMemory(mockUserId));

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      let tag = '';
      await act(async () => {
        tag = await result.current.addMemory(newMemory);
      });

      expect(tag).toBe('tag-123');
      expect(global.fetch).toHaveBeenCalledWith(
        `/api/memory/episodic/${mockUserId}`,
        expect.objectContaining({
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(newMemory),
        }),
      );
    });

    it('should remove memory', async () => {
      (global.fetch as ReturnType<typeof vi.fn>)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ memories: [mockMemory], accessCount: 1 }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({}),
        });

      const { result } = renderHook(() => useEpisodicMemory(mockUserId));

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      await act(async () => {
        await result.current.removeMemory('mem-1');
      });

      expect(global.fetch).toHaveBeenCalledWith(
        `/api/memory/episodic/${mockUserId}/mem-1`,
        expect.objectContaining({
          method: 'DELETE',
        }),
      );
    });

    it('should get memory by id', async () => {
      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ memories: [mockMemory], accessCount: 1 }),
      });

      const { result } = renderHook(() => useEpisodicMemory(mockUserId));

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      const memory = result.current.getMemory('mem-1');
      expect(memory).toEqual(mockMemory);

      const nonExistent = result.current.getMemory('non-existent');
      expect(nonExistent).toBeUndefined();
    });

    it('should search memories', async () => {
      const searchResults = [mockMemory];
      (global.fetch as ReturnType<typeof vi.fn>)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ memories: [mockMemory], accessCount: 1 }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ results: [{ memory: mockMemory, similarity: 0.9 }] }),
        });

      const { result } = renderHook(() => useEpisodicMemory(mockUserId));

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      const results = await result.current.search('dark theme');

      expect(results).toEqual(searchResults);
      expect(global.fetch).toHaveBeenCalledWith(
        '/api/memory/search-text',
        expect.objectContaining({
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ query: 'dark theme', options: { limit: 20, threshold: 0.5 } }),
        }),
      );
    });

    it('should handle search error', async () => {
      (global.fetch as ReturnType<typeof vi.fn>)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ memories: [mockMemory], accessCount: 1 }),
        })
        .mockResolvedValueOnce({
          ok: false,
          statusText: 'Bad Request',
        });

      const { result } = renderHook(() => useEpisodicMemory(mockUserId));

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      const results = await result.current.search('query');

      expect(results).toEqual([]);
    });
  });

  describe('Refresh', () => {
    it('should refresh memories', async () => {
      const updatedMemory = { ...mockMemory, content: 'Updated content' };
      (global.fetch as ReturnType<typeof vi.fn>)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ memories: [mockMemory], accessCount: 1 }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ memories: [updatedMemory], accessCount: 2 }),
        });

      const { result } = renderHook(() => useEpisodicMemory(mockUserId));

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.memories[0].content).toBe('User prefers dark theme');

      await act(async () => {
        await result.current.refresh();
      });

      await waitFor(() => {
        expect(result.current.memories[0].content).toBe('Updated content');
        expect(result.current.accessCount).toBe(2);
      });
    });
  });

  describe('Edge Cases', () => {
    it('should handle non-array memories data', async () => {
      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          memories: 'invalid',
          accessCount: 0,
        }),
      });

      const { result } = renderHook(() => useEpisodicMemory(mockUserId));

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.memories).toEqual([]);
    });

    it('should handle missing accessCount', async () => {
      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          memories: [mockMemory],
        }),
      });

      const { result } = renderHook(() => useEpisodicMemory(mockUserId));

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.accessCount).toBe(0);
    });

    it('should handle invalid response structure', async () => {
      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: true,
        json: async () => null,
      });

      const { result } = renderHook(() => useEpisodicMemory(mockUserId));

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.memories).toEqual([]);
      expect(result.current.accessCount).toBe(0);
    });
  });
});
