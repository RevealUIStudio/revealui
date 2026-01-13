/**
 * useSignIn Hook
 *
 * React hook for signing in a user.
 */

'use client'

import { useState } from 'react'
import type { User } from '../types'

export interface SignInInput {
  email: string
  password: string
}

export interface UseSignInResult {
  signIn: (input: SignInInput) => Promise<{ success: boolean; user?: User; error?: string }>
  isLoading: boolean
  error: Error | null
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
 *       router.push('/dashboard')
 *     }
 *   }
 * }
 * ```
 */
export function useSignIn(): UseSignInResult {
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<Error | null>(null)

  const signIn = async (input: SignInInput) => {
    try {
      setIsLoading(true)
      setError(null)

      const response = await fetch('/api/auth/sign-in', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify(input),
      })

      const data = await response.json()

      if (!response.ok) {
        return {
          success: false,
          error: data.error || 'Failed to sign in',
        }
      }

      return {
        success: true,
        user: data.user,
      }
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err))
      setError(error)
      return {
        success: false,
        error: error.message,
      }
    } finally {
      setIsLoading(false)
    }
  }

  return {
    signIn,
    isLoading,
    error,
  }
}
