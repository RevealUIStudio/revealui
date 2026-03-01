import { useStatus } from '../../hooks/use-status'
import ServiceCard from './ServiceCard'
import TierBadge from './TierBadge'

export default function Dashboard() {
  const { system, mount, loading, error, refresh } = useStatus()

  if (loading && !system) {
    return <LoadingSkeleton />
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Dashboard</h1>
        <button
          type="button"
          onClick={refresh}
          disabled={loading}
          className="rounded-md bg-neutral-800 px-3 py-1.5 text-sm text-neutral-300 transition-colors hover:bg-neutral-700 disabled:opacity-50"
        >
          {loading ? 'Refreshing...' : 'Refresh'}
        </button>
      </div>

      {error && (
        <div className="rounded-md border border-red-900/50 bg-red-950/30 px-4 py-3 text-sm text-red-400">
          {error}
        </div>
      )}

      {system && (
        <div className="flex items-center gap-3">
          <TierBadge tier={system.tier} />
          <span className="text-sm text-neutral-400">
            {system.distribution} &mdash; systemd: {system.systemd_status}
          </span>
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <ServiceCard
          title="WSL"
          status={system?.wsl_running ? 'running' : 'stopped'}
          detail={system?.distribution ?? 'Unknown'}
        />
        <ServiceCard
          title="Studio Drive"
          status={mount?.mounted ? 'running' : 'stopped'}
          detail={
            mount?.mounted
              ? `${mount.size_used ?? '?'} / ${mount.size_total ?? '?'} (${mount.use_percent ?? '?'})`
              : 'Not mounted'
          }
        />
        <ServiceCard
          title="Systemd"
          status={
            system?.systemd_status === 'running'
              ? 'running'
              : system?.systemd_status === 'degraded'
                ? 'degraded'
                : 'stopped'
          }
          detail={system?.systemd_status ?? 'Unknown'}
        />
      </div>
    </div>
  )
}

function LoadingSkeleton() {
  return (
    <div className="space-y-6">
      <div className="h-7 w-32 animate-pulse rounded bg-neutral-800" />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-28 animate-pulse rounded-lg bg-neutral-800/50" />
        ))}
      </div>
    </div>
  )
}
