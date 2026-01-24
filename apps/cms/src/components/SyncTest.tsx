'use client'

import { useConversations } from '@revealui/sync'
import { useSession } from '@revealui/auth/client'

export function SyncTest() {
  const { user } = useSession()
  const { conversations, isLoading, error } = useConversations(user?.id || '')

  if (isLoading) return <div>Loading conversations...</div>
  if (error) return <div>Error: {error.message}</div>

  return (
    <div>
      <h2>Conversations ({conversations.length})</h2>
      {conversations.map((conv: any) => (
        <div key={conv.id}>{conv.title || 'Untitled'}</div>
      ))}
    </div>
  )
}
