import { act, renderHook } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ElectricProvider } from '../../provider/index.js';
import { useSharedMemories } from '../useSharedMemories.js';

vi.mock('@electric-sql/react', () => ({
  useShape: vi.fn(),
}));

import { useShape } from '@electric-sql/react';

const mockUseShape = useShape as ReturnType<typeof vi.fn>;

function createJsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function setCsrfCookie(value: string): void {
  // biome-ignore lint/suspicious/noDocumentCookie: jsdom has no Cookie Store API; direct assignment is the only way to seed cookies in tests
  document.cookie = `revealui-csrf=${value}`;
}

function clearCsrfCookie(): void {
  // biome-ignore lint/suspicious/noDocumentCookie: jsdom has no Cookie Store API; direct assignment is the only way to clear cookies in tests
  document.cookie = 'revealui-csrf=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/';
}

describe('useSharedMemories', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseShape.mockReturnValue({ data: [], isLoading: false, error: null });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    clearCsrfCookie();
  });

  describe('triggerReconciliation', () => {
    it('should POST to the reconcile endpoint with the csrf token when the cookie is present', async () => {
      setCsrfCookie('tok-789');
      const mockFetch = vi.fn().mockResolvedValue(createJsonResponse({ status: 'queued' }));
      vi.stubGlobal('fetch', mockFetch);

      const { result } = renderHook(() => useSharedMemories('session-1'));

      await act(async () => {
        await result.current.triggerReconciliation('sess-id', 'site-id');
      });

      expect(mockFetch).toHaveBeenCalledWith('/api/sync/reconcile', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': 'tok-789' },
        body: JSON.stringify({ session_id: 'sess-id', site_id: 'site-id' }),
      });
    });

    it('should omit the token for a cross-origin proxyBaseUrl', async () => {
      setCsrfCookie('tok-789');
      const mockFetch = vi.fn().mockResolvedValue(createJsonResponse({ status: 'queued' }));
      vi.stubGlobal('fetch', mockFetch);

      const wrapper = ({ children }: { children: ReactNode }) => (
        <ElectricProvider proxyBaseUrl="https://admin.example.com">{children}</ElectricProvider>
      );
      const { result } = renderHook(() => useSharedMemories('session-1'), { wrapper });

      await act(async () => {
        await result.current.triggerReconciliation('sess-id', 'site-id');
      });

      expect(mockFetch).toHaveBeenCalledWith(
        'https://admin.example.com/api/sync/reconcile',
        expect.objectContaining({
          headers: { 'Content-Type': 'application/json' },
        }),
      );
    });

    it('should omit the token when the cookie is not set', async () => {
      const mockFetch = vi.fn().mockResolvedValue(createJsonResponse({ status: 'queued' }));
      vi.stubGlobal('fetch', mockFetch);

      const { result } = renderHook(() => useSharedMemories('session-1'));

      await act(async () => {
        await result.current.triggerReconciliation('sess-id', 'site-id');
      });

      expect((mockFetch.mock.calls[0][1] as RequestInit).headers).toEqual({
        'Content-Type': 'application/json',
      });
    });

    it('should return the parsed result on success', async () => {
      const mockFetch = vi.fn().mockResolvedValue(createJsonResponse({ status: 'queued' }));
      vi.stubGlobal('fetch', mockFetch);

      const { result } = renderHook(() => useSharedMemories('session-1'));

      let outcome: unknown;
      await act(async () => {
        outcome = await result.current.triggerReconciliation('sess-id', 'site-id');
      });

      expect(outcome).toEqual({ success: true, data: { status: 'queued' } });
    });

    it('should return an error result on a failed response', async () => {
      const mockFetch = vi
        .fn()
        .mockResolvedValue(createJsonResponse({ error: 'CSRF token missing' }, 403));
      vi.stubGlobal('fetch', mockFetch);

      const { result } = renderHook(() => useSharedMemories('session-1'));

      let outcome: unknown;
      await act(async () => {
        outcome = await result.current.triggerReconciliation('sess-id', 'site-id');
      });

      expect(outcome).toEqual({ success: false, error: 'CSRF token missing' });
    });
  });
});
