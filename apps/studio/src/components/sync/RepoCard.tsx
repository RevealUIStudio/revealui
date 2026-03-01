import type { SyncResult } from '../../types'

interface RepoCardProps {
  result: SyncResult
  onSync: () => void
  syncing: boolean
}

const STATUS_STYLES: Record<string, string> = {
  ok: 'text-green-400',
  dirty: 'text-yellow-400',
  diverged: 'text-orange-400',
  skip: 'text-neutral-500',
  reset_failed: 'text-red-400',
  error: 'text-red-400',
}

export default function RepoCard({ result, onSync, syncing }: RepoCardProps) {
  return (
    <div className="flex items-center justify-between rounded-lg border border-neutral-800 bg-neutral-900 px-4 py-3">
      <div>
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-neutral-200">{result.repo}</span>
          <span className="text-xs text-neutral-600">{result.drive}</span>
        </div>
        <div className="mt-0.5 flex items-center gap-2 text-xs">
          <span className={STATUS_STYLES[result.status] ?? 'text-neutral-400'}>
            {result.status.toUpperCase()}
          </span>
          <span className="text-neutral-600">{result.branch}</span>
        </div>
      </div>
      <button
        type="button"
        onClick={onSync}
        disabled={syncing}
        className="rounded px-2 py-1 text-xs text-neutral-400 transition-colors hover:bg-neutral-800 hover:text-neutral-200 disabled:opacity-50"
      >
        Sync
      </button>
    </div>
  )
}
