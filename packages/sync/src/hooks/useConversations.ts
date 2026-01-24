'use client'

import { useShape } from '@electric-sql/react'

type ConversationRecord = {
  id: string | number
  title?: string | null
}

export function useConversations(userId: string) {
  const { data, isLoading, error } = useShape({
    url: `/api/shapes/conversations`,
    params: {
      table: 'conversations',
      where: `user_id = '${userId}'`,
    },
  })

  return {
    conversations: Array.isArray(data) ? (data as ConversationRecord[]) : [],
    isLoading,
    error: error as Error | null,
  }
}
