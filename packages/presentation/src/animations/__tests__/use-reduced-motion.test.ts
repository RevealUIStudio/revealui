import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useReducedMotion } from '../hooks/use-reduced-motion.js';

type ChangeHandler = (event: MediaQueryListEvent) => void;

describe('useReducedMotion', () => {
  let matches: boolean;
  let handlers: Set<ChangeHandler>;

  beforeEach(() => {
    matches = false;
    handlers = new Set();
    vi.stubGlobal('matchMedia', (query: string) => ({
      get matches() {
        return matches;
      },
      media: query,
      onchange: null,
      addEventListener: (_type: string, cb: ChangeHandler) => handlers.add(cb),
      removeEventListener: (_type: string, cb: ChangeHandler) => handlers.delete(cb),
      addListener: (cb: ChangeHandler) => handlers.add(cb),
      removeListener: (cb: ChangeHandler) => handlers.delete(cb),
      dispatchEvent: () => false,
    }));
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  function emitChange(next: boolean): void {
    matches = next;
    for (const cb of handlers) {
      cb({ matches: next } as MediaQueryListEvent);
    }
  }

  it('returns false when reduced motion is not requested', () => {
    const { result } = renderHook(() => useReducedMotion());
    expect(result.current).toBe(false);
  });

  it('returns true when prefers-reduced-motion is set', () => {
    matches = true;
    const { result } = renderHook(() => useReducedMotion());
    expect(result.current).toBe(true);
  });

  it('reacts to runtime changes in the media query', () => {
    const { result } = renderHook(() => useReducedMotion());
    expect(result.current).toBe(false);

    act(() => emitChange(true));
    expect(result.current).toBe(true);

    act(() => emitChange(false));
    expect(result.current).toBe(false);
  });

  it('unsubscribes the change listener on unmount', () => {
    const { unmount } = renderHook(() => useReducedMotion());
    expect(handlers.size).toBe(1);
    unmount();
    expect(handlers.size).toBe(0);
  });

  it('returns false when matchMedia is unavailable (SSR / older runtime)', () => {
    vi.stubGlobal('matchMedia', undefined);
    const { result } = renderHook(() => useReducedMotion());
    expect(result.current).toBe(false);
  });
});
