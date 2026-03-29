'use client';

import { useCallback, useEffect, useRef, useSyncExternalStore } from 'react';
import { onFrame } from '../core/frame-loop.js';
import {
  resolveSpringConfig,
  type SpringConfig,
  type SpringPreset,
  stepSpring,
} from '../core/spring.js';

interface SpringOptions {
  /** Spring configuration or preset name */
  config?: Partial<SpringConfig> | SpringPreset;
  /** Immediately jump to target without animation */
  immediate?: boolean;
}

interface SpringValue {
  /** Current animated value */
  value: number;
  /** Current velocity */
  velocity: number;
  /** Whether the spring is currently animating */
  isAnimating: boolean;
  /** Immediately set value without animation */
  set: (value: number) => void;
}

/**
 * Animate a value with spring physics.
 *
 * @example
 * ```tsx
 * const spring = useSpring(isOpen ? 1 : 0, { config: 'bouncy' });
 * return <div style={{ opacity: spring.value, transform: `scale(${0.8 + spring.value * 0.2})` }} />
 * ```
 */
export function useSpring(target: number, options?: SpringOptions): SpringValue {
  const config = resolveSpringConfig(options?.config);
  const stateRef = useRef({ value: target, velocity: 0, animating: false });
  const targetRef = useRef(target);
  const configRef = useRef(config);
  const cleanupRef = useRef<(() => void) | null>(null);
  const listenersRef = useRef(new Set<() => void>());

  configRef.current = config;

  const notify = useCallback(() => {
    for (const listener of listenersRef.current) {
      listener();
    }
  }, []);

  // Subscribe for useSyncExternalStore
  const subscribe = useCallback((listener: () => void) => {
    listenersRef.current.add(listener);
    return () => listenersRef.current.delete(listener);
  }, []);

  const getSnapshot = useCallback(() => stateRef.current, []);

  const state = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);

  // Start/update animation when target changes
  useEffect(() => {
    targetRef.current = target;

    if (options?.immediate) {
      stateRef.current = { value: target, velocity: 0, animating: false };
      cleanupRef.current?.();
      cleanupRef.current = null;
      notify();
      return;
    }

    // Already at target
    if (stateRef.current.value === target && stateRef.current.velocity === 0) {
      return;
    }

    stateRef.current = { ...stateRef.current, animating: true };
    notify();

    // Start animation frame loop
    cleanupRef.current?.();
    cleanupRef.current = onFrame((dt) => {
      const { value, velocity, done } = stepSpring(
        configRef.current,
        stateRef.current.value,
        targetRef.current,
        stateRef.current.velocity,
        dt,
      );

      stateRef.current = { value, velocity, animating: !done };
      notify();

      if (done) {
        cleanupRef.current?.();
        cleanupRef.current = null;
      }
    });

    return () => {
      cleanupRef.current?.();
      cleanupRef.current = null;
    };
  }, [target, options?.immediate, notify]);

  const set = useCallback(
    (value: number) => {
      cleanupRef.current?.();
      cleanupRef.current = null;
      targetRef.current = value;
      stateRef.current = { value, velocity: 0, animating: false };
      notify();
    },
    [notify],
  );

  return {
    value: state.value,
    velocity: state.velocity,
    isAnimating: state.animating,
    set,
  };
}
