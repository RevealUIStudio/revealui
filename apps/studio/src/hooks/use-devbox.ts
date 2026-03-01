import { useCallback, useState } from 'react'
import { mountDevbox, unmountDevbox } from '../lib/invoke'

interface DevBoxState {
  operating: boolean
  log: string[]
  error: string | null
}

export function useDevBox() {
  const [state, setState] = useState<DevBoxState>({
    operating: false,
    log: [],
    error: null,
  })

  const appendLog = useCallback(
    (msg: string) => setState((prev) => ({ ...prev, log: [...prev.log, msg] })),
    [],
  )

  const mount = useCallback(async () => {
    setState({ operating: true, log: [], error: null })
    appendLog('Mounting Studio drive...')
    try {
      const result = await mountDevbox()
      appendLog(result)
      setState((prev) => ({ ...prev, operating: false }))
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      appendLog(`Error: ${msg}`)
      setState((prev) => ({ ...prev, operating: false, error: msg }))
    }
  }, [appendLog])

  const unmount = useCallback(async () => {
    setState({ operating: true, log: [], error: null })
    appendLog('Unmounting Studio drive...')
    try {
      const result = await unmountDevbox()
      appendLog(result)
      setState((prev) => ({ ...prev, operating: false }))
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      appendLog(`Error: ${msg}`)
      setState((prev) => ({ ...prev, operating: false, error: msg }))
    }
  }, [appendLog])

  return { ...state, mount, unmount }
}
