/**
 * useAgentContext Hook Tests
 *
 * Tests for the agent context management hook.
 *
 * @vitest-environment jsdom
 */

import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useAgentContext } from '../useAgentContext.js';

// Mock fetch globally
global.fetch = vi.fn();

describe('useAgentContext', () => {
  const mockSessionId = 'session-123';
  const mockAgentId = 'agent-456';
  const mockContext = {
    theme: 'dark',
    language: 'en',
    preferences: { notifications: true },
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Initial Load', () => {
    it('should load context on mount', async () => {
      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ context: mockContext }),
      });

      const { result } = renderHook(() => useAgentContext(mockSessionId, mockAgentId));

      expect(result.current.isLoading).toBe(true);

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.context).toEqual(mockContext);
      expect(result.current.error).toBeNull();
      expect(global.fetch).toHaveBeenCalledWith(
        `/api/memory/context/${mockSessionId}/${mockAgentId}`,
      );
    });

    it('should handle empty context', async () => {
      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ context: {} }),
      });

      const { result } = renderHook(() => useAgentContext(mockSessionId, mockAgentId));

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.context).toEqual({});
    });

    it('should handle missing context field', async () => {
      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: true,
        json: async () => ({}),
      });

      const { result } = renderHook(() => useAgentContext(mockSessionId, mockAgentId));

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.context).toEqual({});
    });

    it('should handle fetch error', async () => {
      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: false,
        statusText: 'Not Found',
      });

      const { result } = renderHook(() => useAgentContext(mockSessionId, mockAgentId));

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.error).toBeInstanceOf(Error);
      expect(result.current.error?.message).toContain('load agent context failed');
    });

    it('should handle network error', async () => {
      (global.fetch as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new Error('Network error'));

      const { result } = renderHook(() => useAgentContext(mockSessionId, mockAgentId));

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.error).toBeInstanceOf(Error);
      expect(result.current.error?.message).toBe('Network error');
    });
  });

  describe('Context Operations', () => {
    it('should get context value', async () => {
      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ context: mockContext }),
      });

      const { result } = renderHook(() => useAgentContext(mockSessionId, mockAgentId));

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.getContext('theme')).toBe('dark');
      expect(result.current.getContext('nonexistent')).toBeUndefined();
    });

    it('should set context value', async () => {
      (global.fetch as ReturnType<typeof vi.fn>)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ context: mockContext }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ context: { ...mockContext, theme: 'light' } }),
        });

      const { result } = renderHook(() => useAgentContext(mockSessionId, mockAgentId));

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      await act(async () => {
        await result.current.setContext('theme', 'light');
      });

      expect(global.fetch).toHaveBeenCalledWith(
        `/api/memory/context/${mockSessionId}/${mockAgentId}`,
        expect.objectContaining({
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ theme: 'light' }),
        }),
      );
    });

    it('should update multiple context values', async () => {
      (global.fetch as ReturnType<typeof vi.fn>)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ context: mockContext }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            context: { ...mockContext, theme: 'light', language: 'es' },
          }),
        });

      const { result } = renderHook(() => useAgentContext(mockSessionId, mockAgentId));

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      await act(async () => {
        await result.current.updateContext({ theme: 'light', language: 'es' });
      });

      expect(global.fetch).toHaveBeenCalledWith(
        `/api/memory/context/${mockSessionId}/${mockAgentId}`,
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ theme: 'light', language: 'es' }),
        }),
      );
    });

    it('should remove context value', async () => {
      (global.fetch as ReturnType<typeof vi.fn>)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ context: mockContext }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ context: { language: 'en', preferences: { notifications: true } } }),
        });

      const { result } = renderHook(() => useAgentContext(mockSessionId, mockAgentId));

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      await act(async () => {
        await result.current.removeContext('theme');
      });

      expect(global.fetch).toHaveBeenCalledWith(
        `/api/memory/context/${mockSessionId}/${mockAgentId}`,
        expect.objectContaining({
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ key: 'theme' }),
        }),
      );
    });
  });

  describe('Auto-sync', () => {
    it('should sync automatically when enabled', async () => {
      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
        ok: true,
        json: async () => ({ context: mockContext }),
      });

      renderHook(() =>
        useAgentContext(mockSessionId, mockAgentId, {
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

    it('should not auto-sync when disabled', async () => {
      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
        ok: true,
        json: async () => ({ context: mockContext }),
      });

      renderHook(() =>
        useAgentContext(mockSessionId, mockAgentId, {
          autoSync: false,
        }),
      );

      await waitFor(() => {
        expect((global.fetch as ReturnType<typeof vi.fn>).mock.calls.length).toBe(1);
      });

      // Wait a bit to ensure no auto-sync happens
      await new Promise((resolve) => setTimeout(resolve, 200));

      // Should still be 1 (no auto-sync)
      expect((global.fetch as ReturnType<typeof vi.fn>).mock.calls.length).toBe(1);
    });

    it('should manually sync', async () => {
      const updatedContext = { ...mockContext, theme: 'light' };
      (global.fetch as ReturnType<typeof vi.fn>)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ context: mockContext }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ context: updatedContext }),
        });

      const { result } = renderHook(() => useAgentContext(mockSessionId, mockAgentId));

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      await act(async () => {
        await result.current.sync();
      });

      await waitFor(() => {
        expect(result.current.context).toEqual(updatedContext);
      });
    });
  });

  describe('Cleanup', () => {
    it('should cancel pending requests on unmount', async () => {
      (global.fetch as ReturnType<typeof vi.fn>).mockImplementation(
        () =>
          new Promise((resolve) =>
            setTimeout(
              () =>
                resolve({
                  ok: true,
                  json: async () => ({ context: mockContext }),
                }),
              100,
            ),
          ),
      );

      const { unmount, result } = renderHook(() => useAgentContext(mockSessionId, mockAgentId));

      expect(result.current.isLoading).toBe(true);

      // Unmount before fetch completes
      unmount();

      // Wait for would-be completion
      await new Promise((resolve) => setTimeout(resolve, 150));

      // State should not update after unmount (no error should be thrown)
    });
  });
});
