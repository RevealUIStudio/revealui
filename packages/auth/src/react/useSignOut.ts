/**
 * useSignOut Hook
 *
 * React hook for signing out a user.
 *
 * CSRF: the sign-out POST echoes the JS-readable `revealui-csrf` cookie (the
 * signed double-submit token the RevealUI admin proxy issues on page load) as
 * an `X-CSRF-Token` header when the cookie is present. The proxy requires it
 * on session-cookie-bearing unsafe requests and `/api/auth/sign-out` is not
 * exempt — sign-out always carries a session, so without the header it 403s
 * ("CSRF token missing") and the server-side session survives. Cookie-less
 * callers send no header and are unchanged.
 */

'use client';

import { useState } from 'react';
import { readCsrfToken } from './csrf.js';

export interface UseSignOutResult {
  signOut: () => Promise<void>;
  isLoading: boolean;
  error: Error | null;
}

/**
 * Hook to sign out a user
 *
 * @returns Sign out function, loading state, and error
 *
 * @example
 * ```tsx
 * function SignOutButton() {
 *   const { signOut, isLoading } = useSignOut()
 *
 *   return (
 *     <button onClick={signOut} disabled={isLoading}>
 *       {isLoading ? 'Signing out...' : 'Sign Out'}
 *     </button>
 *   )
 * }
 * ```
 */
export function useSignOut(): UseSignOutResult {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const signOut = async () => {
    try {
      setIsLoading(true);
      setError(null);

      const csrfToken = readCsrfToken();
      const response = await fetch('/api/auth/sign-out', {
        method: 'POST',
        credentials: 'include',
        // Conditional headers key keeps cookie-less sign-out requests
        // byte-identical to the pre-CSRF request shape.
        ...(csrfToken ? { headers: { 'X-CSRF-Token': csrfToken } } : {}),
      });

      if (!response.ok) {
        throw new Error('Failed to sign out');
      }

      // Clear session on client side
      window.location.href = '/login';
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      setError(error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  return {
    signOut,
    isLoading,
    error,
  };
}
