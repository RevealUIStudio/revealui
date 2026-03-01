import { useState } from 'react'

interface CreateSecretDialogProps {
  onConfirm: (path: string, value: string) => Promise<void>
  onClose: () => void
}

export default function CreateSecretDialog({ onConfirm, onClose }: CreateSecretDialogProps) {
  const [path, setPath] = useState('')
  const [value, setValue] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!(path.trim() && value.trim())) return
    setSaving(true)
    setError(null)
    try {
      await onConfirm(path.trim(), value.trim())
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70">
      <div className="w-full max-w-md rounded-xl border border-neutral-700 bg-neutral-900 shadow-2xl">
        <div className="flex items-center justify-between border-b border-neutral-800 px-6 py-4">
          <h2 className="text-base font-semibold">New Secret</h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded p-1 text-neutral-400 transition-colors hover:bg-neutral-800 hover:text-neutral-200"
            aria-label="Close"
          >
            <svg
              className="size-4"
              aria-hidden="true"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 px-6 py-5">
          {error && (
            <div className="rounded-md border border-red-900/50 bg-red-950/30 px-4 py-3 text-sm text-red-400">
              {error}
            </div>
          )}

          <div>
            <label
              htmlFor="secret-path"
              className="mb-1 block text-sm font-medium text-neutral-300"
            >
              Path
            </label>
            <input
              id="secret-path"
              type="text"
              value={path}
              onChange={(e) => setPath(e.target.value)}
              placeholder="namespace/key-name"
              className="w-full rounded border border-neutral-700 bg-neutral-800 px-3 py-1.5 font-mono text-sm text-neutral-100 placeholder-neutral-500 focus:border-orange-500 focus:outline-none"
              // biome-ignore lint/a11y/noAutofocus: dialog opens intentionally for keyboard entry
              autoFocus
            />
          </div>

          <div>
            <label
              htmlFor="secret-value"
              className="mb-1 block text-sm font-medium text-neutral-300"
            >
              Value
            </label>
            <textarea
              id="secret-value"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              placeholder="Secret value..."
              rows={3}
              className="w-full resize-none rounded border border-neutral-700 bg-neutral-800 px-3 py-1.5 font-mono text-sm text-neutral-100 placeholder-neutral-500 focus:border-orange-500 focus:outline-none"
            />
          </div>

          <div className="flex justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="rounded-md px-4 py-2 text-sm text-neutral-400 transition-colors hover:text-neutral-200"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving || !path.trim() || !value.trim()}
              className="rounded-md bg-orange-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-orange-500 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {saving ? 'Saving...' : 'Save Secret'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
