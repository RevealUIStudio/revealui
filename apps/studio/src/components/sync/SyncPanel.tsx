import { useSync } from '../../hooks/use-sync'
import Button from '../ui/Button'
import ErrorAlert from '../ui/ErrorAlert'
import PanelHeader from '../ui/PanelHeader'
import RepoCard from './RepoCard'
import SyncLog from './SyncLog'

export default function SyncPanel() {
  const { syncing, results, log, error, syncAll, syncOne } = useSync()

  return (
    <div className="space-y-6">
      <PanelHeader
        title="Repo Sync"
        action={
          <Button variant="primary" size="lg" onClick={syncAll} loading={syncing}>
            Sync All
          </Button>
        }
      />

      <ErrorAlert message={error} />

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
        <div className="flex flex-col items-center justify-center gap-3 py-12 text-center">
          <div className="flex size-10 items-center justify-center rounded-lg bg-neutral-800">
            <svg
              className="size-5 text-neutral-500"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              aria-hidden="true"
              strokeWidth={1.5}
            >
              <path d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0 3.181 3.183a8.25 8.25 0 0 0 13.803-3.7M4.031 9.865a8.25 8.25 0 0 1 13.803-3.7l3.181 3.182" />
            </svg>
          </div>
          <p className="text-sm text-neutral-500">
            Click "Sync All" to fetch and sync all registered repos.
          </p>
        </div>
      )}

      {log.length > 0 && <SyncLog entries={log} />}
    </div>
  )
}
