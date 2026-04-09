import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

describe('useSpring', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.resetModules();
  });

  afterEach(() => {
    // Flush pending frame-loop ticks so the singleton resets
    act(() => {
      vi.runOnlyPendingTimers();
    });
    vi.useRealTimers();
  });

  async function importHook() {
    const mod = await import('../hooks/use-spring.js');
    return mod.useSpring;
  }

  function advanceFrames(count = 1) {
    for (let i = 0; i < count; i++) {
      act(() => {
        vi.advanceTimersByTime(16);
      });
    }
  }

  it('initializes with the target value', async () => {
    const useSpring = await importHook();
    const { result } = renderHook(() => useSpring(5));
    expect(result.current.value).toBe(5);
    expect(result.current.velocity).toBe(0);
    expect(result.current.isAnimating).toBe(false);
  });

  it('animates when target changes', async () => {
    const useSpring = await importHook();
    const { result, rerender } = renderHook(({ target }: { target: number }) => useSpring(target), {
      initialProps: { target: 0 },
    });

    act(() => {
      rerender({ target: 100 });
    });

    advanceFrames(5);

    expect(result.current.isAnimating).toBe(true);
    expect(result.current.value).toBeGreaterThan(0);
    expect(result.current.value).toBeLessThan(100);
  });

  it('converges to target over time', async () => {
    const useSpring = await importHook();
    const { result, rerender } = renderHook(({ target }: { target: number }) => useSpring(target), {
      initialProps: { target: 0 },
    });

    act(() => {
      rerender({ target: 1 });
    });

    advanceFrames(300);

    expect(result.current.value).toBeCloseTo(1, 1);
  });

  it('immediate option jumps to value without animation', async () => {
    const useSpring = await importHook();
    const { result, rerender } = renderHook(
      ({ target, immediate }: { target: number; immediate: boolean }) =>
        useSpring(target, { immediate }),
      { initialProps: { target: 0, immediate: false } },
    );

    act(() => {
      rerender({ target: 100, immediate: true });
    });

    expect(result.current.value).toBe(100);
    expect(result.current.velocity).toBe(0);
    expect(result.current.isAnimating).toBe(false);
  });

  it('set() jumps to value and stops animation', async () => {
    const useSpring = await importHook();
    const { result, rerender } = renderHook(({ target }: { target: number }) => useSpring(target), {
      initialProps: { target: 0 },
    });

    act(() => {
      rerender({ target: 100 });
    });
    advanceFrames(3);
    expect(result.current.isAnimating).toBe(true);

    act(() => {
      result.current.set(50);
    });

    expect(result.current.value).toBe(50);
    expect(result.current.velocity).toBe(0);
    expect(result.current.isAnimating).toBe(false);
  });

  it('accepts preset name for config', async () => {
    const useSpring = await importHook();
    const { result, rerender } = renderHook(
      ({ target }: { target: number }) => useSpring(target, { config: 'bouncy' }),
      { initialProps: { target: 0 } },
    );

    act(() => {
      rerender({ target: 1 });
    });

    advanceFrames(10);

    expect(result.current.value).toBeGreaterThan(0);
  });
});
