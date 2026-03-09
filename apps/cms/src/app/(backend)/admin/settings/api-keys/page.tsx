'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { LicenseGate } from '@/lib/components/LicenseGate'

type Provider = 'anthropic' | 'groq'

interface ProviderInfo {
  id: Provider
  label: string
  placeholder: string
  docsUrl: string
}

const PROVIDERS: ProviderInfo[] = [
  {
    id: 'anthropic',
    label: 'Anthropic',
    placeholder: 'sk-ant-...',
    docsUrl: 'https://console.anthropic.com/settings/keys',
  },
  {
    id: 'groq',
    label: 'GROQ',
    placeholder: 'gsk_...',
    docsUrl: 'https://console.groq.com/keys',
  },
]

export default function ApiKeysPage() {
  const [provider, setProvider] = useState<Provider>('anthropic')
  const [apiKey, setApiKey] = useState('')
  const [showKey, setShowKey] = useState(false)
  const [saved, setSaved] = useState(false)
  const [currentProvider, setCurrentProvider] = useState<string | null>(null)
  const [currentKeyHint, setCurrentKeyHint] = useState<string | null>(null)

  // Load existing key metadata from server on mount
  useEffect(() => {
    fetch('/api/user/api-keys')
      .then((r) => (r.ok ? r.json() : null))
      .then((data: { provider: string; keyHint: string | null } | null) => {
        if (data) {
          setCurrentProvider(data.provider as Provider)
          setCurrentKeyHint(data.keyHint)
        }
      })
      .catch(() => {
        // Swallow fetch errors — API key metadata is non-critical
      })
  }, [])

  async function handleSave() {
    if (!apiKey.trim()) return
    const res = await fetch('/api/user/api-keys', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ provider, key: apiKey.trim() }),
    })
    if (res.ok) {
      const data = (await res.json()) as { provider: string; keyHint: string }
      setCurrentProvider(data.provider)
      setCurrentKeyHint(data.keyHint)
      setApiKey('')
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    }
  }

  async function handleClear() {
    await fetch('/api/user/api-keys', { method: 'DELETE' })
    setApiKey('')
    setCurrentProvider(null)
    setCurrentKeyHint(null)
    setSaved(false)
  }

  const activeProviderInfo = PROVIDERS.find((p) => p.id === provider)

  return (
    <LicenseGate feature="ai">
      <div className="min-h-screen">
        {/* Breadcrumb header */}
        <div className="flex items-center gap-3 border-b border-zinc-800 bg-zinc-900 px-6 py-4">
          <Link
            href="/admin/agents"
            className="text-sm text-zinc-500 transition-colors hover:text-zinc-300"
          >
            Agents
          </Link>
          <span className="text-zinc-700">/</span>
          <span className="text-sm text-white">API Keys</span>
        </div>

        <div className="p-6 max-w-lg">
          {/* Status banner */}
          {currentProvider && (
            <div className="mb-6 flex items-center gap-2 rounded-lg border border-emerald-800/50 bg-emerald-900/20 px-4 py-3 text-sm text-emerald-400">
              <span className="h-2 w-2 rounded-full bg-emerald-400" />
              {PROVIDERS.find((p) => p.id === currentProvider)?.label ?? currentProvider} key
              configured{currentKeyHint ? ` (${currentKeyHint})` : ''} — tasks will use your key
            </div>
          )}

          <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-5">
            <h1 className="text-base font-semibold text-white">AI Provider Key</h1>
            <p className="mt-1 text-sm text-zinc-400">
              Your key is stored encrypted on RevealUI servers and never sent to the client except
              at the moment of an AI request.
            </p>

            <div className="mt-5 flex flex-col gap-4">
              {/* Provider selector */}
              <div>
                <label
                  htmlFor="provider-select"
                  className="block text-xs font-medium text-zinc-400 mb-1.5"
                >
                  Provider
                </label>
                <select
                  id="provider-select"
                  value={provider}
                  onChange={(e) => setProvider(e.target.value as Provider)}
                  className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-zinc-100 focus:border-zinc-500 focus:outline-none"
                >
                  {PROVIDERS.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* API key input */}
              <div>
                <label
                  htmlFor="api-key-input"
                  className="block text-xs font-medium text-zinc-400 mb-1.5"
                >
                  API Key
                  {activeProviderInfo && (
                    <a
                      href={activeProviderInfo.docsUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="ml-2 text-zinc-500 hover:text-zinc-300 transition-colors"
                    >
                      Get key ↗
                    </a>
                  )}
                </label>
                <div className="relative">
                  <input
                    id="api-key-input"
                    type={showKey ? 'text' : 'password'}
                    value={apiKey}
                    onChange={(e) => setApiKey(e.target.value)}
                    placeholder={activeProviderInfo?.placeholder ?? ''}
                    className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 pr-16 text-sm text-zinc-100 placeholder-zinc-600 focus:border-zinc-500 focus:outline-none font-mono"
                  />
                  <button
                    type="button"
                    onClick={() => setShowKey((v) => !v)}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-zinc-500 hover:text-zinc-300"
                  >
                    {showKey ? 'hide' : 'show'}
                  </button>
                </div>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-2 pt-1">
                <button
                  type="button"
                  onClick={handleSave}
                  disabled={!apiKey.trim()}
                  className="rounded-lg bg-zinc-100 px-4 py-2 text-sm font-medium text-zinc-900 transition-colors hover:bg-white disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {saved ? 'Saved ✓' : 'Save Key'}
                </button>
                {currentProvider && (
                  <button
                    type="button"
                    onClick={handleClear}
                    className="rounded-lg border border-zinc-700 px-4 py-2 text-sm font-medium text-zinc-400 transition-colors hover:border-zinc-500 hover:text-zinc-200"
                  >
                    Clear
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </LicenseGate>
  )
}
