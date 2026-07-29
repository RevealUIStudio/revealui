/**
 * useSignIn Hook
 *
 * React hook for signing in a user.
 */

'use client';

import { useCallback, useRef, useState } from 'react';
import { z } from 'zod/v4';
import type { User } from '../types.js';

// Zod validates the required fields; .passthrough() preserves the rest.
// The API returns JSON-serialized User objects (Dates as ISO strings).
// z.infer output has an index signature incompatible with the concrete User
// interface, so we extract the validated user via the helper below.
const SignInUserSchema = z
  .object({
    id: z.string(),
    email: z.string(),
    name: z.string().nullable().optional(),
  })
  .passthrough();

/**
 * Narrow Zod-validated API response data to User.
 *
 * The cast is safe because: (1) Zod verified the required fields (id, email),
 * (2) .passthrough() preserves all other properties from the API response,
 * and (3) the API serializes a full User row (Dates become ISO strings in JSON).
 */
function toUser(validated: z.infer<typeof SignInUserSchema>): User {
  return validated as unknown as User;
}

// Validation schemas for sign-in response. The error body carries both a
// human-readable `message` and a machine `code` (see createApplicationErrorResponseData
// in @revealui/core); `error` mirrors the code. All optional so a terse body
// still parses.
const SignInErrorResponseSchema = z.object({
  error: z.string().optional(),
  message: z.string().optional(),
  code: z.string().optional(),
});

const SignInSuccessResponseSchema = z.object({
  user: SignInUserSchema,
});

export interface SignInInput {
  email: string;
  password: string;
}

export interface UseSignInResult {
  signIn: (input: SignInInput) => Promise<
    | { success: true; user: User }
    | { success: false; error: string; code?: string }
    // mfaUserId is optional: the live sign-in route puts identity in the
    // httpOnly mfa-pending cookie and may only return { requiresMfa: true }.
    | { success: false; requiresMfa: true; mfaUserId?: string }
  >;
  isLoading: boolean;
  error: Error | null;
}

/**
 * Hook to sign in a user
 *
 * @returns Sign in function, loading state, and error
 *
 * @example
 * ```tsx
 * function SignInForm() {
 *   const { signIn, isLoading } = useSignIn()
 *
 *   const handleSubmit = async (e: FormEvent) => {
 *     e.preventDefault()
 *     const result = await signIn({ email, password })
 *     if (result.success) {
 *       // Full navigation: a soft router.push() would replay the pre-auth Router Cache
 *       window.location.href = '/dashboard'
 *     }
 *   }
 * }
 * ```
 */
export function useSignIn(): UseSignInResult {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  const signIn = useCallback(async (input: SignInInput) => {
    // Abort any in-flight request
    abortControllerRef.current?.abort();
    const controller = new AbortController();
    abortControllerRef.current = controller;

    try {
      setIsLoading(true);
      setError(null);

      const response = await fetch('/api/auth/sign-in', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify(input),
        signal: controller.signal,
      });

      const json: unknown = await response.json();

      if (!response.ok) {
        const errorData = SignInErrorResponseSchema.parse(json);
        // Prefer the human-readable `message` for display; fall back to the
        // machine `error` code, then a generic default. `code` (e.g.
        // 'EMAIL_NOT_VERIFIED') lets callers branch — e.g. offer a
        // resend-verification action — without string-matching display copy.
        return {
          success: false as const,
          error: errorData.message || errorData.error || 'Failed to sign in',
          code: errorData.code,
        };
      }

      // MFA challenge is HTTP 200 with { requiresMfa: true } and no `user`.
      // The server may omit mfaUserId from the body (identity lives in the
      // httpOnly mfa-pending cookie). Requiring mfaUserId here forced the
      // success schema parse, which threw "expected object, received undefined"
      // on `user` and locked MFA-enabled accounts out of the login UI.
      const jsonObj = json as Record<string, unknown>;
      if (jsonObj.requiresMfa === true) {
        return {
          success: false as const,
          requiresMfa: true as const,
          ...(typeof jsonObj.mfaUserId === 'string' ? { mfaUserId: jsonObj.mfaUserId } : {}),
        };
      }

      const successData = SignInSuccessResponseSchema.parse(json);
      return {
        success: true as const,
        user: toUser(successData.user),
      };
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') {
        return { success: false as const, error: 'Request was cancelled' };
      }
      const error = err instanceof Error ? err : new Error(String(err));
      setError(error);
      return {
        success: false as const,
        error: error.message,
      };
    } finally {
      setIsLoading(false);
    }
  }, []);

  return {
    signIn,
    isLoading,
    error,
  };
}
