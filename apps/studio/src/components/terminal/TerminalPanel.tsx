import type { Terminal } from '@xterm/xterm'
import { useCallback, useRef, useState } from 'react'
import { useSsh } from '../../hooks/use-ssh'
import type { SshHostKeyEvent } from '../../types'
import ConnectForm from './ConnectForm'
import TerminalView from './TerminalView'

export default function TerminalPanel() {
  const terminalRef = useRef<Terminal | null>(null)
  const [hostKeyInfo, setHostKeyInfo] = useState<SshHostKeyEvent | null>(null)

  const handleData = useCallback((data: Uint8Array) => {
    terminalRef.current?.write(data)
  }, [])

  const handleDisconnect = useCallback((reason: string) => {
    terminalRef.current?.writeln(`\r\n\x1b[33m--- ${reason} ---\x1b[0m`)
  }, [])

  const handleHostKey = useCallback((event: SshHostKeyEvent) => {
    setHostKeyInfo(event)
  }, [])

  const { connected, connecting, error, connect, disconnect, send, resize } = useSsh({
    onData: handleData,
    onDisconnect: handleDisconnect,
    onHostKey: handleHostKey,
  })

  const handleTerminalData = useCallback(
    (data: string) => {
      send(data)
    },
    [send],
  )

  const handleTerminalResize = useCallback(
    (cols: number, rows: number) => {
      resize(cols, rows)
    },
    [resize],
  )

  return (
    <div className="flex h-full flex-col gap-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h1 className="text-xl font-semibold">Terminal</h1>
          <span
            className={`inline-block size-2.5 rounded-full ${connected ? 'bg-green-500' : 'bg-neutral-600'}`}
          />
        </div>
        {connected && (
          <button
            type="button"
            onClick={disconnect}
            className="rounded-md bg-neutral-700 px-3 py-1.5 text-sm font-medium text-neutral-200 transition-colors hover:bg-neutral-600"
          >
            Disconnect
          </button>
        )}
      </div>

      {error && (
        <div className="rounded-md border border-red-900/50 bg-red-950/30 px-4 py-3 text-sm text-red-400">
          {error}
        </div>
      )}

      {hostKeyInfo && hostKeyInfo.status !== 'match' && (
        <HostKeyBanner event={hostKeyInfo} onDismiss={() => setHostKeyInfo(null)} />
      )}

      {!connected ? (
        <div className="mx-auto w-full max-w-md pt-12">
          <div className="rounded-lg border border-neutral-800 bg-neutral-900 p-6">
            <h2 className="mb-4 text-sm font-medium text-neutral-300">SSH Connection</h2>
            <ConnectForm onConnect={connect} connecting={connecting} />
          </div>
        </div>
      ) : (
        <div className="min-h-0 flex-1">
          <TerminalView
            onData={handleTerminalData}
            onResize={handleTerminalResize}
            terminalRef={terminalRef}
          />
        </div>
      )}
    </div>
  )
}

function HostKeyBanner({ event, onDismiss }: { event: SshHostKeyEvent; onDismiss: () => void }) {
  const isMismatch = event.status === 'mismatch'
  return (
    <div
      className={`rounded-md border px-4 py-3 text-sm ${
        isMismatch
          ? 'border-red-900/50 bg-red-950/30 text-red-400'
          : 'border-yellow-900/50 bg-yellow-950/30 text-yellow-400'
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-medium">
            {isMismatch
              ? 'HOST KEY MISMATCH — connection rejected'
              : `New host added to known_hosts`}
          </p>
          <p className="mt-1 font-mono text-xs opacity-80">
            {event.host}:{event.port} ({event.key_type})
          </p>
          <p className="mt-0.5 font-mono text-xs opacity-60">{event.fingerprint}</p>
          {isMismatch && (
            <p className="mt-2 text-xs">
              The host key has changed since last connection. This could indicate a MITM attack.
              Remove the old entry from ~/.ssh/known_hosts if the change is expected.
            </p>
          )}
        </div>
        <button
          type="button"
          onClick={onDismiss}
          className="shrink-0 text-xs opacity-60 hover:opacity-100"
        >
          dismiss
        </button>
      </div>
    </div>
  )
}
