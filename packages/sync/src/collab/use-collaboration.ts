import { useEffect, useRef, useState } from 'react'
import * as Y from 'yjs'
import { CollabProvider } from './yjs-websocket-provider.js'

export interface UseCollaborationOptions {
  documentId: string
  serverUrl: string
  enabled?: boolean
  initialState?: Uint8Array | null
}

export interface UseCollaborationResult {
  doc: Y.Doc | null
  provider: CollabProvider | null
  synced: boolean
  status: string
  error: Error | null
}

export function useCollaboration({
  documentId,
  serverUrl,
  enabled = true,
  initialState = null,
}: UseCollaborationOptions): UseCollaborationResult {
  const [synced, setSynced] = useState(false)
  const [status, setStatus] = useState('disconnected')
  const [error, setError] = useState<Error | null>(null)
  const docRef = useRef<Y.Doc | null>(null)
  const providerRef = useRef<CollabProvider | null>(null)

  useEffect(() => {
    if (!(enabled && documentId)) return

    const doc = new Y.Doc()
    docRef.current = doc

    try {
      const provider = new CollabProvider(serverUrl, documentId, doc, { initialState })
      providerRef.current = provider

      provider.on('sync', (isSynced: unknown) => {
        setSynced(isSynced as boolean)
      })

      provider.on('status', (event: unknown) => {
        const statusEvent = event as { status: string }
        setStatus(statusEvent.status)
      })

      provider.connect()
    } catch (err) {
      setError(err instanceof Error ? err : new Error(String(err)))
    }

    return () => {
      if (providerRef.current) {
        providerRef.current.destroy()
        providerRef.current = null
      }
      if (docRef.current) {
        docRef.current.destroy()
        docRef.current = null
      }
      setSynced(false)
      setStatus('disconnected')
    }
  }, [documentId, serverUrl, enabled, initialState])

  return {
    doc: docRef.current,
    provider: providerRef.current,
    synced,
    status,
    error,
  }
}
