/**
 * Tests for useLicenseKey hook
 */

import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useLicenseKey } from '../../app/hooks/useLicenseKey';

const STORAGE_KEY = 'revealui_license_key';
const API_ENDPOINT = 'https://api.revealui.com/api/license/verify';

// Mock fetch globally
global.fetch = vi.fn();

describe('useLicenseKey', () => {
  beforeEach(() => {
    sessionStorage.clear();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('resolves to not-loading state with no stored key', async () => {
    const { result } = renderHook(() => useLicenseKey());

    // With no stored key the hook finishes loading quickly
    await vi.waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.isValid).toBe(false);
    expect(result.current.key).toBeNull();
    expect(result.current.tier).toBeNull();
    // No fetch should be called when there is no stored key
    expect(fetch).not.toHaveBeenCalled();
  });

  it('revalidates stored key on mount', async () => {
    sessionStorage.setItem(STORAGE_KEY, 'rlui_pro_stored');

    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(JSON.stringify({ valid: true, tier: 'pro' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );

    const { result } = renderHook(() => useLicenseKey());

    await vi.waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.isValid).toBe(true);
    expect(result.current.key).toBe('rlui_pro_stored');
    expect(result.current.tier).toBe('pro');

    expect(fetch).toHaveBeenCalledWith(API_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ licenseKey: 'rlui_pro_stored' }),
    });
  });

  it('clears stored key when revalidation returns invalid', async () => {
    sessionStorage.setItem(STORAGE_KEY, 'rlui_pro_expired');

    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(JSON.stringify({ valid: false }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );

    const { result } = renderHook(() => useLicenseKey());

    await vi.waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.isValid).toBe(false);
    expect(result.current.key).toBeNull();
    expect(sessionStorage.getItem(STORAGE_KEY)).toBeNull();
  });

  it('clears stored key when revalidation returns non-ok status', async () => {
    sessionStorage.setItem(STORAGE_KEY, 'rlui_pro_bad');

    vi.mocked(fetch).mockResolvedValueOnce(new Response('Unauthorized', { status: 401 }));

    const { result } = renderHook(() => useLicenseKey());

    await vi.waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.isValid).toBe(false);
    expect(result.current.key).toBeNull();
    expect(sessionStorage.getItem(STORAGE_KEY)).toBeNull();
  });

  it('handles network error during revalidation gracefully', async () => {
    sessionStorage.setItem(STORAGE_KEY, 'rlui_pro_offline');

    vi.mocked(fetch).mockRejectedValueOnce(new Error('Network error'));

    const { result } = renderHook(() => useLicenseKey());

    await vi.waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    // Key is kept but marked as invalid
    expect(result.current.key).toBe('rlui_pro_offline');
    expect(result.current.isValid).toBe(false);
    expect(result.current.tier).toBeNull();
  });

  describe('validate', () => {
    it('validates a new key and stores it on success', async () => {
      vi.mocked(fetch).mockResolvedValueOnce(
        new Response(JSON.stringify({ valid: true, tier: 'max' }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
      );

      const { result } = renderHook(() => useLicenseKey());

      await vi.waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      let validateResult: { valid: boolean; tier: string | null } | undefined;

      await act(async () => {
        validateResult = await result.current.validate('rlui_max_new');
      });

      expect(validateResult).toEqual({ valid: true, tier: 'max' });
      expect(result.current.isValid).toBe(true);
      expect(result.current.key).toBe('rlui_max_new');
      expect(result.current.tier).toBe('max');
      expect(sessionStorage.getItem(STORAGE_KEY)).toBe('rlui_max_new');
    });

    it('rejects invalid key', async () => {
      vi.mocked(fetch).mockResolvedValueOnce(
        new Response(JSON.stringify({ valid: false }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
      );

      const { result } = renderHook(() => useLicenseKey());

      await vi.waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      let validateResult: { valid: boolean; tier: string | null } | undefined;

      await act(async () => {
        validateResult = await result.current.validate('rlui_pro_invalid');
      });

      expect(validateResult).toEqual({ valid: false, tier: null });
      expect(result.current.isValid).toBe(false);
      expect(result.current.key).toBeNull();
    });

    it('rejects free tier keys', async () => {
      vi.mocked(fetch).mockResolvedValueOnce(
        new Response(JSON.stringify({ valid: true, tier: 'free' }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
      );

      const { result } = renderHook(() => useLicenseKey());

      await vi.waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      let validateResult: { valid: boolean; tier: string | null } | undefined;

      await act(async () => {
        validateResult = await result.current.validate('rlui_free_key');
      });

      // free tier does not satisfy the pro/max/enterprise check
      expect(validateResult).toEqual({ valid: false, tier: 'free' });
      expect(result.current.isValid).toBe(false);
    });

    it('accepts enterprise tier keys', async () => {
      vi.mocked(fetch).mockResolvedValueOnce(
        new Response(JSON.stringify({ valid: true, tier: 'enterprise' }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
      );

      const { result } = renderHook(() => useLicenseKey());

      await vi.waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      let validateResult: { valid: boolean; tier: string | null } | undefined;

      await act(async () => {
        validateResult = await result.current.validate('rlui_ent_key');
      });

      expect(validateResult).toEqual({ valid: true, tier: 'enterprise' });
      expect(result.current.isValid).toBe(true);
      expect(result.current.tier).toBe('enterprise');
    });

    it('handles non-ok response', async () => {
      vi.mocked(fetch).mockResolvedValueOnce(new Response('Server Error', { status: 500 }));

      const { result } = renderHook(() => useLicenseKey());

      await vi.waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      let validateResult: { valid: boolean; tier: string | null } | undefined;

      await act(async () => {
        validateResult = await result.current.validate('rlui_pro_test');
      });

      expect(validateResult).toEqual({ valid: false, tier: null });
      expect(result.current.isValid).toBe(false);
    });

    it('handles network error during validate', async () => {
      vi.mocked(fetch).mockRejectedValueOnce(new Error('Network failure'));

      const { result } = renderHook(() => useLicenseKey());

      await vi.waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      let validateResult: { valid: boolean; tier: string | null } | undefined;

      await act(async () => {
        validateResult = await result.current.validate('rlui_pro_test');
      });

      expect(validateResult).toEqual({ valid: false, tier: null });
      expect(result.current.isValid).toBe(false);
    });
  });

  describe('clear', () => {
    it('removes the key from sessionStorage and resets state', async () => {
      sessionStorage.setItem(STORAGE_KEY, 'rlui_pro_stored');

      vi.mocked(fetch).mockResolvedValueOnce(
        new Response(JSON.stringify({ valid: true, tier: 'pro' }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
      );

      const { result } = renderHook(() => useLicenseKey());

      await vi.waitFor(() => {
        expect(result.current.isValid).toBe(true);
      });

      act(() => {
        result.current.clear();
      });

      expect(result.current.isValid).toBe(false);
      expect(result.current.key).toBeNull();
      expect(result.current.tier).toBeNull();
      expect(sessionStorage.getItem(STORAGE_KEY)).toBeNull();
    });
  });
});
