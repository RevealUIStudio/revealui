import { renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useSpring } from '../hooks/use-spring.js';
import { useStagger } from '../hooks/use-stagger.js';

/**
 * Proves the motion hooks collapse to their final state when the user prefers
 * reduced motion. jsdom has no `matchMedia` by default (so the rest of the
 * suite runs with motion enabled); here we stub it to report `reduce`.
 */
describe('motion hooks honor prefers-reduced-motion', () => {
  beforeEach(() => {
    vi.stubGlobal('matchMedia', (query: string) => ({
      matches: true,
      media: query,
      onchange: null,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
      addListener: () => undefined,
      removeListener: () => undefined,
      dispatchEvent: () => false,
    }));
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('useStagger returns zero delay for every item (no stagger)', () => {
    const { result } = renderHook(() => useStagger(4, { delay: 80 }));
    expect(result.current).toEqual([0, 0, 0, 0]);
  });

  it('useSpring jumps straight to a new target with no animation frames', () => {
    const { result, rerender } = renderHook(({ t }: { t: number }) => useSpring(t), {
      initialProps: { t: 0 },
    });
    expect(result.current.value).toBe(0);

    rerender({ t: 1 });

    // Reduced motion forces the `immediate` path: value lands on target at
    // once, never entering the animating state / frame loop.
    expect(result.current.value).toBe(1);
    expect(result.current.isAnimating).toBe(false);
  });
});
