import { useCallback, useEffect, useState } from 'react'
import {
  vaultCopy,
  vaultDelete,
  vaultGet,
  vaultInit,
  vaultIsInitialized,
  vaultSearch,
  vaultSet,
} from '../../lib/invoke'
import type { SecretInfo } from '../../types'

export default function VaultPanel() {
  const [initialized, setInitialized] = useState<boolean | null>(null)
  const [secrets, setSecrets] = useState<SecretInfo[]>([])
  const [query, setQuery] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [newPath, setNewPath] = useState('')
  const [newValue, setNewValue] = useState('')
  const [saving, setSaving] = useState(false)

  const refresh = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const results = await vaultSearch(query)
      setSecrets(results)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setLoading(false)
    }
  }, [query])

  useEffect(() => {
    vaultIsInitialized()
      .then(setInitialized)
      .catch(() => setInitialized(false))
  }, [])

  useEffect(() => {
    if (initialized) refresh()
  }, [initialized, refresh])

  const handleInit = async () => {
    setLoading(true)
    setError(null)
    try {
      await vaultInit()
      setInitialized(true)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setLoading(false)
    }
  }

  const handleSave = async () => {
    if (!(newPath && newValue)) return
    setSaving(true)
    setError(null)
    try {
      await vaultSet(newPath, newValue, false)
      setNewPath('')
      setNewValue('')
      await refresh()
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (path: string) => {
    setError(null)
    try {
      await vaultDelete(path)
      await refresh()
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    }
  }

  const handleCopy = async (path: string) => {
    setError(null)
    try {
      const value = await vaultGet(path)
      await vaultCopy(value)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    }
  }

  if (initialized === null) {
    return <div className="animate-pulse h-8 w-48 rounded bg-neutral-800" />
  }

  if (!initialized) {
    return (
      <div className="flex flex-col items-start gap-4">
        <p className="text-sm text-neutral-400">
          The vault has not been initialised yet. Click below to create it.
        </p>
        {error && <p className="text-sm text-red-400">{error}</p>}
        <button
          type="button"
          onClick={handleInit}
          disabled={loading}
          className="rounded-md bg-orange-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-orange-500 disabled:opacity-50"
        >
          {loading ? 'Initialising…' : 'Initialise Vault'}
        </button>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Vault</h1>
        <button
          type="button"
          onClick={refresh}
          disabled={loading}
          className="rounded-md bg-neutral-800 px-3 py-1.5 text-sm text-neutral-300 transition-colors hover:bg-neutral-700 disabled:opacity-50"
        >
          {loading ? 'Refreshing…' : 'Refresh'}
        </button>
      </div>

      {error && (
        <div className="rounded-md border border-red-900/50 bg-red-950/30 px-4 py-3 text-sm text-red-400">
          {error}
        </div>
      )}

      {/* Add secret */}
      <div className="rounded-lg border border-neutral-800 bg-neutral-900 p-4">
        <h2 className="mb-3 text-sm font-medium text-neutral-300">Add Secret</h2>
        <div className="flex gap-2">
          <input
            type="text"
            placeholder="path (e.g. personal/github)"
            value={newPath}
            onChange={(e) => setNewPath(e.target.value)}
            className="flex-1 rounded-md border border-neutral-700 bg-neutral-800 px-3 py-1.5 text-sm text-neutral-100 placeholder-neutral-500 focus:border-orange-500 focus:outline-none"
          />
          <input
            type="password"
            placeholder="value"
            value={newValue}
            onChange={(e) => setNewValue(e.target.value)}
            className="flex-1 rounded-md border border-neutral-700 bg-neutral-800 px-3 py-1.5 text-sm text-neutral-100 placeholder-neutral-500 focus:border-orange-500 focus:outline-none"
          />
          <button
            type="button"
            onClick={handleSave}
            disabled={saving || !newPath || !newValue}
            className="rounded-md bg-orange-600 px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-orange-500 disabled:opacity-50"
          >
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>

      {/* Search */}
      <input
        type="text"
        placeholder="Search secrets…"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        className="w-full rounded-md border border-neutral-700 bg-neutral-800 px-3 py-2 text-sm text-neutral-100 placeholder-neutral-500 focus:border-orange-500 focus:outline-none"
      />

      {/* Secret list */}
      <div className="space-y-1">
        {secrets.length === 0 && !loading && (
          <p className="text-sm text-neutral-500">No secrets found.</p>
        )}
        {secrets.map((s) => (
          <div
            key={s.path}
            className="flex items-center justify-between rounded-md border border-neutral-800 bg-neutral-900 px-4 py-2"
          >
            <div>
              <p className="text-sm font-mono text-neutral-200">{s.path}</p>
              {s.namespace && <p className="text-xs text-neutral-500">{s.namespace}</p>}
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => handleCopy(s.path)}
                className="rounded px-2 py-1 text-xs text-neutral-400 hover:bg-neutral-800 hover:text-neutral-200"
              >
                Copy
              </button>
              <button
                type="button"
                onClick={() => handleDelete(s.path)}
                className="rounded px-2 py-1 text-xs text-red-500 hover:bg-red-950/30 hover:text-red-400"
              >
                Delete
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
