import { useState } from 'react'
import Button from '../ui/Button'
import ErrorAlert from '../ui/ErrorAlert'
import Input from '../ui/Input'
import Modal from '../ui/Modal'

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
    <Modal
      title="New Secret"
      open={true}
      onClose={onClose}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant="primary"
            size="lg"
            onClick={(e) => handleSubmit(e as unknown as React.FormEvent)}
            disabled={saving || !path.trim() || !value.trim()}
            loading={saving}
          >
            Save Secret
          </Button>
        </>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <ErrorAlert message={error} />

        <Input
          id="secret-path"
          label="Path"
          value={path}
          onChange={(e) => setPath(e.target.value)}
          placeholder="namespace/key-name"
          mono
          autoFocus
        />

        <div>
          <label htmlFor="secret-value" className="mb-1 block text-xs font-medium text-neutral-400">
            Value
          </label>
          <textarea
            id="secret-value"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder="Secret value..."
            rows={3}
            className="w-full resize-none rounded-md border border-neutral-700 bg-neutral-800 px-3 py-2 font-mono text-sm text-neutral-200 placeholder:text-neutral-500 focus:border-orange-500 focus:outline-none"
          />
        </div>
      </form>
    </Modal>
  )
}
