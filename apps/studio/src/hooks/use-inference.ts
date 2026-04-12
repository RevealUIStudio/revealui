import { useEffect, useRef, useState } from 'react';
import {
  inferenceOllamaDelete,
  inferenceOllamaModels,
  inferenceOllamaPull,
  inferenceOllamaStart,
  inferenceOllamaStatus,
  inferenceOllamaStop,
  inferenceSnapInstall,
  inferenceSnapList,
  inferenceSnapRemove,
} from '../lib/invoke';
import type { OllamaModel, OllamaStatus, SnapModel } from '../types';

export function useInference() {
  const [ollama, setOllama] = useState<OllamaStatus | null>(null);
  const [models, setModels] = useState<OllamaModel[]>([]);
  const [snaps, setSnaps] = useState<SnapModel[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pulling, setPulling] = useState(false);
  const [installingSnap, setInstallingSnap] = useState<string | null>(null);
  const mountedRef = useRef(true);

  async function refresh(): Promise<void> {
    try {
      const [ollamaResult, snapList] = await Promise.all([
        inferenceOllamaStatus(),
        inferenceSnapList(),
      ]);
      if (!mountedRef.current) return;
      setOllama(ollamaResult);
      setSnaps(snapList);

      if (ollamaResult.running) {
        const modelList = await inferenceOllamaModels();
        if (!mountedRef.current) return;
        setModels(modelList);
      } else {
        setModels([]);
      }

      setLoading(false);
    } catch (err) {
      if (!mountedRef.current) return;
      setError(err instanceof Error ? err.message : String(err));
      setLoading(false);
    }
  }

  // biome-ignore lint/correctness/useExhaustiveDependencies: refresh is stable, run on mount only
  useEffect(() => {
    mountedRef.current = true;
    refresh();
    const id = setInterval(() => {
      if (!document.hidden) refresh();
    }, 30_000);
    return () => {
      mountedRef.current = false;
      clearInterval(id);
    };
  }, []);

  async function startOllama(): Promise<void> {
    setError(null);
    try {
      await inferenceOllamaStart();
      await new Promise((r) => setTimeout(r, 2000));
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  async function stopOllama(): Promise<void> {
    setError(null);
    try {
      await inferenceOllamaStop();
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  async function pullModel(name: string): Promise<void> {
    setError(null);
    setPulling(true);
    try {
      const result = await inferenceOllamaPull(name);
      if (!result.success) {
        setError(result.message);
      }
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setPulling(false);
    }
  }

  async function deleteModel(name: string): Promise<void> {
    setError(null);
    try {
      await inferenceOllamaDelete(name);
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  async function installSnap(snapName: string): Promise<void> {
    setError(null);
    setInstallingSnap(snapName);
    try {
      const result = await inferenceSnapInstall(snapName);
      if (!result.success) {
        setError(result.message);
      }
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setInstallingSnap(null);
    }
  }

  async function removeSnap(snapName: string): Promise<void> {
    setError(null);
    try {
      await inferenceSnapRemove(snapName);
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  return {
    ollama,
    models,
    snaps,
    loading,
    error,
    pulling,
    installingSnap,
    refresh,
    startOllama,
    stopOllama,
    pullModel,
    deleteModel,
    installSnap,
    removeSnap,
  };
}
