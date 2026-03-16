/**
 * useSignUp Hook
 *
 * React hook for signing up a new user.
 */

'use client';

import { useState } from 'react';
import { z } from 'zod/v4';
import type { User } from '../types.js';

// Zod validates the required fields; .passthrough() preserves the rest.
// The API returns JSON-serialized User objects (Dates as ISO strings).
// z.infer output has an index signature incompatible with the concrete User
// interface, so we extract the validated user via the helper below.
const SignUpUserSchema = z
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
function toUser(validated: z.infer<typeof SignUpUserSchema>): User {
  return validated as unknown as User;
}

// Validation schemas for sign-up response
const SignUpErrorResponseSchema = z.object({
  error: z.string().optional(),
});

const SignUpSuccessResponseSchema = z.object({
  user: SignUpUserSchema,
});

export interface SignUpInput {
  email: string;
  password: string;
  name: string;
  tosAccepted: true;
}

export interface UseSignUpResult {
  signUp: (input: SignUpInput) => Promise<{ success: boolean; user?: User; error?: string }>;
  isLoading: boolean;
  error: Error | null;
}

/**
 * Hook to sign up a new user
 *
 * @returns Sign up function, loading state, and error
 *
 * @example
 * ```tsx
 * function SignUpForm() {
 *   const { signUp, isLoading } = useSignUp()
 *
 *   const handleSubmit = async (e: FormEvent) => {
 *     e.preventDefault()
 *     const result = await signUp({ email, password, name })
 *     if (result.success) {
 *       router.push('/dashboard')
 *     }
 *   }
 * }
 * ```
 */
export function useSignUp(): UseSignUpResult {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const signUp = async (input: SignUpInput) => {
    try {
      setIsLoading(true);
      setError(null);

      const response = await fetch('/api/auth/sign-up', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify(input),
      });

      const json: unknown = await response.json();

      if (!response.ok) {
        const errorData = SignUpErrorResponseSchema.parse(json);
        return {
          success: false,
          error: errorData.error || 'Failed to sign up',
        };
      }

      const successData = SignUpSuccessResponseSchema.parse(json);
      return {
        success: true,
        // Type assertion through unknown is safe because Zod validation ensures the shape is correct
        // The API returns serialized data, so we cast to expected type
        user: toUser(successData.user),
      };
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      setError(error);
      return {
        success: false,
        error: error.message,
      };
    } finally {
      setIsLoading(false);
    }
  };

  return {
    signUp,
    isLoading,
    error,
  };
}
