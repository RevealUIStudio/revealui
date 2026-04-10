import { renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { useStagger } from '../hooks/use-stagger.js';

describe('useStagger', () => {
  it('returns array of delay values', () => {
    const { result } = renderHook(() => useStagger(4));
    expect(result.current).toEqual([0, 50, 100, 150]);
  });

  it('uses default delay of 50ms', () => {
    const { result } = renderHook(() => useStagger(3));
    expect(result.current).toEqual([0, 50, 100]);
  });

  it('accepts custom delay', () => {
    const { result } = renderHook(() => useStagger(3, { delay: 100 }));
    expect(result.current).toEqual([0, 100, 200]);
  });

  it('handles direction: reverse', () => {
    const { result } = renderHook(() => useStagger(4, { direction: 'reverse' }));
    expect(result.current).toEqual([150, 100, 50, 0]);
  });

  it('handles direction: forward (default)', () => {
    const { result } = renderHook(() => useStagger(3, { direction: 'forward' }));
    expect(result.current).toEqual([0, 50, 100]);
  });

  it('handles count of 0', () => {
    const { result } = renderHook(() => useStagger(0));
    expect(result.current).toEqual([]);
  });

  it('handles count of 1', () => {
    const { result } = renderHook(() => useStagger(1));
    expect(result.current).toEqual([0]);
  });

  it('reverse with count of 1', () => {
    const { result } = renderHook(() => useStagger(1, { direction: 'reverse' }));
    expect(result.current).toEqual([0]);
  });

  it('memoizes result for same inputs', () => {
    const { result, rerender } = renderHook(
      ({ count, delay }: { count: number; delay: number }) => useStagger(count, { delay }),
      { initialProps: { count: 3, delay: 50 } },
    );

    const first = result.current;
    rerender({ count: 3, delay: 50 });
    expect(result.current).toBe(first);
  });

  it('recalculates when count changes', () => {
    const { result, rerender } = renderHook(({ count }: { count: number }) => useStagger(count), {
      initialProps: { count: 3 },
    });

    expect(result.current).toEqual([0, 50, 100]);
    rerender({ count: 5 });
    expect(result.current).toEqual([0, 50, 100, 150, 200]);
  });
});
