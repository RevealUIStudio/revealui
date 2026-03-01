import { useCallback, useEffect, useState } from 'react'
import { listApps, startApp, stopApp } from '../lib/invoke'
import type { AppStatus } from '../types'

export function useApps() {
  const [apps, setApps] = useState<AppStatus[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [operating, setOperating] = useState<Record<string, boolean>>({})

  const refresh = useCallback(async () => {
    try {
      const result = await listApps()
      setApps(result)
      setLoading(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    refresh()
    const id = setInterval(refresh, 5_000)
    return () => clearInterval(id)
  }, [refresh])

  const start = useCallback(
    async (name: string) => {
      setOperating((p) => ({ ...p, [name]: true }))
      setError(null)
      try {
        await startApp(name)
        // Give the process a few seconds to bind its port before polling
        setTimeout(() => {
          refresh()
        }, 3000)
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err))
      } finally {
        setOperating((p) => ({ ...p, [name]: false }))
      }
    },
    [refresh],
  )

  const stop = useCallback(
    async (name: string) => {
      setOperating((p) => ({ ...p, [name]: true }))
      setError(null)
      try {
        await stopApp(name)
        setTimeout(() => {
          refresh()
        }, 1000)
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err))
      } finally {
        setOperating((p) => ({ ...p, [name]: false }))
      }
    },
    [refresh],
  )

  return { apps, loading, error, operating, refresh, start, stop }
}
