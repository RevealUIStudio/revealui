import { useCallback, useEffect, useState } from 'react'
import { listApps, startApp, stopApp } from '../lib/invoke'
import type { AppStatus } from '../types'

/** Poll listApps until the named app matches the expected running state, or timeout. */
async function pollUntil(
  name: string,
  expectedRunning: boolean,
  setApps: (apps: AppStatus[]) => void,
  intervalMs: number,
  maxMs: number,
): Promise<void> {
  const deadline = Date.now() + maxMs
  while (Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, intervalMs))
    const result = await listApps()
    setApps(result)
    const app = result.find((a) => a.app.name === name)
    if (app?.running === expectedRunning) return
  }
}

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

  const start = useCallback(async (name: string) => {
    setOperating((p) => ({ ...p, [name]: true }))
    setError(null)
    try {
      await startApp(name)
      await pollUntil(name, true, setApps, 1000, 10_000)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setOperating((p) => ({ ...p, [name]: false }))
    }
  }, [])

  const stop = useCallback(async (name: string) => {
    setOperating((p) => ({ ...p, [name]: true }))
    setError(null)
    try {
      await stopApp(name)
      await pollUntil(name, false, setApps, 500, 5_000)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setOperating((p) => ({ ...p, [name]: false }))
    }
  }, [])

  return { apps, loading, error, operating, refresh, start, stop }
}
