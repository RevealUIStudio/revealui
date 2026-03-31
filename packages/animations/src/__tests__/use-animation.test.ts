import { renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useAnimation } from '../hooks/use-animation.js';

describe('useAnimation', () => {
  let mockAnimate: ReturnType<typeof vi.fn>;
  let mockCancel: ReturnType<typeof vi.fn>;
  let finishedResolve: () => void;

  beforeEach(() => {
    mockCancel = vi.fn();
    mockAnimate = vi.fn(() => ({
      finished: new Promise<void>((resolve) => {
        finishedResolve = resolve;
      }),
      cancel: mockCancel,
    }));
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns a ref and an animate function', () => {
    const { result } = renderHook(() => useAnimation<HTMLDivElement>());
    const [ref, animate] = result.current;
    expect(ref).toBeDefined();
    expect(typeof animate).toBe('function');
  });

  it('animate calls element.animate with keyframes', async () => {
    const { result } = renderHook(() => useAnimation<HTMLDivElement>());
    const [ref, animate] = result.current;

    // Set up mock element
    const el = document.createElement('div');
    el.animate = mockAnimate;
    // @ts-expect-error -- setting ref.current for testing
    ref.current = el;

    const keyframes = [{ opacity: 0 }, { opacity: 1 }];
    const promise = animate(keyframes, { duration: 300 });

    expect(mockAnimate).toHaveBeenCalledOnce();
    expect(mockAnimate.mock.calls[0][0]).toEqual(keyframes);

    const options = mockAnimate.mock.calls[0][1] as KeyframeAnimationOptions;
    expect(options.duration).toBe(300);
    expect(options.fill).toBe('forwards');

    // Resolve animation
    finishedResolve();
    await expect(promise).resolves.toBeUndefined();
  });

  it('uses default config values', async () => {
    const { result } = renderHook(() => useAnimation<HTMLDivElement>());
    const [ref, animate] = result.current;

    const el = document.createElement('div');
    el.animate = mockAnimate;
    // @ts-expect-error -- setting ref.current for testing
    ref.current = el;

    animate([{ opacity: 0 }, { opacity: 1 }]);

    const options = mockAnimate.mock.calls[0][1] as KeyframeAnimationOptions;
    expect(options.duration).toBe(300);
    expect(options.delay).toBe(0);
    expect(options.fill).toBe('forwards');
  });

  it('cancels previous animation before starting new one', () => {
    const { result } = renderHook(() => useAnimation<HTMLDivElement>());
    const [ref, animate] = result.current;

    const el = document.createElement('div');
    el.animate = mockAnimate;
    // @ts-expect-error -- setting ref.current for testing
    ref.current = el;

    animate([{ opacity: 0 }, { opacity: 1 }]);
    animate([{ transform: 'scale(0)' }, { transform: 'scale(1)' }]);

    // First animation should be cancelled
    expect(mockCancel).toHaveBeenCalledOnce();
    // Two animations should have been created
    expect(mockAnimate).toHaveBeenCalledTimes(2);
  });

  it('handles named easing strings', () => {
    const { result } = renderHook(() => useAnimation<HTMLDivElement>());
    const [ref, animate] = result.current;

    const el = document.createElement('div');
    el.animate = mockAnimate;
    // @ts-expect-error -- setting ref.current for testing
    ref.current = el;

    animate([{ opacity: 0 }, { opacity: 1 }], { easing: 'linear' });

    const options = mockAnimate.mock.calls[0][1] as KeyframeAnimationOptions;
    expect(options.easing).toBe('linear');
  });

  it('does nothing if ref has no element', async () => {
    const { result } = renderHook(() => useAnimation<HTMLDivElement>());
    const [, animate] = result.current;

    // No element set on ref — should not throw
    await expect(animate([{ opacity: 0 }, { opacity: 1 }])).resolves.toBeUndefined();
  });
});
