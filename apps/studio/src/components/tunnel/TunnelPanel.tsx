import { useState } from 'react'
import { useTunnel } from '../../hooks/use-tunnel'
import type { TailscalePeer } from '../../types'
import Button from '../ui/Button'
import ErrorAlert from '../ui/ErrorAlert'
import PanelHeader from '../ui/PanelHeader'
import StatusDot from '../ui/StatusDot'

export default function TunnelPanel() {
  const { status, loading, error, toggling, up, down, refresh } = useTunnel()

  if (loading && !status) {
    return <TunnelSkeleton />
  }

  return (
    <div className="space-y-6">
      <PanelHeader
        title="Tunnel"
        action={
          <Button variant="secondary" onClick={refresh} loading={loading}>
            Refresh
          </Button>
        }
      />

      <ErrorAlert message={error} />

      {/* Status card */}
      <div className="rounded-lg border border-neutral-800 bg-neutral-900 p-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <StatusDot status={status?.running ? 'ok' : 'off'} size="md" />
            <div>
              <p className="text-sm font-medium text-neutral-200">
                Tailscale {status?.running ? 'Connected' : 'Disconnected'}
              </p>
              {status?.running && status.ip && (
                <p className="mt-0.5 font-mono text-xs text-neutral-400">{status.ip}</p>
              )}
              {status?.running && status.hostname && (
                <p className="text-xs text-neutral-500">{status.hostname}</p>
              )}
            </div>
          </div>
          <div className="flex gap-2">
            <Button variant="success" onClick={up} disabled={toggling || status?.running}>
              Connect
            </Button>
            <Button variant="secondary" onClick={down} disabled={toggling || !status?.running}>
              Disconnect
            </Button>
          </div>
        </div>
      </div>

      {/* Peers */}
      {status?.peers && status.peers.length > 0 && (
        <div>
          <h2 className="mb-3 text-sm font-medium text-neutral-400">
            Peers ({status.peers.length})
          </h2>
          <div className="space-y-2">
            {status.peers.map((peer) => (
              <PeerCard key={peer.hostname} peer={peer} />
            ))}
          </div>
        </div>
      )}

      {status?.running && status?.peers?.length === 0 && (
        <p className="text-sm text-neutral-500">No peers connected.</p>
      )}
    </div>
  )
}

function TunnelSkeleton() {
  return (
    <div className="space-y-6">
      <div className="h-7 w-24 animate-pulse rounded bg-neutral-800" />
      <div className="h-20 animate-pulse rounded-lg bg-neutral-800/50" />
      <div className="space-y-2">
        {[1, 2].map((i) => (
          <div key={i} className="h-14 animate-pulse rounded-lg bg-neutral-800/50" />
        ))}
      </div>
    </div>
  )
}

function OsBadge({ os }: { os: string }) {
  const normalized = os.toLowerCase()
  const { label, className } = normalized.includes('windows')
    ? { label: 'Windows', className: 'bg-blue-900/40 text-blue-300' }
    : normalized.includes('linux')
      ? { label: 'Linux', className: 'bg-orange-900/40 text-orange-300' }
      : normalized.includes('mac') || normalized.includes('darwin')
        ? { label: 'macOS', className: 'bg-purple-900/40 text-purple-300' }
        : { label: os, className: 'bg-neutral-800 text-neutral-400' }

  return (
    <span className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${className}`}>{label}</span>
  )
}

function PeerCard({ peer }: { peer: TailscalePeer }) {
  const [copied, setCopied] = useState(false)

  const copyIp = async () => {
    await navigator.clipboard.writeText(peer.ip)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="flex items-center justify-between rounded-lg border border-neutral-800 bg-neutral-900 px-4 py-3">
      <div className="flex items-center gap-3">
        <StatusDot status={peer.online ? 'ok' : 'off'} size="sm" />
        <div>
          <div className="flex items-center gap-2">
            <p className="text-sm font-medium text-neutral-200">{peer.hostname}</p>
            <OsBadge os={peer.os} />
          </div>
          <p className="mt-0.5 font-mono text-xs text-neutral-500">{peer.ip}</p>
        </div>
      </div>
      <Button variant="ghost" size="sm" onClick={copyIp}>
        {copied ? 'Copied!' : 'Copy IP'}
      </Button>
    </div>
  )
}
