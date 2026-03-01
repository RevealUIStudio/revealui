import { useTunnel } from '../../hooks/use-tunnel'

export default function TunnelPanel() {
  const { status, loading, error, toggling, up, down, refresh } = useTunnel()

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Tunnel</h1>
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

      {/* Status card */}
      <div className="rounded-lg border border-neutral-800 bg-neutral-900 p-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span
              className={`inline-block size-2.5 rounded-full ${status?.running ? 'bg-green-500' : 'bg-neutral-600'}`}
            />
            <div>
              <p className="text-sm font-medium text-neutral-200">
                Tailscale {status?.running ? 'Connected' : 'Disconnected'}
              </p>
              {status?.running && status.ip && (
                <p className="mt-0.5 text-xs font-mono text-neutral-400">{status.ip}</p>
              )}
              {status?.running && status.hostname && (
                <p className="text-xs text-neutral-500">{status.hostname}</p>
              )}
            </div>
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={up}
              disabled={toggling || status?.running}
              className="rounded-md bg-green-700 px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-green-600 disabled:opacity-40"
            >
              Connect
            </button>
            <button
              type="button"
              onClick={down}
              disabled={toggling || !status?.running}
              className="rounded-md bg-neutral-700 px-3 py-1.5 text-sm font-medium text-neutral-200 transition-colors hover:bg-neutral-600 disabled:opacity-40"
            >
              Disconnect
            </button>
          </div>
        </div>
      </div>

      {/* Peers */}
      {status?.peers && status.peers.length > 0 && (
        <div>
          <h2 className="mb-3 text-sm font-medium text-neutral-400">Peers</h2>
          <div className="space-y-1">
            {status.peers.map((peer) => (
              <div
                key={peer.hostname}
                className="flex items-center justify-between rounded-md border border-neutral-800 bg-neutral-900 px-4 py-2"
              >
                <div className="flex items-center gap-3">
                  <span
                    className={`inline-block size-2 rounded-full ${peer.online ? 'bg-green-500' : 'bg-neutral-600'}`}
                  />
                  <div>
                    <p className="text-sm text-neutral-200">{peer.hostname}</p>
                    <p className="text-xs text-neutral-500">{peer.os}</p>
                  </div>
                </div>
                <span className="text-xs font-mono text-neutral-400">{peer.ip}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
