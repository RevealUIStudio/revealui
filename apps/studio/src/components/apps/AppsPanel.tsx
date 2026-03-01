import { useApps } from '../../hooks/use-apps'
import AppCard from './AppCard'

export default function AppsPanel() {
  const { apps, loading, error, operating, refresh, start, stop } = useApps()

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">App Launcher</h1>
        <button
          type="button"
          onClick={refresh}
          disabled={loading}
          className="rounded-md bg-neutral-800 px-3 py-1.5 text-sm text-neutral-300 transition-colors hover:bg-neutral-700 disabled:opacity-50"
        >
          {loading ? 'Checking...' : 'Refresh'}
        </button>
      </div>

      {error && (
        <div className="rounded-md border border-red-900/50 bg-red-950/30 px-4 py-3 text-sm text-red-400">
          {error}
        </div>
      )}

      {apps.length === 0 && loading && (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="h-24 animate-pulse rounded-lg bg-neutral-800/50" />
          ))}
        </div>
      )}

      {apps.length > 0 && (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {apps.map((status) => (
            <AppCard
              key={status.app.name}
              status={status}
              isOperating={operating[status.app.name] ?? false}
              onStart={() => start(status.app.name)}
              onStop={() => stop(status.app.name)}
            />
          ))}
        </div>
      )}
    </div>
  )
}
