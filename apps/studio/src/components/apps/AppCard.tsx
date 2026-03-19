import { open } from '@tauri-apps/plugin-shell';
import { useCallback, useEffect, useRef, useState } from 'react';

const LOG_POLL_INTERVAL_MS = 3_000;

import { readAppLog } from '../../lib/invoke';
import type { AppStatus } from '../../types';
import Button from '../ui/Button';
import Card from '../ui/Card';
import StatusDot from '../ui/StatusDot';

interface AppCardProps {
  status: AppStatus;
  isOperating: boolean;
  onStart: () => void;
  onStop: () => void;
}

export default function AppCard({ status, isOperating, onStart, onStop }: AppCardProps) {
  const { app, running } = status;
  const [showLogs, setShowLogs] = useState(false);
  const [logContent, setLogContent] = useState('');
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchLog = useCallback(async () => {
    try {
      const content = await readAppLog(app.name, 50);
      setLogContent(content);
    } catch {
      setLogContent('[Failed to read log]');
    }
  }, [app.name]);

  useEffect(() => {
    if (showLogs && running) {
      fetchLog();
      intervalRef.current = setInterval(fetchLog, LOG_POLL_INTERVAL_MS);
    }
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [showLogs, running, fetchLog]);

  const handleOpen = () => {
    open(app.url);
  };

  return (
    <Card variant="default" padding="none">
      <div className="p-4">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-2">
            <StatusDot status={running ? 'ok' : 'off'} size="sm" pulse={isOperating} />
            <h3 className="text-sm font-medium">{app.display_name}</h3>
          </div>
          <span className="text-xs text-neutral-500">:{app.port}</span>
        </div>

        <p className="mt-1 text-xs text-neutral-500">
          {isOperating
            ? running
              ? 'Stopping...'
              : 'Starting...'
            : running
              ? `Running on localhost:${app.port}`
              : 'Stopped'}
        </p>

        <div className="mt-3 flex gap-2">
          {running ? (
            <>
              <Button variant="primary" size="sm" onClick={handleOpen}>
                Open
              </Button>
              <Button variant="secondary" size="sm" onClick={onStop} loading={isOperating}>
                Stop
              </Button>
              <Button variant="ghost" size="sm" onClick={() => setShowLogs((s) => !s)}>
                {showLogs ? 'Hide Logs' : 'Logs'}
              </Button>
            </>
          ) : (
            <Button variant="secondary" size="sm" onClick={onStart} loading={isOperating}>
              Start
            </Button>
          )}
        </div>
      </div>

      {showLogs && running && (
        <div className="border-t border-neutral-800">
          <pre className="max-h-48 overflow-y-auto whitespace-pre-wrap p-3 font-mono text-xs text-neutral-400">
            {logContent || 'No log output yet...'}
          </pre>
        </div>
      )}
    </Card>
  );
}
