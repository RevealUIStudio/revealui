import { useCallback, useEffect, useRef, useState } from 'react'
import { getTailscaleStatus, tailscaleDown, tailscaleUp } from '../lib/invoke'
import type { TailscaleStatus } from '../types'

interface TunnelState {
  status: TailscaleStatus | null
  loading: boolean
  error: string | null
  toggling: boolean
}

const POLL_INTERVAL_MS = 10_000

export function useTunnel() {
  const [state, setState] = useState<TunnelState>({
    status: null,
    loading: true,
    error: null,
    toggling: false,
  })

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const fetchStatus = useCallback(async () => {
    try {
      const status = await getTailscaleStatus()
      setState((prev) => ({ ...prev, status, loading: false, error: null }))
    } catch (err) {
      setState((prev) => ({
        ...prev,
        loading: false,
        status: null,
        error: err instanceof Error ? err.message : String(err),
      }))
    }
  }, [])

  useEffect(() => {
    fetchStatus()
    intervalRef.current = setInterval(fetchStatus, POLL_INTERVAL_MS)
    return () => {
      if (intervalRef.current !== null) {
        clearInterval(intervalRef.current)
      }
    }
  }, [fetchStatus])

  const up = useCallback(async () => {
    setState((prev) => ({ ...prev, toggling: true, error: null }))
    try {
      await tailscaleUp()
      await fetchStatus()
    } catch (err) {
      setState((prev) => ({
        ...prev,
        error: err instanceof Error ? err.message : String(err),
      }))
    } finally {
      setState((prev) => ({ ...prev, toggling: false }))
    }
  }, [fetchStatus])

  const down = useCallback(async () => {
    setState((prev) => ({ ...prev, toggling: true, error: null }))
    try {
      await tailscaleDown()
      await fetchStatus()
    } catch (err) {
      setState((prev) => ({
        ...prev,
        error: err instanceof Error ? err.message : String(err),
      }))
    } finally {
      setState((prev) => ({ ...prev, toggling: false }))
    }
  }, [fetchStatus])

  return { ...state, up, down, refresh: fetchStatus }
}
