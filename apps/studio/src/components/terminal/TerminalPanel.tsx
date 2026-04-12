import type { Terminal } from '@xterm/xterm';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useSsh } from '../../hooks/use-ssh';
import type { SshConnectParams, SshHostKeyEvent } from '../../types';
import Button from '../ui/Button';
import Card from '../ui/Card';
import ErrorAlert from '../ui/ErrorAlert';
import StatusDot from '../ui/StatusDot';
import ConnectForm from './ConnectForm';
import SshBookmarkSidebar from './SshBookmarkSidebar';
import TerminalView from './TerminalView';

export default function TerminalPanel() {
  const terminalRef = useRef<Terminal | null>(null);
  const [hostKeyInfo, setHostKeyInfo] = useState<SshHostKeyEvent | null>(null);
  const [lastParams, setLastParams] = useState<SshConnectParams | null>(null);
  const [connectedAt, setConnectedAt] = useState<number | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);

  const handleData = useCallback((data: Uint8Array) => {
    terminalRef.current?.write(data);
  }, []);

  const handleDisconnect = useCallback((reason: string) => {
    terminalRef.current?.writeln(`\r\n\x1b[33m--- ${reason} ---\x1b[0m`);
    setConnectedAt(null);
  }, []);

  const handleHostKey = useCallback((event: SshHostKeyEvent) => {
    setHostKeyInfo(event);
  }, []);

  const { connected, connecting, error, connect, disconnect, send, resize } = useSsh({
    onData: handleData,
    onDisconnect: handleDisconnect,
    onHostKey: handleHostKey,
  });

  const handleConnect = useCallback(
    (params: SshConnectParams) => {
      setLastParams(params);
      setConnectedAt(Date.now());
      connect(params);
    },
    [connect],
  );

  const handleReconnect = useCallback(async () => {
    if (!lastParams) return;
    await disconnect();
    setConnectedAt(Date.now());
    connect(lastParams);
  }, [lastParams, disconnect, connect]);

  const handleTerminalData = useCallback(
    (data: string) => {
      send(data);
    },
    [send],
  );

  const handleTerminalResize = useCallback(
    (cols: number, rows: number) => {
      resize(cols, rows);
    },
    [resize],
  );

  return (
    <div className="flex h-full">
      {/* Collapsible bookmark sidebar */}
      {sidebarOpen && !connected && <SshBookmarkSidebar onSelect={handleConnect} />}

      <div className="flex min-w-0 flex-1 flex-col gap-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-semibold">Terminal</h1>
            <StatusDot status={connected ? 'ok' : 'off'} size="md" />
            {!connected && (
              <Button variant="ghost" size="sm" onClick={() => setSidebarOpen(!sidebarOpen)}>
                {sidebarOpen ? 'Hide bookmarks' : 'Bookmarks'}
              </Button>
            )}
          </div>
          {connected && (
            <Button variant="secondary" onClick={disconnect}>
              Disconnect
            </Button>
          )}
        </div>

        <ErrorAlert message={error} />

        {hostKeyInfo && hostKeyInfo.status !== 'match' && (
          <HostKeyBanner event={hostKeyInfo} onDismiss={() => setHostKeyInfo(null)} />
        )}

        {!connected ? (
          <div className="mx-auto w-full max-w-md pt-12">
            <Card variant="default" padding="lg">
              <h2 className="mb-4 text-sm font-medium text-neutral-300">SSH Connection</h2>
              <ConnectForm onConnect={handleConnect} connecting={connecting} />
            </Card>
          </div>
        ) : (
          <>
            <div className="min-h-0 flex-1">
              <TerminalView
                onData={handleTerminalData}
                onResize={handleTerminalResize}
                terminalRef={terminalRef}
              />
            </div>

            {/* Connection status strip */}
            {lastParams && (
              <div className="flex items-center justify-between rounded-md border border-neutral-800 bg-neutral-900 px-3 py-1.5">
                <div className="flex items-center gap-2 text-xs text-neutral-400">
                  <StatusDot status="ok" size="sm" />
                  <span className="font-mono">
                    {lastParams.username}@{lastParams.host}:{lastParams.port}
                  </span>
                  {connectedAt && <SessionTimer startTime={connectedAt} />}
                </div>
                <Button variant="ghost" size="sm" onClick={handleReconnect}>
                  Reconnect
                </Button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function SessionTimer({ startTime }: { startTime: number }) {
  const [elapsed, setElapsed] = useState('');

  // Update every 30s  -  session duration doesn't need high precision
  useEffect(() => {
    const update = () => {
      const seconds = Math.floor((Date.now() - startTime) / 1000);
      const minutes = Math.floor(seconds / 60);
      const hours = Math.floor(minutes / 60);
      if (hours > 0) {
        setElapsed(`${hours}h ${minutes % 60}m`);
      } else if (minutes > 0) {
        setElapsed(`${minutes}m`);
      } else {
        setElapsed(`${seconds}s`);
      }
    };
    update();
    const id = setInterval(update, 30_000);
    return () => clearInterval(id);
  }, [startTime]);

  return <span className="text-neutral-500">{elapsed}</span>;
}

function HostKeyBanner({ event, onDismiss }: { event: SshHostKeyEvent; onDismiss: () => void }) {
  const isMismatch = event.status === 'mismatch';
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
              ? 'HOST KEY MISMATCH  -  connection rejected'
              : 'New host added to known_hosts'}
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
        <Button variant="ghost" size="sm" onClick={onDismiss}>
          dismiss
        </Button>
      </div>
    </div>
  );
}
