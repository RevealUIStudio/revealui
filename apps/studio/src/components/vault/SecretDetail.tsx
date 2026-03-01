import { useState } from 'react'
import { vaultCopy } from '../../lib/invoke'

interface SecretDetailProps {
  path: string | null
  value: string | null
  loading: boolean
}

export default function SecretDetail({ path, value, loading }: SecretDetailProps) {
  const [revealed, setRevealed] = useState(false)
  const [copied, setCopied] = useState(false)

  const handleCopy = async () => {
    if (!value) return
    try {
      await vaultCopy(value)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // clipboard unavailable
    }
  }

  if (!path) {
    return (
      <div className="flex flex-1 items-center justify-center text-sm text-neutral-500">
        Select a secret to view its value
      </div>
    )
  }

  return (
    <div className="flex flex-1 flex-col gap-4 p-4">
      <div>
        <p className="text-xs font-medium uppercase tracking-wider text-neutral-500">Path</p>
        <p className="mt-1 break-all font-mono text-sm text-neutral-200">{path}</p>
      </div>

      <div>
        <p className="text-xs font-medium uppercase tracking-wider text-neutral-500">Value</p>
        {loading ? (
          <p className="mt-1 text-sm text-neutral-500">Loading...</p>
        ) : (
          <div className="mt-1 rounded-md border border-neutral-800 bg-neutral-950/50 p-3">
            <pre
              className={`break-all font-mono text-sm text-neutral-200 ${
                revealed ? '' : 'select-none blur-sm'
              }`}
            >
              {value ?? '—'}
            </pre>
          </div>
        )}
      </div>

      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => setRevealed((r) => !r)}
          className="rounded-md border border-neutral-700 bg-neutral-800 px-3 py-1.5 text-sm text-neutral-200 transition-colors hover:bg-neutral-700"
        >
          {revealed ? 'Hide' : 'Reveal'}
        </button>
        <button
          type="button"
          onClick={handleCopy}
          disabled={!value || loading}
          className="rounded-md border border-neutral-700 bg-neutral-800 px-3 py-1.5 text-sm text-neutral-200 transition-colors hover:bg-neutral-700 disabled:opacity-50"
        >
          {copied ? 'Copied!' : 'Copy'}
        </button>
      </div>
    </div>
  )
}
