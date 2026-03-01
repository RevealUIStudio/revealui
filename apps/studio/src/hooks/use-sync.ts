import { useCallback, useState } from 'react'
import { syncAllRepos, syncRepo } from '../lib/invoke'
import type { SyncResult } from '../types'

interface SyncState {
  syncing: boolean
  results: SyncResult[]
  log: string[]
  error: string | null
}

export function useSync() {
  const [state, setState] = useState<SyncState>({
    syncing: false,
    results: [],
    log: [],
    error: null,
  })

  const appendLog = useCallback(
    (msg: string) => setState((prev) => ({ ...prev, log: [...prev.log, msg] })),
    [],
  )

  const syncAll = useCallback(async () => {
    setState({ syncing: true, results: [], log: [], error: null })
    appendLog('Starting full repo sync...')
    try {
      const results = await syncAllRepos()
      appendLog(
        `Sync complete: ${results.filter((r) => r.status === 'ok').length}/${results.length} OK`,
      )
      setState((prev) => ({ ...prev, syncing: false, results }))
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      appendLog(`Error: ${msg}`)
      setState((prev) => ({ ...prev, syncing: false, error: msg }))
    }
  }, [appendLog])

  const syncOne = useCallback(
    async (name: string) => {
      setState((prev) => ({
        ...prev,
        syncing: true,
        log: [],
        error: null,
      }))
      appendLog(`Syncing ${name}...`)
      try {
        const result = await syncRepo(name)
        appendLog(`${name}: ${result.status}`)
        setState((prev) => ({
          ...prev,
          syncing: false,
          results: prev.results.map((r) =>
            r.repo === name && r.drive === result.drive ? result : r,
          ),
        }))
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        appendLog(`Error: ${msg}`)
        setState((prev) => ({ ...prev, syncing: false, error: msg }))
      }
    },
    [appendLog],
  )

  return { ...state, syncAll, syncOne }
}
