import { useCallback, useEffect, useState } from 'react'
import { getMountStatus, getSystemStatus } from '../lib/invoke'
import type { MountStatus, SystemStatus } from '../types'

interface StatusState {
  system: SystemStatus | null
  mount: MountStatus | null
  loading: boolean
  error: string | null
}

export function useStatus() {
  const [state, setState] = useState<StatusState>({
    system: null,
    mount: null,
    loading: true,
    error: null,
  })

  const refresh = useCallback(async () => {
    setState((prev) => ({ ...prev, loading: true, error: null }))
    try {
      const [system, mount] = await Promise.all([getSystemStatus(), getMountStatus()])
      setState({ system, mount, loading: false, error: null })
    } catch (err) {
      setState((prev) => ({
        ...prev,
        loading: false,
        error: err instanceof Error ? err.message : String(err),
      }))
    }
  }, [])

  useEffect(() => {
    refresh()
    const interval = setInterval(refresh, 30_000)
    return () => clearInterval(interval)
  }, [refresh])

  return { ...state, refresh }
}
