'use client';

import { useEffect, useRef } from 'react';

export interface GestureHandlers {
  /** Called when pointer enters the element */
  onHoverStart?: () => void;
  /** Called when pointer leaves the element */
  onHoverEnd?: () => void;
  /** Called on pointer down (tap start) */
  onTapStart?: (event: PointerEvent) => void;
  /** Called on pointer up within the element (tap end / click) */
  onTap?: (event: PointerEvent) => void;
  /** Called on pointer cancel (tap cancelled, e.g. pointer left element) */
  onTapCancel?: () => void;
  /** Called during drag with current position delta */
  onDrag?: (delta: { x: number; y: number }, event: PointerEvent) => void;
  /** Called when drag starts */
  onDragStart?: (event: PointerEvent) => void;
  /** Called when drag ends with velocity */
  onDragEnd?: (velocity: { x: number; y: number }, event: PointerEvent) => void;
}

interface GestureOptions {
  /** Enable drag detection (default: false) */
  drag?: boolean;
  /** Minimum distance in px before drag starts (default: 3) */
  dragThreshold?: number;
}

/**
 * Attach gesture handlers to an element ref.
 *
 * Supports hover, tap, and drag gestures with proper pointer event handling.
 * Uses pointer events for unified mouse/touch/pen support.
 *
 * @example
 * ```tsx
 * const ref = useRef<HTMLDivElement>(null);
 * useGesture(ref, {
 *   onHoverStart: () => setHovered(true),
 *   onHoverEnd: () => setHovered(false),
 *   onTap: () => console.log('tapped!'),
 * });
 * return <div ref={ref}>Tap me</div>
 * ```
 */
export function useGesture<T extends HTMLElement>(
  ref: React.RefObject<T | null>,
  handlers: GestureHandlers,
  options?: GestureOptions,
): void {
  const handlersRef = useRef(handlers);
  const optionsRef = useRef(options);
  handlersRef.current = handlers;
  optionsRef.current = options;

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const threshold = optionsRef.current?.dragThreshold ?? 3;
    let isDragging = false;
    let startX = 0;
    let startY = 0;
    let lastX = 0;
    let lastY = 0;
    let lastTime = 0;
    let velocityX = 0;
    let velocityY = 0;

    const handlePointerEnter = () => {
      handlersRef.current.onHoverStart?.();
    };

    const handlePointerLeave = () => {
      handlersRef.current.onHoverEnd?.();
    };

    const handlePointerDown = (e: PointerEvent) => {
      handlersRef.current.onTapStart?.(e);

      if (optionsRef.current?.drag) {
        startX = e.clientX;
        startY = e.clientY;
        lastX = e.clientX;
        lastY = e.clientY;
        lastTime = performance.now();
        isDragging = false;

        el.setPointerCapture(e.pointerId);
      }
    };

    const handlePointerMove = (e: PointerEvent) => {
      if (!optionsRef.current?.drag) return;
      if (!el.hasPointerCapture(e.pointerId)) return;

      const dx = e.clientX - startX;
      const dy = e.clientY - startY;

      if (!isDragging) {
        if (Math.abs(dx) > threshold || Math.abs(dy) > threshold) {
          isDragging = true;
          handlersRef.current.onDragStart?.(e);
        } else {
          return;
        }
      }

      // Calculate velocity
      const now = performance.now();
      const dt = (now - lastTime) / 1000;
      if (dt > 0) {
        velocityX = (e.clientX - lastX) / dt;
        velocityY = (e.clientY - lastY) / dt;
      }
      lastX = e.clientX;
      lastY = e.clientY;
      lastTime = now;

      handlersRef.current.onDrag?.({ x: dx, y: dy }, e);
    };

    const handlePointerUp = (e: PointerEvent) => {
      if (isDragging) {
        isDragging = false;
        handlersRef.current.onDragEnd?.({ x: velocityX, y: velocityY }, e);
      } else {
        handlersRef.current.onTap?.(e);
      }
    };

    const handlePointerCancel = () => {
      isDragging = false;
      handlersRef.current.onTapCancel?.();
    };

    el.addEventListener('pointerenter', handlePointerEnter);
    el.addEventListener('pointerleave', handlePointerLeave);
    el.addEventListener('pointerdown', handlePointerDown);
    el.addEventListener('pointermove', handlePointerMove);
    el.addEventListener('pointerup', handlePointerUp);
    el.addEventListener('pointercancel', handlePointerCancel);

    return () => {
      el.removeEventListener('pointerenter', handlePointerEnter);
      el.removeEventListener('pointerleave', handlePointerLeave);
      el.removeEventListener('pointerdown', handlePointerDown);
      el.removeEventListener('pointermove', handlePointerMove);
      el.removeEventListener('pointerup', handlePointerUp);
      el.removeEventListener('pointercancel', handlePointerCancel);
    };
  }, [ref]);
}
