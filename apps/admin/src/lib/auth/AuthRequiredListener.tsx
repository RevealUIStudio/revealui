'use client';

import { AUTH_REQUIRED_EVENT_NAME } from '@revealui/paywall/client';
import { useEffect } from 'react';
import { redirectToLogin } from './redirect-to-login';

/**
 * Listens for API 401s from upgradeAwareFetch and sends the operator to login
 * (GAP-454). Mount once under the admin providers tree.
 */
export function AuthRequiredListener(): null {
  useEffect(() => {
    const onAuthRequired = () => {
      redirectToLogin();
    };
    window.addEventListener(AUTH_REQUIRED_EVENT_NAME, onAuthRequired);
    return () => {
      window.removeEventListener(AUTH_REQUIRED_EVENT_NAME, onAuthRequired);
    };
  }, []);
  return null;
}
