/**
 * useSignOut Hook
 *
 * React hook for signing out a user.
 */

'use client'

import { useState } from 'react'

export interface UseSignOutResult {
  signOut: () => Promise<void>
  isLoading: boolean
  error: Error | null
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
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<Error | null>(null)

  const signOut = async () => {
    try {
      setIsLoading(true)
      setError(null)

      const response = await fetch('/api/auth/sign-out', {
        method: 'POST',
        credentials: 'include',
      })

      if (!response.ok) {
        throw new Error('Failed to sign out')
      }

      // Clear session on client side
      window.location.href = '/login'
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err))
      setError(error)
      throw error
    } finally {
      setIsLoading(false)
    }
  }

  return {
    signOut,
    isLoading,
    error,
  }
}
