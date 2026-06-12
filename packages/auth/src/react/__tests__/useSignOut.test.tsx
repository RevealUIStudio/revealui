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

describe('useSignOut - CSRF token attach', () => {
  const originalLocation = window.location;

  beforeEach(() => {
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
    // happy-dom cookies persist across tests in this file - expire ours so
    // the exact-equality assertion in the describe above stays header-free
    document.cookie = 'revealui-csrf=; expires=Thu, 01 Jan 1970 00:00:00 GMT';
  });

  it('signOut() echoes the revealui-csrf cookie as X-CSRF-Token', async () => {
    document.cookie = 'other-cookie=unrelated';
    document.cookie = 'revealui-csrf=nonce123:hmac456';
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true }));

    const { result } = renderHook(() => useSignOut());
    await waitFor(async () => {
      await result.current.signOut();
    });

    expect(fetch).toHaveBeenNthCalledWith(1, '/api/auth/sign-out', {
      method: 'POST',
      credentials: 'include',
      headers: { 'X-CSRF-Token': 'nonce123:hmac456' },
    });
    expect(window.location.href).toBe('/login');
  });

  it('signOut() sends no headers key at all when the cookie is absent', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true }));

    const { result } = renderHook(() => useSignOut());
    await waitFor(async () => {
      await result.current.signOut();
    });

    // Exact equality: cookie-less sign-out requests stay byte-identical to
    // the pre-CSRF shape (no headers key)
    expect(fetch).toHaveBeenNthCalledWith(1, '/api/auth/sign-out', {
      method: 'POST',
      credentials: 'include',
    });
  });

  it('omits X-CSRF-Token when the cookie value is empty', async () => {
    document.cookie = 'revealui-csrf=';
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true }));

    const { result } = renderHook(() => useSignOut());
    await waitFor(async () => {
      await result.current.signOut();
    });

    expect(fetch).toHaveBeenNthCalledWith(1, '/api/auth/sign-out', {
      method: 'POST',
      credentials: 'include',
    });
  });
});
