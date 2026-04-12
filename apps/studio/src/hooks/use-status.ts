import { createContext, use, useCallback, useEffect, useRef, useState } from 'react';

const STATUS_POLL_INTERVAL_MS = 30_000;

import { getMountStatus, getSystemStatus } from '../lib/invoke';
import type { MountStatus, SystemStatus } from '../types';

interface StatusState {
  system: SystemStatus | null;
  mount: MountStatus | null;
  loading: boolean;
  error: string | null;
}

export interface StatusContextValue extends StatusState {
  refresh: () => Promise<void>;
}

export const StatusContext = createContext<StatusContextValue | null>(null);

export function useStatusContext(): StatusContextValue {
  const ctx = use(StatusContext);
  if (!ctx) throw new Error('useStatusContext must be used inside AppShell');
  return ctx;
}

export function useStatus() {
  const [state, setState] = useState<StatusState>({
    system: null,
    mount: null,
    loading: true,
    error: null,
  });
  const mountedRef = useRef(true);

  const refresh = useCallback(async () => {
    setState((prev) => ({ ...prev, loading: true, error: null }));
    try {
      const [system, mount] = await Promise.all([getSystemStatus(), getMountStatus()]);
      if (!mountedRef.current) return;
      setState({ system, mount, loading: false, error: null });
    } catch (err) {
      if (!mountedRef.current) return;
      setState((prev) => ({
        ...prev,
        loading: false,
        error: err instanceof Error ? err.message : String(err),
      }));
    }
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    refresh();
    const interval = setInterval(refresh, STATUS_POLL_INTERVAL_MS);
    return () => {
      mountedRef.current = false;
      clearInterval(interval);
    };
  }, [refresh]);

  return { ...state, refresh };
}
