'use client';

import { useEffect, useState } from 'react';
import { useOnlineStatus } from '../hooks/useOnlineStatus.js';

/** Duration in ms before the "Synced" label fades away. */
const SYNCED_LABEL_DURATION_MS = 3_000;

interface SyncStatusIndicatorProps {
  /** Optional CSS class name for positioning or layout overrides. */
  className?: string;
  /** Whether data is currently being synced. */
  isSyncing?: boolean;
}

/**
 * Visual indicator for sync / connectivity status.
 *
 * - **Online + synced**: green dot
 * - **Online + syncing**: pulsing yellow dot
 * - **Offline**: red dot with "Offline" label
 * - **Recently reconnected**: green dot with "Synced" label (fades after 3 s)
 */
export function SyncStatusIndicator(props: SyncStatusIndicatorProps): React.ReactNode {
  const { className, isSyncing = false } = props;
  const { isOnline, wasOffline } = useOnlineStatus();

  // Show "Synced" label for 3 s after reconnection.
  const [showSyncedLabel, setShowSyncedLabel] = useState(false);

  useEffect(() => {
    if (!wasOffline) {
      return;
    }
    setShowSyncedLabel(true);
    const timer = setTimeout(() => {
      setShowSyncedLabel(false);
    }, SYNCED_LABEL_DURATION_MS);
    return () => clearTimeout(timer);
  }, [wasOffline]);

  // Determine dot color and label.
  let dotColor: string;
  let label: string | null = null;
  let pulse = false;

  if (!isOnline) {
    dotColor = '#ef4444'; // red-500
    label = 'Offline';
  } else if (isSyncing) {
    dotColor = '#eab308'; // yellow-500
    pulse = true;
  } else if (showSyncedLabel) {
    dotColor = '#22c55e'; // green-500
    label = 'Synced';
  } else {
    dotColor = '#22c55e'; // green-500
  }

  const dotStyle: React.CSSProperties = {
    display: 'inline-block',
    width: '8px',
    height: '8px',
    borderRadius: '50%',
    backgroundColor: dotColor,
    animation: pulse ? 'revealui-pulse 1.5s ease-in-out infinite' : undefined,
  };

  const containerStyle: React.CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '6px',
    fontSize: '12px',
    lineHeight: '1',
  };

  return (
    <span className={className} style={containerStyle} aria-label={label ?? 'Online'}>
      <span style={dotStyle} />
      {label !== null ? <span>{label}</span> : null}
      {pulse ? (
        <style>
          {'@keyframes revealui-pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.4; } }'}
        </style>
      ) : null}
    </span>
  );
}
