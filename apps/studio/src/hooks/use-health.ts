/**
 * useHealth  -  Polls the production API's readiness probe.
 *
 * Returns the health status (healthy/degraded/unhealthy/unreachable)
 * along with individual check results. Polls on the settings interval.
 */

import { useEffect, useState } from 'react';
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

  async function poll() {
    const result = await fetchHealth(settings.apiUrl);
    if (result) {
      setHealth(result);
      setReachable(true);
    } else {
      setReachable(false);
    }
    setLoading(false);
  }

  function refresh() {
    setLoading(true);
    poll();
  }

  // biome-ignore lint/correctness/useExhaustiveDependencies: re-poll when apiUrl or interval changes
  useEffect(() => {
    poll();

    const interval = setInterval(poll, settings.pollingIntervalMs);
    return () => clearInterval(interval);
  }, [settings.apiUrl, settings.pollingIntervalMs]);

  return { health, reachable, loading, refresh };
}
