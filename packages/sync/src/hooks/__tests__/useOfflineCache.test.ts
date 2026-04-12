import { renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Mock dependencies before importing the module under test.
vi.mock('@electric-sql/react', () => ({
  useShape: vi.fn(),
}));

vi.mock('../useOnlineStatus.js', () => ({
  useOnlineStatus: vi.fn(),
}));

import { useShape } from '@electric-sql/react';
import { useOfflineCache } from '../useOfflineCache.js';
import { useOnlineStatus } from '../useOnlineStatus.js';

const mockUseShape = useShape as ReturnType<typeof vi.fn>;
const mockUseOnlineStatus = useOnlineStatus as ReturnType<typeof vi.fn>;

const CACHE_PREFIX = 'revealui:cache:';

interface TestRow {
  id: string;
  title: string;
}

function defaultOptions() {
  return {
    shapeUrl: '/api/shapes/test',
    cacheKey: 'test-cache',
    ttlSeconds: 3600,
  };
}

describe('useOfflineCache', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.localStorage.clear();

    // Default: online and shape returns empty.
    mockUseOnlineStatus.mockReturnValue({
      isOnline: true,
      wasOffline: false,
      lastOnlineAt: null,
    });

    mockUseShape.mockReturnValue({
      data: [],
      isLoading: false,
      error: null,
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ---- Online mode ----

  describe('when online', () => {
    it('should return live shape data', () => {
      const rows: TestRow[] = [
        { id: '1', title: 'First' },
        { id: '2', title: 'Second' },
      ];
      mockUseShape.mockReturnValue({ data: rows, isLoading: false, error: null });

      const { result } = renderHook(() => useOfflineCache<TestRow>(defaultOptions()));

      expect(result.current.data).toEqual(rows);
      expect(result.current.isOnline).toBe(true);
      expect(result.current.error).toBeNull();
    });

    it('should cache live data to localStorage', () => {
      const rows: TestRow[] = [{ id: '1', title: 'Cached' }];
      mockUseShape.mockReturnValue({ data: rows, isLoading: false, error: null });

      renderHook(() => useOfflineCache<TestRow>(defaultOptions()));

      const raw = window.localStorage.getItem(`${CACHE_PREFIX}test-cache`);
      expect(raw).not.toBeNull();
      const parsed = JSON.parse(raw!) as { data: TestRow[] };
      expect(parsed.data).toEqual(rows);
    });

    it('should report isSyncing when shape is loading', () => {
      mockUseShape.mockReturnValue({ data: [], isLoading: true, error: null });

      const { result } = renderHook(() => useOfflineCache<TestRow>(defaultOptions()));

      expect(result.current.isSyncing).toBe(true);
    });

    it('should propagate shape errors', () => {
      const err = new Error('Shape subscription failed');
      mockUseShape.mockReturnValue({ data: [], isLoading: false, error: err });

      const { result } = renderHook(() => useOfflineCache<TestRow>(defaultOptions()));

      expect(result.current.error).toBe(err);
    });

    it('should return empty array when shape returns no data', () => {
      mockUseShape.mockReturnValue({ data: null, isLoading: false, error: null });

      const { result } = renderHook(() => useOfflineCache<TestRow>(defaultOptions()));

      expect(result.current.data).toEqual([]);
    });
  });

  // ---- Offline mode ----

  describe('when offline', () => {
    beforeEach(() => {
      mockUseOnlineStatus.mockReturnValue({
        isOnline: false,
        wasOffline: false,
        lastOnlineAt: null,
      });
    });

    it('should return cached data', () => {
      const cached = {
        data: [{ id: '1', title: 'Offline row' }],
        cachedAt: new Date().toISOString(),
      };
      window.localStorage.setItem(`${CACHE_PREFIX}test-cache`, JSON.stringify(cached));

      const { result } = renderHook(() => useOfflineCache<TestRow>(defaultOptions()));

      expect(result.current.data).toEqual(cached.data);
      expect(result.current.isOnline).toBe(false);
    });

    it('should return empty array when no cache exists', () => {
      const { result } = renderHook(() => useOfflineCache<TestRow>(defaultOptions()));

      expect(result.current.data).toEqual([]);
      expect(result.current.isOnline).toBe(false);
    });

    it('should return empty array for expired cache', () => {
      const expired = {
        data: [{ id: '1', title: 'Old' }],
        cachedAt: new Date(Date.now() - 7200 * 1_000).toISOString(), // 2 hours ago
      };
      window.localStorage.setItem(`${CACHE_PREFIX}test-cache`, JSON.stringify(expired));

      const { result } = renderHook(() =>
        useOfflineCache<TestRow>({ ...defaultOptions(), ttlSeconds: 3600 }),
      );

      expect(result.current.data).toEqual([]);
    });

    it('should report isSyncing as false when offline', () => {
      const { result } = renderHook(() => useOfflineCache<TestRow>(defaultOptions()));

      expect(result.current.isSyncing).toBe(false);
    });

    it('should recover lastSyncedAt from cache timestamp', () => {
      const cachedAt = new Date().toISOString();
      const cached = {
        data: [{ id: '1', title: 'Cached' }],
        cachedAt,
      };
      window.localStorage.setItem(`${CACHE_PREFIX}test-cache`, JSON.stringify(cached));

      const { result } = renderHook(() => useOfflineCache<TestRow>(defaultOptions()));

      expect(result.current.lastSyncedAt).toEqual(new Date(cachedAt));
    });
  });

  // ---- Edge cases ----

  describe('edge cases', () => {
    it('should handle corrupt cache data gracefully', () => {
      window.localStorage.setItem(`${CACHE_PREFIX}test-cache`, 'not-json{{{');
      mockUseOnlineStatus.mockReturnValue({
        isOnline: false,
        wasOffline: false,
        lastOnlineAt: null,
      });

      const { result } = renderHook(() => useOfflineCache<TestRow>(defaultOptions()));

      expect(result.current.data).toEqual([]);
    });

    it('should use default TTL when not specified', () => {
      // Cache from 30 minutes ago  -  should be fresh with default 3600s TTL.
      const cached = {
        data: [{ id: '1', title: 'Recent' }],
        cachedAt: new Date(Date.now() - 1800 * 1_000).toISOString(),
      };
      window.localStorage.setItem(`${CACHE_PREFIX}my-key`, JSON.stringify(cached));
      mockUseOnlineStatus.mockReturnValue({
        isOnline: false,
        wasOffline: false,
        lastOnlineAt: null,
      });

      const { result } = renderHook(() =>
        useOfflineCache<TestRow>({
          shapeUrl: '/api/shapes/test',
          cacheKey: 'my-key',
          // ttlSeconds omitted  -  defaults to 3600
        }),
      );

      expect(result.current.data).toEqual(cached.data);
    });

    it('should pass shapeUrl to useShape', () => {
      renderHook(() => useOfflineCache<TestRow>(defaultOptions()));

      expect(mockUseShape).toHaveBeenCalledWith({
        url: '/api/shapes/test',
        fetchClient: expect.any(Function),
      });
    });
  });
});
