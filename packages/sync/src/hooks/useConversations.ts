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
      // Use positional parameter ($1) instead of string interpolation
      // to prevent SQL injection via ElectricSQL's parameter binding
      where: 'user_id = $1',
      'params[1]': userId,
    },
  })

  return {
    conversations: Array.isArray(data) ? (data as ConversationRecord[]) : [],
    isLoading,
    error: error as Error | null,
  }
}
