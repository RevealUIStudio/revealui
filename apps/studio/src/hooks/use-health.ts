/**
 * useHealth  -  Polls the production API's readiness probe.
 *
 * Returns the health status (healthy/degraded/unhealthy/unreachable)
 * along with individual check results. Polls on the settings interval.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import type { HealthResponse } from '../lib/health-api';
import { fetchHealth } from '../lib/health-api';
import { useSettingsContext } from './use-settings';

export interface HealthState {
  health: HealthResponse | null;
  reachable: boolean;
  loading: boolean;
  refresh: () => void;
}

export function useHealth(): HealthState {
  const { settings } = useSettingsContext();

  const [health, setHealth] = useState<HealthResponse | null>(null);
  const [reachable, setReachable] = useState(true);
  const [loading, setLoading] = useState(true);
  const mountedRef = useRef(true);

  const poll = useCallback(async () => {
    const result = await fetchHealth(settings.apiUrl);
    if (!mountedRef.current) return;
    if (result) {
      setHealth(result);
      setReachable(true);
    } else {
      setReachable(false);
    }
    setLoading(false);
  }, [settings.apiUrl]);

  const refresh = useCallback(() => {
    setLoading(true);
    poll();
  }, [poll]);

  useEffect(() => {
    mountedRef.current = true;
    poll();

    const interval = setInterval(poll, settings.pollingIntervalMs);
    return () => {
      mountedRef.current = false;
      clearInterval(interval);
    };
  }, [poll, settings.pollingIntervalMs]);

  return { health, reachable, loading, refresh };
}
