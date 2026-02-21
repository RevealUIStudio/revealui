'use client'

import { useShape } from '@electric-sql/react'

type ConversationRecord = {
  id: string | number
  title?: string | null
}

// _userId kept for API compatibility — filtering is enforced by the server-side
// proxy at /api/shapes/conversations, which reads the session cookie directly.
export function useConversations(_userId: string) {
  // The proxy validates the session and enforces row-level filtering server-side.
  // Client-provided params are not forwarded — the proxy overrides them.
  const { data, isLoading, error } = useShape({
    url: `/api/shapes/conversations`,
  })

  return {
    conversations: Array.isArray(data) ? (data as ConversationRecord[]) : [],
    isLoading,
    error: error as Error | null,
  }
}
