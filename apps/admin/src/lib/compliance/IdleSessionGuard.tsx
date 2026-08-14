'use client';

import { useSignOut } from '@revealui/auth/react';
import { resolveComplianceProfile } from '@revealui/security';
import { useEffect, useRef } from 'react';

const ACTIVITY_EVENTS = ['mousemove', 'keydown', 'click', 'scroll', 'touchstart'] as const;

/**
 * HIPAA automatic logoff. No-op on the standard profile (timeout is 0).
 */
export function IdleSessionGuard(): null {
  const profile = resolveComplianceProfile(process.env);
  const { signOut } = useSignOut();
  const lastActivity = useRef(Date.now());
  const timeoutMs = profile.sessionIdleTimeoutSeconds * 1000;

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
