'use client'

import type { AnyBinding, Provider, SyncCursorPositionsFn } from '@lexical/yjs'
import { syncCursorPositions } from '@lexical/yjs'
import { useEffect, useRef } from 'react'

const INACTIVE_TIMEOUT_MS = 30_000
const FADE_CHECK_INTERVAL_MS = 5_000

export function createCustomSyncCursorPositions(
  lastActivityRef: React.RefObject<Map<number, number>>,
): SyncCursorPositionsFn {
  return (binding: AnyBinding, provider: Provider) => {
    syncCursorPositions(binding, provider)

    const awareness = provider.awareness
    const states = awareness.getStates()
    const now = Date.now()

    for (const [clientId, state] of states) {
      if (clientId === awareness.clientID) continue

      if (state?.focusing) {
        lastActivityRef.current.set(clientId, now)
      }

      if (!lastActivityRef.current.has(clientId)) {
        lastActivityRef.current.set(clientId, now)
      }
    }

    for (const clientId of lastActivityRef.current.keys()) {
      if (!states.has(clientId)) {
        lastActivityRef.current.delete(clientId)
      }
    }
  }
}

export function useCursorActivityTracking(
  cursorsContainerRef: React.RefObject<HTMLElement | null>,
): React.RefObject<Map<number, number>> {
  const lastActivityRef = useRef<Map<number, number>>(new Map())

  useEffect(() => {
    const interval = setInterval(() => {
      const container = cursorsContainerRef.current
      if (!container) return

      const now = Date.now()
      const carets = container.querySelectorAll<HTMLElement>('[style*="position"]')

      for (const caret of carets) {
        const isInactive = Array.from(lastActivityRef.current.values()).some(
          (lastActive) => now - lastActive > INACTIVE_TIMEOUT_MS,
        )

        if (isInactive) {
          caret.style.opacity = '0.2'
          caret.style.transition = 'opacity 1s ease-out'
        }
      }
    }, FADE_CHECK_INTERVAL_MS)

    return () => clearInterval(interval)
  }, [cursorsContainerRef])

  return lastActivityRef
}
