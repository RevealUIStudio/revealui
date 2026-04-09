import { renderHook } from '@testing-library/react';
import { createRef, type RefObject } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useGesture } from '../hooks/use-gesture.js';

// jsdom doesn't provide PointerEvent — polyfill from MouseEvent
class MockPointerEvent extends MouseEvent {
  readonly pointerId: number;
  constructor(type: string, init: PointerEventInit & { pointerId?: number } = {}) {
    super(type, init);
    this.pointerId = init.pointerId ?? 0;
  }
}

describe('useGesture', () => {
  let el: HTMLDivElement;
  let ref: RefObject<HTMLDivElement>;

  beforeEach(() => {
    vi.stubGlobal('PointerEvent', MockPointerEvent);
    vi.stubGlobal('performance', { now: vi.fn(() => 0) });

    el = document.createElement('div');
    document.body.appendChild(el);
    ref = { current: el } as RefObject<HTMLDivElement>;
  });

  afterEach(() => {
    document.body.removeChild(el);
    vi.restoreAllMocks();
  });

  function firePointerEvent(type: string, options: Record<string, unknown> = {}) {
    const event = new MockPointerEvent(type, {
      bubbles: true,
      pointerId: 1,
      clientX: 0,
      clientY: 0,
      ...options,
    });
    el.dispatchEvent(event);
    return event;
  }

  it('calls onHoverStart and onHoverEnd', () => {
    const onHoverStart = vi.fn();
    const onHoverEnd = vi.fn();

    renderHook(() => useGesture(ref, { onHoverStart, onHoverEnd }));

    el.dispatchEvent(new MockPointerEvent('pointerenter', { bubbles: true }));
    expect(onHoverStart).toHaveBeenCalledOnce();

    el.dispatchEvent(new MockPointerEvent('pointerleave', { bubbles: true }));
    expect(onHoverEnd).toHaveBeenCalledOnce();
  });

  it('calls onTapStart on pointerdown', () => {
    const onTapStart = vi.fn();

    renderHook(() => useGesture(ref, { onTapStart }));

    firePointerEvent('pointerdown');
    expect(onTapStart).toHaveBeenCalledOnce();
  });

  it('calls onTap on pointerup without drag', () => {
    const onTap = vi.fn();

    renderHook(() => useGesture(ref, { onTap }));

    firePointerEvent('pointerdown', { clientX: 10, clientY: 10 });
    firePointerEvent('pointerup', { clientX: 10, clientY: 10 });
    expect(onTap).toHaveBeenCalledOnce();
  });

  it('calls onTapCancel on pointercancel', () => {
    const onTapCancel = vi.fn();

    renderHook(() => useGesture(ref, { onTapCancel }));

    firePointerEvent('pointerdown');
    firePointerEvent('pointercancel');
    expect(onTapCancel).toHaveBeenCalledOnce();
  });

  it('detects drag when movement exceeds threshold', () => {
    const onDragStart = vi.fn();
    const onDrag = vi.fn();
    const onDragEnd = vi.fn();

    el.setPointerCapture = vi.fn();
    el.hasPointerCapture = vi.fn(() => true);
    el.releasePointerCapture = vi.fn();

    renderHook(() =>
      useGesture(ref, { onDragStart, onDrag, onDragEnd }, { drag: true, dragThreshold: 3 }),
    );

    firePointerEvent('pointerdown', { clientX: 0, clientY: 0 });

    // Move within threshold — not dragging yet
    firePointerEvent('pointermove', { clientX: 1, clientY: 1 });
    expect(onDragStart).not.toHaveBeenCalled();

    // Move past threshold
    firePointerEvent('pointermove', { clientX: 5, clientY: 0 });
    expect(onDragStart).toHaveBeenCalledOnce();
    expect(onDrag).toHaveBeenCalled();

    // End drag
    firePointerEvent('pointerup', { clientX: 5, clientY: 0 });
    expect(onDragEnd).toHaveBeenCalledOnce();
  });

  it('does not trigger drag without drag option', () => {
    const onDrag = vi.fn();

    renderHook(() => useGesture(ref, { onDrag }, { drag: false }));

    firePointerEvent('pointerdown', { clientX: 0, clientY: 0 });
    firePointerEvent('pointermove', { clientX: 50, clientY: 50 });
    expect(onDrag).not.toHaveBeenCalled();
  });

  it('cleans up event listeners on unmount', () => {
    const onTap = vi.fn();

    const { unmount } = renderHook(() => useGesture(ref, { onTap }));

    unmount();

    firePointerEvent('pointerdown');
    firePointerEvent('pointerup');
    expect(onTap).not.toHaveBeenCalled();
  });

  it('handles null ref gracefully', () => {
    const nullRef = createRef<HTMLDivElement>();
    const onTap = vi.fn();

    expect(() => {
      renderHook(() => useGesture(nullRef, { onTap }));
    }).not.toThrow();
  });
});
