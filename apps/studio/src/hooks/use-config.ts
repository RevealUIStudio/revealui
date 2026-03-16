import { useEffect, useState } from 'react';
import { getConfig, setConfig } from '../lib/config';
import type { StudioConfig } from '../types';

interface UseConfigReturn {
  config: StudioConfig | null;
  loading: boolean;
  error: string | null;
  updateConfig: (updates: Partial<StudioConfig>) => Promise<void>;
  setIntent: (intent: 'deploy' | 'develop') => Promise<void>;
}

export function useConfig(): UseConfigReturn {
  const [config, setConfigState] = useState<StudioConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getConfig()
      .then(setConfigState)
      .catch((e) => setError(String(e)))
      .finally(() => setLoading(false));
  }, []);

  const updateConfig = async (updates: Partial<StudioConfig>) => {
    if (!config) return;
    const updated = { ...config, ...updates };
    try {
      await setConfig(updated);
      setConfigState(updated);
    } catch (e) {
      setError(String(e));
    }
  };

  const setIntent = async (intent: 'deploy' | 'develop') => {
    await updateConfig({ intent });
  };

  return { config, loading, error, updateConfig, setIntent };
}
