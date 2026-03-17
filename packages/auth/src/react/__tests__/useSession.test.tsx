// @vitest-environment happy-dom
import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useSession } from '../useSession.js';

const mockSessionResponse = {
  session: {
    id: 'sess-1',
    expiresAt: '2026-04-01T00:00:00.000Z',
    userId: 'user-1',
  },
  user: {
    id: 'user-1',
    email: 'test@example.com',
    name: 'Test User',
  },
};

function mockFetch(response: unknown, status = 200) {
  return vi.fn().mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    statusText: status === 200 ? 'OK' : 'Error',
    json: () => Promise.resolve(response),
  });
}

describe('useSession', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', mockFetch(mockSessionResponse));
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('fetches session on mount', async () => {
    const { result } = renderHook(() => useSession());

    expect(result.current.isLoading).toBe(true);

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.data).not.toBeNull();
    expect(result.current.data?.user.email).toBe('test@example.com');
    expect(result.current.error).toBeNull();
    expect(fetch).toHaveBeenCalledWith('/api/auth/session', {
      credentials: 'include',
      signal: expect.any(AbortSignal),
    });
  });

  it('sets data to null on 401', async () => {
    vi.stubGlobal('fetch', mockFetch(null, 401));

    const { result } = renderHook(() => useSession());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.data).toBeNull();
    expect(result.current.error).toBeNull();
  });

  it('sets error on network failure', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('Network error')));

    const { result } = renderHook(() => useSession());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.data).toBeNull();
    expect(result.current.error?.message).toBe('Network error');
  });

  it('sets error on non-401 failure', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
        json: () => Promise.resolve({}),
      }),
    );

    const { result } = renderHook(() => useSession());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.data).toBeNull();
    expect(result.current.error?.message).toContain('Failed to fetch session');
  });

  it('refetch re-fetches session data', async () => {
    const { result } = renderHook(() => useSession());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    const updatedResponse = {
      session: { id: 'sess-2', expiresAt: '2026-05-01T00:00:00.000Z', userId: 'user-1' },
      user: { id: 'user-1', email: 'updated@example.com', name: 'Updated' },
    };
    vi.stubGlobal('fetch', mockFetch(updatedResponse));

    await act(async () => {
      await result.current.refetch();
    });

    expect(result.current.data?.user.email).toBe('updated@example.com');
  });

  it('aborts in-flight request on unmount', async () => {
    const abortSpy = vi.spyOn(AbortController.prototype, 'abort');

    const { unmount } = renderHook(() => useSession());

    unmount();

    expect(abortSpy).toHaveBeenCalled();
    abortSpy.mockRestore();
  });
});
