import { useShape } from '@electric-sql/react'

export interface CollabDocumentState {
  initialState: Uint8Array | null
  connectedClients: number
  isLoading: boolean
  error: Error | null
}

export function useCollabDocument(documentId: string, electricUrl: string): CollabDocumentState {
  const { data, isLoading, error } = useShape({
    url: `${electricUrl}/v1/shape`,
    params: {
      table: 'yjs_documents',
      where: `id = '${documentId}'`,
    },
  })

  let initialState: Uint8Array | null = null
  let connectedClients = 0

  if (data && data.length > 0) {
    const row = data[0] as Record<string, unknown>
    const state = row.state as string | null
    if (state) {
      const binary = atob(state)
      const bytes = new Uint8Array(binary.length)
      for (let i = 0; i < binary.length; i++) {
        bytes[i] = binary.charCodeAt(i)
      }
      initialState = bytes
    }
    connectedClients = (row.connected_clients as number) ?? 0
  }

  return {
    initialState,
    connectedClients,
    isLoading,
    error: error ? new Error(String(error)) : null,
  }
}
