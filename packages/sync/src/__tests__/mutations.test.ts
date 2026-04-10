import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { MutationResult } from '../mutations.js';
import { useSyncMutations } from '../mutations.js';

// Mock the provider to supply proxyBaseUrl via context
vi.mock('../provider/index.js', () => ({
  useElectricConfig: vi.fn(),
}));

import { useElectricConfig } from '../provider/index.js';

const mockUseElectricConfig = useElectricConfig as ReturnType<typeof vi.fn>;

// ---- Test types ----
interface TestCreateInput {
  title: string;
  body?: string;
}

interface TestUpdateInput {
  title?: string;
  body?: string;
}

interface TestRecord {
  id: string;
  title: string;
  body: string;
  created_at: string;
}

// ---- Helpers ----

function createJsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function createErrorResponse(error: string, status: number): Response {
  return new Response(JSON.stringify({ error }), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function createNonJsonErrorResponse(status: number): Response {
  return new Response('Internal Server Error', { status });
}

const sampleRecord: TestRecord = {
  id: 'rec-1',
  title: 'Test Record',
  body: 'Some content',
  created_at: '2025-01-01T00:00:00Z',
};

// ---- Tests ----

describe('useSyncMutations', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseElectricConfig.mockReturnValue({
      serviceUrl: null,
      proxyBaseUrl: '',
      debug: false,
    });
    vi.stubGlobal('fetch', vi.fn());
  });

  // ---- Hook shape ----

  describe('hook shape', () => {
    it('should return create, update, and remove functions', () => {
      const { result } = renderHook(() =>
        useSyncMutations<TestCreateInput, TestUpdateInput, TestRecord>('items'),
      );

      expect(typeof result.current.create).toBe('function');
      expect(typeof result.current.update).toBe('function');
      expect(typeof result.current.remove).toBe('function');
    });

    it('should return stable function references across renders', () => {
      const { result, rerender } = renderHook(() =>
        useSyncMutations<TestCreateInput, TestUpdateInput, TestRecord>('items'),
      );

      const first = result.current;
      rerender();
      const second = result.current;

      expect(second.create).toBe(first.create);
      expect(second.update).toBe(first.update);
      expect(second.remove).toBe(first.remove);
    });

    it('should update function references when proxyBaseUrl changes', () => {
      mockUseElectricConfig.mockReturnValue({
        serviceUrl: null,
        proxyBaseUrl: '',
        debug: false,
      });

      const { result, rerender } = renderHook(() =>
        useSyncMutations<TestCreateInput, TestUpdateInput, TestRecord>('items'),
      );

      const firstCreate = result.current.create;

      mockUseElectricConfig.mockReturnValue({
        serviceUrl: null,
        proxyBaseUrl: 'https://admin.example.com',
        debug: false,
      });

      rerender();

      // References should change because baseUrl dependency changed
      expect(result.current.create).not.toBe(firstCreate);
    });
  });

  // ---- create ----

  describe('create', () => {
    it('should POST to the correct endpoint with JSON body', async () => {
      const mockFetch = vi.fn().mockResolvedValue(createJsonResponse(sampleRecord));
      vi.stubGlobal('fetch', mockFetch);

      const { result } = renderHook(() =>
        useSyncMutations<TestCreateInput, TestUpdateInput, TestRecord>('items'),
      );

      let mutationResult: MutationResult<TestRecord> | undefined;
      await act(async () => {
        mutationResult = await result.current.create({ title: 'Test Record' });
      });

      expect(mockFetch).toHaveBeenCalledWith('/api/sync/items', {
        method: 'POST',
        credentials: 'include',
        signal: expect.any(AbortSignal),
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: 'Test Record' }),
      });
      expect(mutationResult).toEqual({ success: true, data: sampleRecord });
    });

    it('should use proxyBaseUrl from context', async () => {
      mockUseElectricConfig.mockReturnValue({
        serviceUrl: null,
        proxyBaseUrl: 'https://admin.example.com',
        debug: false,
      });

      const mockFetch = vi.fn().mockResolvedValue(createJsonResponse(sampleRecord));
      vi.stubGlobal('fetch', mockFetch);

      const { result } = renderHook(() =>
        useSyncMutations<TestCreateInput, TestUpdateInput, TestRecord>('items'),
      );

      await act(async () => {
        await result.current.create({ title: 'Test' });
      });

      expect(mockFetch).toHaveBeenCalledWith(
        'https://admin.example.com/api/sync/items',
        expect.objectContaining({ method: 'POST' }),
      );
    });

    it('should return error on non-ok response with JSON error body', async () => {
      const mockFetch = vi.fn().mockResolvedValue(createErrorResponse('Validation failed', 422));
      vi.stubGlobal('fetch', mockFetch);

      const { result } = renderHook(() =>
        useSyncMutations<TestCreateInput, TestUpdateInput, TestRecord>('items'),
      );

      let mutationResult: MutationResult<TestRecord> | undefined;
      await act(async () => {
        mutationResult = await result.current.create({ title: '' });
      });

      expect(mutationResult).toEqual({
        success: false,
        error: 'Validation failed',
      });
    });

    it('should return generic error when error response has no JSON body', async () => {
      const mockFetch = vi.fn().mockResolvedValue(createNonJsonErrorResponse(500));
      vi.stubGlobal('fetch', mockFetch);

      const { result } = renderHook(() =>
        useSyncMutations<TestCreateInput, TestUpdateInput, TestRecord>('items'),
      );

      let mutationResult: MutationResult<TestRecord> | undefined;
      await act(async () => {
        mutationResult = await result.current.create({ title: 'Test' });
      });

      expect(mutationResult).toEqual({
        success: false,
        error: 'Request failed with status 500',
      });
    });

    it('should handle 401 unauthorized', async () => {
      const mockFetch = vi.fn().mockResolvedValue(createErrorResponse('Unauthorized', 401));
      vi.stubGlobal('fetch', mockFetch);

      const { result } = renderHook(() =>
        useSyncMutations<TestCreateInput, TestUpdateInput, TestRecord>('items'),
      );

      let mutationResult: MutationResult<TestRecord> | undefined;
      await act(async () => {
        mutationResult = await result.current.create({ title: 'Test' });
      });

      expect(mutationResult?.success).toBe(false);
      expect(mutationResult?.error).toBe('Unauthorized');
    });

    it('should handle 409 conflict', async () => {
      const mockFetch = vi
        .fn()
        .mockResolvedValue(createErrorResponse('Conflict: record already exists', 409));
      vi.stubGlobal('fetch', mockFetch);

      const { result } = renderHook(() =>
        useSyncMutations<TestCreateInput, TestUpdateInput, TestRecord>('items'),
      );

      let mutationResult: MutationResult<TestRecord> | undefined;
      await act(async () => {
        mutationResult = await result.current.create({ title: 'Duplicate' });
      });

      expect(mutationResult).toEqual({
        success: false,
        error: 'Conflict: record already exists',
      });
    });

    it('should include optional fields in the body', async () => {
      const mockFetch = vi.fn().mockResolvedValue(createJsonResponse(sampleRecord));
      vi.stubGlobal('fetch', mockFetch);

      const { result } = renderHook(() =>
        useSyncMutations<TestCreateInput, TestUpdateInput, TestRecord>('items'),
      );

      await act(async () => {
        await result.current.create({ title: 'Test', body: 'Optional body' });
      });

      const calledBody = JSON.parse(mockFetch.mock.calls[0][1].body as string) as TestCreateInput;
      expect(calledBody).toEqual({ title: 'Test', body: 'Optional body' });
    });
  });

  // ---- update ----

  describe('update', () => {
    it('should PATCH to the correct endpoint with encoded ID', async () => {
      const updatedRecord = { ...sampleRecord, title: 'Updated Title' };
      const mockFetch = vi.fn().mockResolvedValue(createJsonResponse(updatedRecord));
      vi.stubGlobal('fetch', mockFetch);

      const { result } = renderHook(() =>
        useSyncMutations<TestCreateInput, TestUpdateInput, TestRecord>('items'),
      );

      let mutationResult: MutationResult<TestRecord> | undefined;
      await act(async () => {
        mutationResult = await result.current.update('rec-1', { title: 'Updated Title' });
      });

      expect(mockFetch).toHaveBeenCalledWith('/api/sync/items/rec-1', {
        method: 'PATCH',
        credentials: 'include',
        signal: expect.any(AbortSignal),
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: 'Updated Title' }),
      });
      expect(mutationResult).toEqual({ success: true, data: updatedRecord });
    });

    it('should URL-encode special characters in the ID', async () => {
      const mockFetch = vi.fn().mockResolvedValue(createJsonResponse(sampleRecord));
      vi.stubGlobal('fetch', mockFetch);

      const { result } = renderHook(() =>
        useSyncMutations<TestCreateInput, TestUpdateInput, TestRecord>('items'),
      );

      await act(async () => {
        await result.current.update('id/with spaces&special', { title: 'Updated' });
      });

      const calledUrl = mockFetch.mock.calls[0][0] as string;
      expect(calledUrl).toBe('/api/sync/items/id%2Fwith%20spaces%26special');
    });

    it('should return error on update failure', async () => {
      const mockFetch = vi.fn().mockResolvedValue(createErrorResponse('Not found', 404));
      vi.stubGlobal('fetch', mockFetch);

      const { result } = renderHook(() =>
        useSyncMutations<TestCreateInput, TestUpdateInput, TestRecord>('items'),
      );

      let mutationResult: MutationResult<TestRecord> | undefined;
      await act(async () => {
        mutationResult = await result.current.update('nonexistent', { title: 'X' });
      });

      expect(mutationResult).toEqual({
        success: false,
        error: 'Not found',
      });
    });

    it('should use proxyBaseUrl for update requests', async () => {
      mockUseElectricConfig.mockReturnValue({
        serviceUrl: null,
        proxyBaseUrl: 'https://api.test.com',
        debug: false,
      });

      const mockFetch = vi.fn().mockResolvedValue(createJsonResponse(sampleRecord));
      vi.stubGlobal('fetch', mockFetch);

      const { result } = renderHook(() =>
        useSyncMutations<TestCreateInput, TestUpdateInput, TestRecord>('items'),
      );

      await act(async () => {
        await result.current.update('rec-1', { title: 'Updated' });
      });

      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.test.com/api/sync/items/rec-1',
        expect.objectContaining({ method: 'PATCH' }),
      );
    });
  });

  // ---- remove ----

  describe('remove', () => {
    it('should DELETE to the correct endpoint', async () => {
      const mockFetch = vi.fn().mockResolvedValue(createJsonResponse(null));
      vi.stubGlobal('fetch', mockFetch);

      const { result } = renderHook(() =>
        useSyncMutations<TestCreateInput, TestUpdateInput, TestRecord>('items'),
      );

      let mutationResult: MutationResult<void> | undefined;
      await act(async () => {
        mutationResult = await result.current.remove('rec-1');
      });

      expect(mockFetch).toHaveBeenCalledWith('/api/sync/items/rec-1', {
        method: 'DELETE',
        credentials: 'include',
        signal: expect.any(AbortSignal),
        headers: undefined,
        body: undefined,
      });
      expect(mutationResult?.success).toBe(true);
    });

    it('should not include Content-Type header or body for DELETE', async () => {
      const mockFetch = vi.fn().mockResolvedValue(createJsonResponse(null));
      vi.stubGlobal('fetch', mockFetch);

      const { result } = renderHook(() =>
        useSyncMutations<TestCreateInput, TestUpdateInput, TestRecord>('items'),
      );

      await act(async () => {
        await result.current.remove('rec-1');
      });

      const calledOptions = mockFetch.mock.calls[0][1] as RequestInit;
      expect(calledOptions.headers).toBeUndefined();
      expect(calledOptions.body).toBeUndefined();
    });

    it('should URL-encode the ID for DELETE', async () => {
      const mockFetch = vi.fn().mockResolvedValue(createJsonResponse(null));
      vi.stubGlobal('fetch', mockFetch);

      const { result } = renderHook(() =>
        useSyncMutations<TestCreateInput, TestUpdateInput, TestRecord>('items'),
      );

      await act(async () => {
        await result.current.remove('id with spaces');
      });

      const calledUrl = mockFetch.mock.calls[0][0] as string;
      expect(calledUrl).toBe('/api/sync/items/id%20with%20spaces');
    });

    it('should return error on delete failure', async () => {
      const mockFetch = vi.fn().mockResolvedValue(createErrorResponse('Forbidden', 403));
      vi.stubGlobal('fetch', mockFetch);

      const { result } = renderHook(() =>
        useSyncMutations<TestCreateInput, TestUpdateInput, TestRecord>('items'),
      );

      let mutationResult: MutationResult<void> | undefined;
      await act(async () => {
        mutationResult = await result.current.remove('rec-1');
      });

      expect(mutationResult).toEqual({
        success: false,
        error: 'Forbidden',
      });
    });
  });

  // ---- Network failures ----

  describe('network failures', () => {
    it('should propagate fetch rejection for create', async () => {
      const networkError = new TypeError('Failed to fetch');
      const mockFetch = vi.fn().mockRejectedValue(networkError);
      vi.stubGlobal('fetch', mockFetch);

      const { result } = renderHook(() =>
        useSyncMutations<TestCreateInput, TestUpdateInput, TestRecord>('items'),
      );

      await expect(
        act(async () => {
          await result.current.create({ title: 'Test' });
        }),
      ).rejects.toThrow('Failed to fetch');
    });

    it('should propagate fetch rejection for update', async () => {
      const networkError = new TypeError('Network request failed');
      const mockFetch = vi.fn().mockRejectedValue(networkError);
      vi.stubGlobal('fetch', mockFetch);

      const { result } = renderHook(() =>
        useSyncMutations<TestCreateInput, TestUpdateInput, TestRecord>('items'),
      );

      await expect(
        act(async () => {
          await result.current.update('rec-1', { title: 'X' });
        }),
      ).rejects.toThrow('Network request failed');
    });

    it('should propagate fetch rejection for remove', async () => {
      const mockFetch = vi.fn().mockRejectedValue(new TypeError('Offline'));
      vi.stubGlobal('fetch', mockFetch);

      const { result } = renderHook(() =>
        useSyncMutations<TestCreateInput, TestUpdateInput, TestRecord>('items'),
      );

      await expect(
        act(async () => {
          await result.current.remove('rec-1');
        }),
      ).rejects.toThrow('Offline');
    });
  });

  // ---- Edge cases ----

  describe('edge cases', () => {
    it('should handle empty object as create body', async () => {
      const mockFetch = vi.fn().mockResolvedValue(createJsonResponse({ id: 'new' }));
      vi.stubGlobal('fetch', mockFetch);

      const { result } = renderHook(() =>
        useSyncMutations<Record<string, never>, TestUpdateInput, { id: string }>('items'),
      );

      await act(async () => {
        await result.current.create({} as Record<string, never>);
      });

      const calledBody = mockFetch.mock.calls[0][1].body as string;
      expect(calledBody).toBe('{}');
    });

    it('should handle large payload', async () => {
      const largeTitle = 'x'.repeat(100_000);
      const mockFetch = vi
        .fn()
        .mockResolvedValue(createJsonResponse({ id: 'large', title: largeTitle }));
      vi.stubGlobal('fetch', mockFetch);

      const { result } = renderHook(() =>
        useSyncMutations<TestCreateInput, TestUpdateInput, TestRecord>('items'),
      );

      let mutationResult: MutationResult<TestRecord> | undefined;
      await act(async () => {
        mutationResult = await result.current.create({ title: largeTitle });
      });

      expect(mutationResult?.success).toBe(true);
      const calledBody = JSON.parse(mockFetch.mock.calls[0][1].body as string) as TestCreateInput;
      expect(calledBody.title.length).toBe(100_000);
    });

    it('should handle different endpoint names', async () => {
      const mockFetch = vi.fn().mockResolvedValue(createJsonResponse({ id: '1' }));
      vi.stubGlobal('fetch', mockFetch);

      const { result } = renderHook(() =>
        useSyncMutations<TestCreateInput, TestUpdateInput, TestRecord>('agent-memories'),
      );

      await act(async () => {
        await result.current.create({ title: 'Memory' });
      });

      const calledUrl = mockFetch.mock.calls[0][0] as string;
      expect(calledUrl).toBe('/api/sync/agent-memories');
    });

    it('should always include credentials for cross-origin cookie support', async () => {
      // Each call needs a fresh Response because bodies can only be read once
      const mockFetch = vi
        .fn()
        .mockImplementation(() => Promise.resolve(createJsonResponse(sampleRecord)));
      vi.stubGlobal('fetch', mockFetch);

      const { result } = renderHook(() =>
        useSyncMutations<TestCreateInput, TestUpdateInput, TestRecord>('items'),
      );

      // Test all three methods include credentials
      await act(async () => {
        await result.current.create({ title: 'Test' });
      });
      expect((mockFetch.mock.calls[0][1] as RequestInit).credentials).toBe('include');

      await act(async () => {
        await result.current.update('rec-1', { title: 'Test' });
      });
      expect((mockFetch.mock.calls[1][1] as RequestInit).credentials).toBe('include');

      await act(async () => {
        await result.current.remove('rec-1');
      });
      expect((mockFetch.mock.calls[2][1] as RequestInit).credentials).toBe('include');
    });

    it('should handle error response with empty error field', async () => {
      const mockFetch = vi.fn().mockResolvedValue(createJsonResponse({}, 400));
      // Override the status manually since our helper creates ok responses
      const badResponse = new Response(JSON.stringify({}), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
      mockFetch.mockResolvedValue(badResponse);
      vi.stubGlobal('fetch', mockFetch);

      const { result } = renderHook(() =>
        useSyncMutations<TestCreateInput, TestUpdateInput, TestRecord>('items'),
      );

      let mutationResult: MutationResult<TestRecord> | undefined;
      await act(async () => {
        mutationResult = await result.current.create({ title: 'Test' });
      });

      // Should fall back to status-based message when error field is undefined
      expect(mutationResult).toEqual({
        success: false,
        error: 'Request failed with status 400',
      });
    });

    it('should handle concurrent mutations independently', async () => {
      let callCount = 0;
      const mockFetch = vi.fn().mockImplementation(() => {
        callCount++;
        const record = { ...sampleRecord, id: `rec-${callCount}` };
        return Promise.resolve(createJsonResponse(record));
      });
      vi.stubGlobal('fetch', mockFetch);

      const { result } = renderHook(() =>
        useSyncMutations<TestCreateInput, TestUpdateInput, TestRecord>('items'),
      );

      let results: MutationResult<TestRecord>[] = [];
      await act(async () => {
        results = await Promise.all([
          result.current.create({ title: 'First' }),
          result.current.create({ title: 'Second' }),
          result.current.create({ title: 'Third' }),
        ]);
      });

      expect(results).toHaveLength(3);
      expect(results.every((r) => r.success)).toBe(true);
      expect(mockFetch).toHaveBeenCalledTimes(3);
    });

    it('should handle mixed success and failure in concurrent mutations', async () => {
      const mockFetch = vi
        .fn()
        .mockResolvedValueOnce(createJsonResponse(sampleRecord))
        .mockResolvedValueOnce(createErrorResponse('Rate limited', 429))
        .mockResolvedValueOnce(createJsonResponse({ ...sampleRecord, id: 'rec-3' }));
      vi.stubGlobal('fetch', mockFetch);

      const { result } = renderHook(() =>
        useSyncMutations<TestCreateInput, TestUpdateInput, TestRecord>('items'),
      );

      let results: MutationResult<TestRecord>[] = [];
      await act(async () => {
        results = await Promise.all([
          result.current.create({ title: 'OK 1' }),
          result.current.create({ title: 'Rate limited' }),
          result.current.create({ title: 'OK 2' }),
        ]);
      });

      expect(results[0].success).toBe(true);
      expect(results[1].success).toBe(false);
      expect(results[1].error).toBe('Rate limited');
      expect(results[2].success).toBe(true);
    });
  });

  // ---- MutationResult type ----

  describe('MutationResult shape', () => {
    it('should have data on success', async () => {
      const mockFetch = vi.fn().mockResolvedValue(createJsonResponse(sampleRecord));
      vi.stubGlobal('fetch', mockFetch);

      const { result } = renderHook(() =>
        useSyncMutations<TestCreateInput, TestUpdateInput, TestRecord>('items'),
      );

      let mutationResult: MutationResult<TestRecord> | undefined;
      await act(async () => {
        mutationResult = await result.current.create({ title: 'Test' });
      });

      expect(mutationResult?.success).toBe(true);
      expect(mutationResult?.data).toEqual(sampleRecord);
      expect(mutationResult?.error).toBeUndefined();
    });

    it('should have error on failure and no data', async () => {
      const mockFetch = vi.fn().mockResolvedValue(createErrorResponse('Bad request', 400));
      vi.stubGlobal('fetch', mockFetch);

      const { result } = renderHook(() =>
        useSyncMutations<TestCreateInput, TestUpdateInput, TestRecord>('items'),
      );

      let mutationResult: MutationResult<TestRecord> | undefined;
      await act(async () => {
        mutationResult = await result.current.create({ title: '' });
      });

      expect(mutationResult?.success).toBe(false);
      expect(mutationResult?.error).toBe('Bad request');
      expect(mutationResult?.data).toBeUndefined();
    });
  });
});
