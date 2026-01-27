/**
 * useSession Hook
 *
 * React hook for accessing the current session.
 * Inspired by Better Auth and TanStack Start patterns.
 */

'use client'

import { useCallback, useEffect, useState } from 'react'
import { z } from 'zod/v4'
import type { AuthSession } from '../types'

// Validation schema for session response - uses passthrough to allow all User properties
const AuthSessionSchema = z.object({
  session: z
    .object({
      id: z.string(),
      userId: z.string(),
      tokenHash: z.string(),
      expiresAt: z.string(),
      createdAt: z.string(),
    })
    .passthrough(),
  user: z
    .object({
      id: z.string(),
      email: z.string(),
      name: z.string().nullable().optional(),
    })
    .passthrough(), // Allow all other User properties
})

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

  const fetchSession = useCallback(async () => {
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

      const json: unknown = await response.json()
      const validated = AuthSessionSchema.parse(json)
      // Type assertion through unknown is safe because Zod validation ensures the shape is correct
      // The API returns serialized data (Dates as strings), so we cast to expected type
      setData(validated as unknown as AuthSession)
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err))
      setError(error)
      setData(null)
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    void fetchSession()
  }, [fetchSession])

  return {
    data,
    isLoading,
    error,
    refetch: fetchSession,
  }
}
