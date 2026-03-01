import { useCallback, useEffect, useState } from 'react'
import { checkSetup, mountDevbox, setGitIdentity } from '../lib/invoke'
import type { SetupStatus } from '../types'

const SETUP_KEY = 'studio:setup-complete'

export function isSetupComplete(): boolean {
  return localStorage.getItem(SETUP_KEY) === 'true'
}

export function markSetupComplete(): void {
  localStorage.setItem(SETUP_KEY, 'true')
}

interface SetupState {
  status: SetupStatus | null
  loading: boolean
  error: string | null
  gitName: string
  gitEmail: string
  saving: boolean
  mounting: boolean
}

export function useSetup() {
  const [state, setState] = useState<SetupState>({
    status: null,
    loading: true,
    error: null,
    gitName: '',
    gitEmail: '',
    saving: false,
    mounting: false,
  })

  const refresh = useCallback(async () => {
    setState((prev) => ({ ...prev, loading: true, error: null }))
    try {
      const status = await checkSetup()
      setState((prev) => ({
        ...prev,
        status,
        loading: false,
        gitName: prev.gitName || status.git_name,
        gitEmail: prev.gitEmail || status.git_email,
      }))
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
  }, [refresh])

  const saveGitIdentity = useCallback(async () => {
    setState((prev) => ({ ...prev, saving: true, error: null }))
    try {
      await setGitIdentity(state.gitName.trim(), state.gitEmail.trim())
      await refresh()
    } catch (err) {
      setState((prev) => ({
        ...prev,
        error: err instanceof Error ? err.message : String(err),
      }))
    } finally {
      setState((prev) => ({ ...prev, saving: false }))
    }
  }, [state.gitName, state.gitEmail, refresh])

  const doMount = useCallback(async () => {
    setState((prev) => ({ ...prev, mounting: true, error: null }))
    try {
      await mountDevbox()
      await refresh()
    } catch (err) {
      setState((prev) => ({
        ...prev,
        error: err instanceof Error ? err.message : String(err),
      }))
    } finally {
      setState((prev) => ({ ...prev, mounting: false }))
    }
  }, [refresh])

  const setGitName = useCallback((v: string) => {
    setState((prev) => ({ ...prev, gitName: v }))
  }, [])

  const setGitEmail = useCallback((v: string) => {
    setState((prev) => ({ ...prev, gitEmail: v }))
  }, [])

  return { ...state, refresh, saveGitIdentity, doMount, setGitName, setGitEmail }
}
