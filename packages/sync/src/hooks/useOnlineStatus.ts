'use client';

import { useEffect, useRef, useState } from 'react';

/** Duration in ms before `wasOffline` resets after reconnection. */
const WAS_OFFLINE_RESET_MS = 5_000;

export interface OnlineStatusResult {
  /** Whether the browser currently has network connectivity. */
  isOnline: boolean;
  /** Whether the connection was recently restored (resets after 5 s). */
  wasOffline: boolean;
  /** Timestamp of the last time the browser was confirmed online. */
  lastOnlineAt: Date | null;
}

/** SSR-safe default: assume online when `window` is unavailable. */
const SSR_DEFAULT: OnlineStatusResult = {
  isOnline: true,
  wasOffline: false,
  lastOnlineAt: null,
};

/**
 * Check whether the current environment is a browser.
 * Returns `false` during SSR / Node.js test runs without a DOM.
 */
function isBrowser(): boolean {
  return typeof window !== 'undefined';
}

/**
 * Track browser online/offline status with reconnection awareness.
 *
 * - `isOnline` reflects `navigator.onLine` and live `online`/`offline` events.
 * - `wasOffline` becomes `true` when connectivity is restored and resets to
 *   `false` after 5 seconds.
 * - `lastOnlineAt` records the most recent reconnection timestamp.
 *
 * During SSR (when `window` is not available) the hook returns
 * `{ isOnline: true, wasOffline: false, lastOnlineAt: null }`.
 */
export function useOnlineStatus(): OnlineStatusResult {
  const [isOnline, setIsOnline] = useState(() => (isBrowser() ? navigator.onLine : true));
  const [wasOffline, setWasOffline] = useState(false);
  const [lastOnlineAt, setLastOnlineAt] = useState<Date | null>(null);
  const resetTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    // No-op during SSR  -  the effect only runs in the browser.
    if (!isBrowser()) {
      return;
    }

    function handleOnline(): void {
      setIsOnline(true);
      setLastOnlineAt(new Date());
      setWasOffline(true);

      // Clear any existing timer before setting a new one.
      if (resetTimerRef.current !== null) {
        clearTimeout(resetTimerRef.current);
      }
      resetTimerRef.current = setTimeout(() => {
        setWasOffline(false);
        resetTimerRef.current = null;
      }, WAS_OFFLINE_RESET_MS);
    }

    function handleOffline(): void {
      setIsOnline(false);
      setWasOffline(false);

      if (resetTimerRef.current !== null) {
        clearTimeout(resetTimerRef.current);
        resetTimerRef.current = null;
      }
    }

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);

      if (resetTimerRef.current !== null) {
        clearTimeout(resetTimerRef.current);
      }
    };
  }, []);

  if (!isBrowser()) {
    return SSR_DEFAULT;
  }

  return { isOnline, wasOffline, lastOnlineAt };
}
