import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useOnlineStatus } from '../useOnlineStatus.js';

describe('useOnlineStatus', () => {
  let onlineListeners: Array<() => void>;
  let offlineListeners: Array<() => void>;

  beforeEach(() => {
    onlineListeners = [];
    offlineListeners = [];

    // Default: browser reports online.
    Object.defineProperty(navigator, 'onLine', { value: true, writable: true, configurable: true });

    vi.spyOn(window, 'addEventListener').mockImplementation((type, listener) => {
      if (type === 'online') onlineListeners.push(listener as () => void);
      if (type === 'offline') offlineListeners.push(listener as () => void);
    });

    vi.spyOn(window, 'removeEventListener').mockImplementation(() => {
      // No-op for cleanup tracking.
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it('should return online by default', () => {
    const { result } = renderHook(() => useOnlineStatus());
    expect(result.current.isOnline).toBe(true);
    expect(result.current.wasOffline).toBe(false);
    expect(result.current.lastOnlineAt).toBeNull();
  });

  it('should reflect navigator.onLine initial state (offline)', () => {
    Object.defineProperty(navigator, 'onLine', { value: false, configurable: true });

    const { result } = renderHook(() => useOnlineStatus());
    expect(result.current.isOnline).toBe(false);
  });

  it('should detect going offline', () => {
    const { result } = renderHook(() => useOnlineStatus());
    expect(result.current.isOnline).toBe(true);

    act(() => {
      for (const listener of offlineListeners) listener();
    });

    expect(result.current.isOnline).toBe(false);
    expect(result.current.wasOffline).toBe(false);
  });

  it('should detect reconnection and set wasOffline', () => {
    vi.useFakeTimers();

    const { result } = renderHook(() => useOnlineStatus());

    // Go offline.
    act(() => {
      for (const listener of offlineListeners) listener();
    });
    expect(result.current.isOnline).toBe(false);

    // Come back online.
    act(() => {
      for (const listener of onlineListeners) listener();
    });
    expect(result.current.isOnline).toBe(true);
    expect(result.current.wasOffline).toBe(true);
    expect(result.current.lastOnlineAt).toBeInstanceOf(Date);
  });

  it('should reset wasOffline after 5 seconds', () => {
    vi.useFakeTimers();

    const { result } = renderHook(() => useOnlineStatus());

    // Go offline then online.
    act(() => {
      for (const listener of offlineListeners) listener();
    });
    act(() => {
      for (const listener of onlineListeners) listener();
    });
    expect(result.current.wasOffline).toBe(true);

    // Advance time by 5 seconds.
    act(() => {
      vi.advanceTimersByTime(5_000);
    });
    expect(result.current.wasOffline).toBe(false);
  });

  it('should register event listeners', () => {
    renderHook(() => useOnlineStatus());

    expect(window.addEventListener).toHaveBeenCalledWith('online', expect.any(Function));
    expect(window.addEventListener).toHaveBeenCalledWith('offline', expect.any(Function));
  });

  it('should clean up event listeners on unmount', () => {
    const { unmount } = renderHook(() => useOnlineStatus());
    unmount();

    expect(window.removeEventListener).toHaveBeenCalledWith('online', expect.any(Function));
    expect(window.removeEventListener).toHaveBeenCalledWith('offline', expect.any(Function));
  });

  it('should update lastOnlineAt on each reconnection', () => {
    vi.useFakeTimers();
    const now = new Date('2026-01-01T00:00:00Z');
    vi.setSystemTime(now);

    const { result } = renderHook(() => useOnlineStatus());

    // First disconnect/reconnect cycle.
    act(() => {
      for (const listener of offlineListeners) listener();
    });
    act(() => {
      for (const listener of onlineListeners) listener();
    });

    const firstOnlineAt = result.current.lastOnlineAt;
    expect(firstOnlineAt).toEqual(now);

    // Wait, then second cycle.
    act(() => {
      vi.advanceTimersByTime(10_000);
    });
    act(() => {
      for (const listener of offlineListeners) listener();
    });
    act(() => {
      vi.setSystemTime(new Date('2026-01-01T00:01:00Z'));
      for (const listener of onlineListeners) listener();
    });

    expect(result.current.lastOnlineAt).toEqual(new Date('2026-01-01T00:01:00Z'));
  });
});
