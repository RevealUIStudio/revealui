/**
 * useSession Hook
 *
 * React hook for accessing the current session.
 * Inspired by Better Auth and TanStack Start patterns.
 */

'use client'

import { useEffect, useState } from 'react'
import type { AuthSession } from '../types'

export interface UseSessionResult {
  data: AuthSession | null
  isLoading: boolean
  error: Error | null
  refetch: () => Promise<void>
}

/**
 * Hook to get the current session
 *
 * @returns Session data, loading state, error, and refetch function
 *
 * @example
 * ```tsx
 * function MyComponent() {
 *   const { data: session, isLoading } = useSession()
 *
 *   if (isLoading) return <div>Loading...</div>
 *   if (!session) return <div>Not signed in</div>
 *
 *   return <div>Hello, {session.user.name}</div>
 * }
 * ```
 */
export function useSession(): UseSessionResult {
  const [data, setData] = useState<AuthSession | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)

  const fetchSession = async () => {
    try {
      setIsLoading(true)
      setError(null)

      const response = await fetch('/api/auth/session', {
        credentials: 'include',
      })

      if (!response.ok) {
        if (response.status === 401) {
          setData(null)
          return
        }
        throw new Error(`Failed to fetch session: ${response.statusText}`)
      }

      const session = await response.json()
      setData(session)
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err))
      setError(error)
      setData(null)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    fetchSession()
  }, [])

  return {
    data,
    isLoading,
    error,
    refetch: fetchSession,
  }
}
