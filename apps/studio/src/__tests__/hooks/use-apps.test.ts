import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useApps } from '../../hooks/use-apps';
import type { AppStatus } from '../../types';

vi.mock('../../lib/invoke', () => ({
  listApps: vi.fn(),
  startApp: vi.fn(),
  stopApp: vi.fn(),
}));

const { listApps, startApp, stopApp } = await import('../../lib/invoke');

const MOCK_APPS: AppStatus[] = [
  {
    app: { name: 'api', display_name: 'API', port: 3004, url: 'http://localhost:3004' },
    running: false,
  },
  {
    app: { name: 'admin', display_name: 'Admin', port: 4000, url: 'http://localhost:4000' },
    running: true,
  },
];

describe('useApps', () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.clearAllMocks();
    vi.mocked(listApps).mockResolvedValue(MOCK_APPS);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('fetches apps on mount', async () => {
    const { result } = renderHook(() => useApps());

    expect(result.current.loading).toBe(true);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(10);
    });

    expect(result.current.loading).toBe(false);
    expect(listApps).toHaveBeenCalledOnce();
    expect(result.current.apps).toEqual(MOCK_APPS);
    expect(result.current.error).toBeNull();
  });

  it('handles listApps error', async () => {
    vi.mocked(listApps).mockRejectedValueOnce(new Error('IPC unavailable'));

    const { result } = renderHook(() => useApps());

    await act(async () => {
      await vi.advanceTimersByTimeAsync(10);
    });

    expect(result.current.loading).toBe(false);
    expect(result.current.error).toBe('IPC unavailable');
  });

  it('starts an app and polls until running', async () => {
    vi.mocked(startApp).mockResolvedValueOnce('Started');
    // After starting, pollUntil calls listApps; return app as running
    const appsAfterStart: AppStatus[] = [{ ...MOCK_APPS[0], running: true }, MOCK_APPS[1]];
    // First call returns initial state, subsequent calls return running
    vi.mocked(listApps)
      .mockResolvedValueOnce(MOCK_APPS) // initial mount fetch
      .mockResolvedValue(appsAfterStart); // all subsequent polls

    const { result } = renderHook(() => useApps());

    await act(async () => {
      await vi.advanceTimersByTimeAsync(10);
    });

    expect(result.current.loading).toBe(false);

    await act(async () => {
      const startPromise = result.current.start('api');
      // Advance timers for pollUntil internal setTimeout
      await vi.advanceTimersByTimeAsync(2000);
      await startPromise;
    });

    expect(startApp).toHaveBeenCalledWith('api');
    expect(result.current.operating.api).toBeFalsy();
  });

  it('handles start error', async () => {
    vi.mocked(startApp).mockRejectedValueOnce(new Error('Port in use'));

    const { result } = renderHook(() => useApps());

    await act(async () => {
      await vi.advanceTimersByTimeAsync(10);
    });

    await act(async () => {
      await result.current.start('api');
    });

    expect(result.current.error).toBe('Port in use');
    expect(result.current.operating.api).toBe(false);
  });

  it('stops an app', async () => {
    vi.mocked(stopApp).mockResolvedValueOnce('Stopped');
    const appsAfterStop: AppStatus[] = [MOCK_APPS[0], { ...MOCK_APPS[1], running: false }];
    vi.mocked(listApps)
      .mockResolvedValueOnce(MOCK_APPS) // initial
      .mockResolvedValue(appsAfterStop);

    const { result } = renderHook(() => useApps());

    await act(async () => {
      await vi.advanceTimersByTimeAsync(10);
    });

    await act(async () => {
      const stopPromise = result.current.stop('admin');
      await vi.advanceTimersByTimeAsync(1000);
      await stopPromise;
    });

    expect(stopApp).toHaveBeenCalledWith('admin');
    expect(result.current.operating.admin).toBeFalsy();
  });

  it('handles stop error', async () => {
    vi.mocked(stopApp).mockRejectedValueOnce(new Error('Cannot stop'));

    const { result } = renderHook(() => useApps());

    await act(async () => {
      await vi.advanceTimersByTimeAsync(10);
    });

    await act(async () => {
      await result.current.stop('admin');
    });

    expect(result.current.error).toBe('Cannot stop');
  });

  it('polls apps on 5s interval when document is visible', async () => {
    Object.defineProperty(document, 'hidden', { value: false, configurable: true });

    const { result } = renderHook(() => useApps());

    await act(async () => {
      await vi.advanceTimersByTimeAsync(10);
    });

    expect(result.current.loading).toBe(false);
    const callCountBefore = vi.mocked(listApps).mock.calls.length;

    await act(async () => {
      await vi.advanceTimersByTimeAsync(5_000);
    });

    expect(vi.mocked(listApps).mock.calls.length).toBeGreaterThan(callCountBefore);
  });

  it('clears polling interval on unmount', async () => {
    const { result, unmount } = renderHook(() => useApps());

    await act(async () => {
      await vi.advanceTimersByTimeAsync(10);
    });

    expect(result.current.loading).toBe(false);
    unmount();

    const callCount = vi.mocked(listApps).mock.calls.length;

    await act(async () => {
      await vi.advanceTimersByTimeAsync(10_000);
    });

    expect(vi.mocked(listApps).mock.calls.length).toBe(callCount);
  });
});
