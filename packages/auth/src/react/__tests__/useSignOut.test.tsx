// @vitest-environment happy-dom
import { renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useSignOut } from '../useSignOut.js';

describe('useSignOut', () => {
  const originalLocation = window.location;

  beforeEach(() => {
    // Mock window.location.href setter
    Object.defineProperty(window, 'location', {
      writable: true,
      value: { ...originalLocation, href: '' },
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    Object.defineProperty(window, 'location', {
      writable: true,
      value: originalLocation,
    });
  });

  it('calls sign-out endpoint and redirects', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true }));

    const { result } = renderHook(() => useSignOut());

    await waitFor(async () => {
      await result.current.signOut();
    });

    expect(fetch).toHaveBeenCalledWith('/api/auth/sign-out', {
      method: 'POST',
      credentials: 'include',
    });
    expect(window.location.href).toBe('/login');
    expect(result.current.isLoading).toBe(false);
  });

  it('sets error on failure', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 500 }));

    const { result } = renderHook(() => useSignOut());

    await expect(async () => {
      await result.current.signOut();
    }).rejects.toThrow('Failed to sign out');

    await waitFor(() => {
      expect(result.current.error?.message).toBe('Failed to sign out');
      expect(result.current.isLoading).toBe(false);
    });
  });

  it('sets error on network failure', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('Network error')));

    const { result } = renderHook(() => useSignOut());

    await expect(async () => {
      await result.current.signOut();
    }).rejects.toThrow('Network error');

    await waitFor(() => {
      expect(result.current.error?.message).toBe('Network error');
    });
  });
});
