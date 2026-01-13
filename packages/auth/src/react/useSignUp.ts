/**
 * useSignUp Hook
 *
 * React hook for signing up a new user.
 */

'use client'

import { useState } from 'react'
import type { User } from '../types'

export interface SignUpInput {
  email: string
  password: string
  name: string
}

export interface UseSignUpResult {
  signUp: (input: SignUpInput) => Promise<{ success: boolean; user?: User; error?: string }>
  isLoading: boolean
  error: Error | null
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
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<Error | null>(null)

  const signUp = async (input: SignUpInput) => {
    try {
      setIsLoading(true)
      setError(null)

      const response = await fetch('/api/auth/sign-up', {
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
          error: data.error || 'Failed to sign up',
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
    signUp,
    isLoading,
    error,
  }
}
