'use client'

import { useSession } from '@revealui/auth/react'
import { useConversations } from '@revealui/sync'

export function SyncTest() {
  const { data: session } = useSession()
  const { conversations, isLoading, error } = useConversations(session?.user?.id || '')

  if (isLoading) return <div>Loading conversations...</div>
  if (error) return <div>Error: {error.message}</div>

  return (
    <div>
      <h2>Conversations ({conversations.length})</h2>
      {conversations.map((conv) => (
        <div key={conv.id}>{conv.title || 'Untitled'}</div>
      ))}
    </div>
  )
}
