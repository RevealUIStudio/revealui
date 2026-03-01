import { useSync } from '../../hooks/use-sync'
import RepoCard from './RepoCard'
import SyncLog from './SyncLog'

export default function SyncPanel() {
  const { syncing, results, log, error, syncAll, syncOne } = useSync()

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Repo Sync</h1>
        <button
          type="button"
          onClick={syncAll}
          disabled={syncing}
          className="rounded-md bg-orange-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-orange-500 disabled:opacity-50"
        >
          {syncing ? 'Syncing...' : 'Sync All'}
        </button>
      </div>

      {error && (
        <div className="rounded-md border border-red-900/50 bg-red-950/30 px-4 py-3 text-sm text-red-400">
          {error}
        </div>
      )}

      {results.length > 0 && (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {results.map((result) => (
            <RepoCard
              key={`${result.drive}-${result.repo}`}
              result={result}
              onSync={() => syncOne(result.repo)}
              syncing={syncing}
            />
          ))}
        </div>
      )}

      {results.length === 0 && !syncing && (
        <p className="text-sm text-neutral-500">
          Click "Sync All" to fetch and sync all registered repos.
        </p>
      )}

      {log.length > 0 && <SyncLog entries={log} />}
    </div>
  )
}
