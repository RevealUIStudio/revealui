import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useSync } from '../../hooks/use-sync';
import type { SyncResult } from '../../types';

vi.mock('../../lib/invoke', () => ({
  syncAllRepos: vi.fn(),
  syncRepo: vi.fn(),
}));

const { syncAllRepos, syncRepo } = await import('../../lib/invoke');

const MOCK_RESULTS: SyncResult[] = [
  { drive: 'C', repo: 'RevealUI', status: 'ok', branch: 'main' },
  { drive: 'E', repo: 'RevealUI', status: 'ok', branch: 'main' },
];

describe('useSync', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('initializes with default state', () => {
    const { result } = renderHook(() => useSync());

    expect(result.current.syncing).toBe(false);
    expect(result.current.results).toEqual([]);
    expect(result.current.log).toEqual([]);
    expect(result.current.error).toBeNull();
  });

  it('syncs all repos successfully', async () => {
    vi.mocked(syncAllRepos).mockResolvedValueOnce(MOCK_RESULTS);

    const { result } = renderHook(() => useSync());

    await act(async () => {
      await result.current.syncAll();
    });

    expect(syncAllRepos).toHaveBeenCalledOnce();
    expect(result.current.syncing).toBe(false);
    expect(result.current.results).toEqual(MOCK_RESULTS);
    expect(result.current.log).toContain('Starting full repo sync...');
    expect(result.current.log).toContain('Sync complete: 2/2 OK');
    expect(result.current.error).toBeNull();
  });

  it('handles syncAll error', async () => {
    vi.mocked(syncAllRepos).mockRejectedValueOnce(new Error('Network error'));

    const { result } = renderHook(() => useSync());

    await act(async () => {
      await result.current.syncAll();
    });

    expect(result.current.syncing).toBe(false);
    expect(result.current.error).toBe('Network error');
    expect(result.current.log).toContain('Error: Network error');
  });

  it('syncs a single repo successfully', async () => {
    const singleResult: SyncResult = { drive: 'C', repo: 'RevealUI', status: 'ok', branch: 'main' };
    vi.mocked(syncRepo).mockResolvedValueOnce(singleResult);

    const { result } = renderHook(() => useSync());

    // Pre-populate results so the map replacement works
    await act(async () => {
      vi.mocked(syncAllRepos).mockResolvedValueOnce(MOCK_RESULTS);
      await result.current.syncAll();
    });

    await act(async () => {
      await result.current.syncOne('RevealUI');
    });

    expect(syncRepo).toHaveBeenCalledWith('RevealUI');
    expect(result.current.syncing).toBe(false);
    expect(result.current.log).toContain('Syncing RevealUI...');
    expect(result.current.log).toContain('RevealUI: ok');
  });

  it('handles syncOne error', async () => {
    vi.mocked(syncRepo).mockRejectedValueOnce(new Error('Dirty working tree'));

    const { result } = renderHook(() => useSync());

    await act(async () => {
      await result.current.syncOne('RevealUI');
    });

    expect(result.current.syncing).toBe(false);
    expect(result.current.error).toBe('Dirty working tree');
  });

  it('counts only ok results in sync summary', async () => {
    const mixed: SyncResult[] = [
      { drive: 'C', repo: 'RevealUI', status: 'ok', branch: 'main' },
      { drive: 'E', repo: 'RevealUI', status: 'dirty', branch: 'main' },
      { drive: 'C', repo: 'other', status: 'error', branch: 'main' },
    ];
    vi.mocked(syncAllRepos).mockResolvedValueOnce(mixed);

    const { result } = renderHook(() => useSync());

    await act(async () => {
      await result.current.syncAll();
    });

    expect(result.current.log).toContain('Sync complete: 1/3 OK');
  });
});
