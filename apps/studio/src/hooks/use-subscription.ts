/**
 * useSubscription  -  Fetches and caches subscription + usage data from the API.
 *
 * Polls on an interval (from settings.pollingIntervalMs) so the Dashboard
 * always reflects the current billing state without manual refresh.
 */

import { useEffect, useRef, useState } from 'react';
import type { SubscriptionResponse, UsageResponse } from '../lib/billing-api';
import { fetchSubscription, fetchUsage } from '../lib/billing-api';
import { useAuthContext } from './use-auth';
import { useSettingsContext } from './use-settings';

export interface SubscriptionState {
  subscription: SubscriptionResponse | null;
  usage: UsageResponse | null;
  loading: boolean;
  error: string | null;
  refresh: () => void;
}

export function useSubscription(): SubscriptionState {
  const { getToken, step } = useAuthContext();
  const { settings } = useSettingsContext();

  const [subscription, setSubscription] = useState<SubscriptionResponse | null>(null);
  const [usage, setUsage] = useState<UsageResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const refreshRef = useRef(0);
  const mountedRef = useRef(true);

  function refresh() {
    refreshRef.current += 1;
    // Trigger re-fetch by updating a counter dependency
    setLoading(true);
    fetchAll();
  }

  async function fetchAll() {
    const token = getToken();
    if (!token) {
      setLoading(false);
      return;
    }

    try {
      const [sub, usg] = await Promise.all([
        fetchSubscription(settings.apiUrl, token),
        fetchUsage(settings.apiUrl, token),
      ]);
      if (!mountedRef.current) return;
      setSubscription(sub);
      setUsage(usg);
      setError(null);
    } catch (err) {
      if (!mountedRef.current) return;
      setError(err instanceof Error ? err.message : 'Failed to fetch billing data');
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  }

  // Fetch on mount and on interval
  // biome-ignore lint/correctness/useExhaustiveDependencies: re-fetch when auth step or apiUrl changes
  useEffect(() => {
    mountedRef.current = true;
    if (step !== 'authenticated') return;

    setLoading(true);
    fetchAll();

    const interval = setInterval(fetchAll, settings.pollingIntervalMs);
    return () => {
      mountedRef.current = false;
      clearInterval(interval);
    };
  }, [step, settings.apiUrl, settings.pollingIntervalMs]);

  return { subscription, usage, loading, error, refresh };
}
