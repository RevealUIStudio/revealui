import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { usePresence } from '../hooks/use-presence.js';

describe('usePresence', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns mounted and present when show is true', async () => {
    const { result } = renderHook(() => usePresence(true));

    // Immediately mounted
    expect(result.current.mounted).toBe(true);

    // present becomes true after double rAF
    await act(async () => {
      // First rAF
      vi.advanceTimersByTime(16);
      // Second rAF
      vi.advanceTimersByTime(16);
    });

    expect(result.current.present).toBe(true);
  });

  it('returns unmounted when show is false initially', () => {
    const { result } = renderHook(() => usePresence(false));
    expect(result.current.mounted).toBe(false);
    expect(result.current.present).toBe(false);
  });

  it('starts exit sequence when show changes to false', async () => {
    const { result, rerender } = renderHook(({ show }: { show: boolean }) => usePresence(show), {
      initialProps: { show: true },
    });

    // Enter
    await act(async () => {
      vi.advanceTimersByTime(32);
    });
    expect(result.current.mounted).toBe(true);
    expect(result.current.present).toBe(true);

    // Exit
    act(() => {
      rerender({ show: false });
    });

    // present should become false immediately
    expect(result.current.present).toBe(false);
    // mounted should still be true (waiting for transition)
    expect(result.current.mounted).toBe(true);
  });

  it('unmounts after exit duration fallback', async () => {
    const exitDuration = 200;
    const { result, rerender } = renderHook(
      ({ show }: { show: boolean }) => usePresence(show, exitDuration),
      { initialProps: { show: true } },
    );

    await act(async () => {
      vi.advanceTimersByTime(32);
    });

    act(() => {
      rerender({ show: false });
    });

    // Not yet unmounted
    expect(result.current.mounted).toBe(true);

    // Advance past exitDuration + 50ms fallback
    await act(async () => {
      vi.advanceTimersByTime(exitDuration + 100);
    });

    expect(result.current.mounted).toBe(false);
  });

  it('provides a ref callback', () => {
    const { result } = renderHook(() => usePresence(true));
    expect(typeof result.current.ref).toBe('function');
  });

  it('remounts when show toggles back to true', async () => {
    const { result, rerender } = renderHook(
      ({ show }: { show: boolean }) => usePresence(show, 100),
      { initialProps: { show: true } },
    );

    await act(async () => {
      vi.advanceTimersByTime(32);
    });

    // Exit
    act(() => {
      rerender({ show: false });
    });
    await act(async () => {
      vi.advanceTimersByTime(200);
    });
    expect(result.current.mounted).toBe(false);

    // Re-enter
    act(() => {
      rerender({ show: true });
    });
    expect(result.current.mounted).toBe(true);

    await act(async () => {
      vi.advanceTimersByTime(32);
    });
    expect(result.current.present).toBe(true);
  });
});
