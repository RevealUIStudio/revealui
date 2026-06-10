'use client';

import { useSyncExternalStore } from 'react';

const REDUCED_MOTION_QUERY = '(prefers-reduced-motion: reduce)';

function getMatchMedia(): MediaQueryList | null {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
    return null;
  }
  return window.matchMedia(REDUCED_MOTION_QUERY);
}

function subscribe(onStoreChange: () => void): () => void {
  const mql = getMatchMedia();
  if (!mql) {
    return () => undefined;
  }
  mql.addEventListener('change', onStoreChange);
  return () => mql.removeEventListener('change', onStoreChange);
}

function getSnapshot(): boolean {
  return getMatchMedia()?.matches ?? false;
}

function getServerSnapshot(): boolean {
  // No media query on the server. Assume motion is allowed and let the client
  // correct on hydration — useSyncExternalStore reconciles the two snapshots
  // without a hydration-mismatch warning.
  return false;
}

/**
 * Returns `true` when the user has requested reduced motion via the OS /
 * browser `prefers-reduced-motion: reduce` setting.
 *
 * SSR-safe (returns `false` on the server) and reactive (re-renders when the
 * setting changes at runtime). The animation hooks — `useSpring`,
 * `useAnimation`, `useStagger`, `usePresence` — consume this to collapse motion
 * to its final state when reduced motion is requested, so honoring the setting
 * is automatic for anything built on them.
 *
 * @example
 * ```tsx
 * const reduce = useReducedMotion();
 * const spring = useSpring(open ? 1 : 0, { immediate: reduce });
 * ```
 */
export function useReducedMotion(): boolean {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
