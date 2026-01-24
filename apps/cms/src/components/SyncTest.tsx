'use client'

import { useSession } from '@revealui/auth/client'
import { useConversations } from '@revealui/sync'

export function SyncTest() {
  const { user } = useSession()
  const { conversations, isLoading, error } = useConversations(user?.id || '')

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
