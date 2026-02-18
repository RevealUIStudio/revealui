import { useShape } from '@electric-sql/react'

interface YjsDocumentRecord {
  id: string
  state: string | null
  // biome-ignore lint/style/useNamingConvention: Postgres column names use snake_case
  state_vector: string | null
  // biome-ignore lint/style/useNamingConvention: Postgres column names use snake_case
  connected_clients: number
  // biome-ignore lint/style/useNamingConvention: Postgres column names use snake_case
  created_at: string
  // biome-ignore lint/style/useNamingConvention: Postgres column names use snake_case
  updated_at: string
}

export interface CollabDocumentState {
  initialState: Uint8Array | null
  connectedClients: number
  isLoading: boolean
  error: Error | null
}

export function useCollabDocument(documentId: string, electricUrl: string): CollabDocumentState {
  const { data, isLoading, error } = useShape<YjsDocumentRecord>({
    url: `${electricUrl}/v1/shape`,
    params: {
      table: 'yjs_documents',
      where: `id = '${documentId}'`,
    },
  })

  let initialState: Uint8Array | null = null
  let connectedClients = 0

  if (data && data.length > 0) {
    const row = data[0] as unknown as YjsDocumentRecord
    if (row.state) {
      const binary = atob(row.state)
      const bytes = new Uint8Array(binary.length)
      for (let i = 0; i < binary.length; i++) {
        bytes[i] = binary.charCodeAt(i)
      }
      initialState = bytes
    }
    connectedClients = row.connected_clients ?? 0
  }

  return {
    initialState,
    connectedClients,
    isLoading,
    error: error ? new Error(String(error)) : null,
  }
}
