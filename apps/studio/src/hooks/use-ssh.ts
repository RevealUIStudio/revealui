import { listen } from '@tauri-apps/api/event'
import { useCallback, useEffect, useRef, useState } from 'react'
import { sshConnect, sshDisconnect, sshResize, sshSend } from '../lib/invoke'
import type { SshConnectParams, SshDisconnectEvent, SshOutputEvent } from '../types'

interface SshHookState {
  sessionId: string | null
  connected: boolean
  connecting: boolean
  error: string | null
}

interface UseSshOptions {
  onData?: (data: Uint8Array) => void
  onDisconnect?: (reason: string) => void
}

export function useSsh(options: UseSshOptions = {}) {
  const [state, setState] = useState<SshHookState>({
    sessionId: null,
    connected: false,
    connecting: false,
    error: null,
  })

  const onDataRef = useRef(options.onData)
  const onDisconnectRef = useRef(options.onDisconnect)
  const unlistenOutputRef = useRef<(() => void) | null>(null)
  const unlistenDisconnectRef = useRef<(() => void) | null>(null)
  const sessionIdRef = useRef<string | null>(null)

  // Keep refs in sync
  onDataRef.current = options.onData
  onDisconnectRef.current = options.onDisconnect

  const connect = useCallback(async (params: SshConnectParams) => {
    setState((prev) => ({ ...prev, connecting: true, error: null }))
    try {
      const id = await sshConnect(params)
      sessionIdRef.current = id

      // Listen for output events
      const unlistenOut = await listen<SshOutputEvent>('ssh_output', (event) => {
        if (event.payload.session_id !== sessionIdRef.current) return
        const bytes = Uint8Array.from(atob(event.payload.data), (c) => c.charCodeAt(0))
        onDataRef.current?.(bytes)
      })
      unlistenOutputRef.current = unlistenOut

      // Listen for disconnect events
      const unlistenDc = await listen<SshDisconnectEvent>('ssh_disconnect', (event) => {
        if (event.payload.session_id !== sessionIdRef.current) return
        sessionIdRef.current = null
        unlistenOutputRef.current?.()
        unlistenDisconnectRef.current?.()
        unlistenOutputRef.current = null
        unlistenDisconnectRef.current = null
        setState({
          sessionId: null,
          connected: false,
          connecting: false,
          error: null,
        })
        onDisconnectRef.current?.(event.payload.reason)
      })
      unlistenDisconnectRef.current = unlistenDc

      setState({
        sessionId: id,
        connected: true,
        connecting: false,
        error: null,
      })
    } catch (err) {
      setState({
        sessionId: null,
        connected: false,
        connecting: false,
        error: err instanceof Error ? err.message : String(err),
      })
    }
  }, [])

  const disconnect = useCallback(async () => {
    const id = sessionIdRef.current
    if (!id) return
    try {
      await sshDisconnect(id)
    } catch {
      // Session may already be closed server-side
    }
    sessionIdRef.current = null
    unlistenOutputRef.current?.()
    unlistenDisconnectRef.current?.()
    unlistenOutputRef.current = null
    unlistenDisconnectRef.current = null
    setState({
      sessionId: null,
      connected: false,
      connecting: false,
      error: null,
    })
  }, [])

  const send = useCallback(async (data: string) => {
    const id = sessionIdRef.current
    if (!id) return
    // base64 encode
    const encoded = btoa(data)
    await sshSend(id, encoded)
  }, [])

  const resize = useCallback(async (cols: number, rows: number) => {
    const id = sessionIdRef.current
    if (!id) return
    await sshResize(id, cols, rows)
  }, [])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      const id = sessionIdRef.current
      if (id) {
        sshDisconnect(id).catch(() => {
          // Best-effort cleanup on unmount — nothing to handle
        })
      }
      unlistenOutputRef.current?.()
      unlistenDisconnectRef.current?.()
    }
  }, [])

  return { ...state, connect, disconnect, send, resize }
}
