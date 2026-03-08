import type { Terminal } from '@xterm/xterm'
import { useCallback, useRef } from 'react'
import { useSsh } from '../../hooks/use-ssh'
import ConnectForm from './ConnectForm'
import TerminalView from './TerminalView'

export default function TerminalPanel() {
  const terminalRef = useRef<Terminal | null>(null)

  const handleData = useCallback((data: Uint8Array) => {
    terminalRef.current?.write(data)
  }, [])

  const handleDisconnect = useCallback((reason: string) => {
    terminalRef.current?.writeln(`\r\n\x1b[33m--- ${reason} ---\x1b[0m`)
  }, [])

  const { connected, connecting, error, connect, disconnect, send, resize } = useSsh({
    onData: handleData,
    onDisconnect: handleDisconnect,
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
