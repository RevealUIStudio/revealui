'use client';

import { useSignOut } from '@revealui/auth/react';
import { useEffect, useRef } from 'react';

const ACTIVITY_EVENTS = ['mousemove', 'keydown', 'click', 'scroll', 'touchstart'] as const;

export interface IdleSessionGuardProps {
  /** Automatic logoff after this many idle seconds. 0 = disabled. */
  sessionIdleTimeoutSeconds: number;
}

/**
 * HIPAA automatic logoff. No-op when the server passes timeout 0.
 * Timeout comes from the server layout, not from process.env in the browser.
 */
export function IdleSessionGuard({ sessionIdleTimeoutSeconds }: IdleSessionGuardProps): null {
  const { signOut } = useSignOut();
  const lastActivity = useRef(Date.now());
  const timeoutMs = sessionIdleTimeoutSeconds * 1000;

  useEffect(() => {
    if (timeoutMs <= 0) {
      return;
    }

    const mark = (): void => {
      lastActivity.current = Date.now();
    };
    for (const event of ACTIVITY_EVENTS) {
      window.addEventListener(event, mark, { passive: true });
    }

    const timer = window.setInterval(() => {
      if (Date.now() - lastActivity.current >= timeoutMs) {
        void signOut();
      }
    }, 15_000);

    return () => {
      window.clearInterval(timer);
      for (const event of ACTIVITY_EVENTS) {
        window.removeEventListener(event, mark);
      }
    };
  }, [signOut, timeoutMs]);

  return null;
}
