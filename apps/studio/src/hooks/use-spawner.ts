import { useEffect, useRef, useState } from 'react';
import { listen } from '@tauri-apps/api/event';
import { agentList, agentRemove, agentSpawn, agentStop } from '../lib/invoke';
import type { AgentBackend, AgentExitEvent, AgentOutputEvent, AgentSessionInfo } from '../types';

/** Per-session output log — maps session ID to array of output lines */
export type AgentOutputMap = Record<string, string[]>;

export function useSpawner() {
  const [sessions, setSessions] = useState<AgentSessionInfo[]>([]);
  const [output, setOutput] = useState<AgentOutputMap>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const unlistenRefs = useRef<Array<() => void>>([]);

  // Load initial session list
  useEffect(() => {
    agentList()
      .then((list) => {
        setSessions(list);
        setLoading(false);
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : String(err));
        setLoading(false);
      });
  }, []);

  // Subscribe to Tauri events for output and exit
  useEffect(() => {
    let cancelled = false;

    async function setupListeners() {
      const unlistenOutput = await listen<AgentOutputEvent>('agent_output', (event) => {
        if (cancelled) return;
        const { session_id, line } = event.payload;
        setOutput((prev) => ({
          ...prev,
          [session_id]: [...(prev[session_id] ?? []), line],
        }));
      });

      const unlistenExit = await listen<AgentExitEvent>('agent_exit', (event) => {
        if (cancelled) return;
        const { session_id, code } = event.payload;
        // Refresh sessions to get updated status
        agentList()
          .then(setSessions)
          .catch(() => {});
        // Append exit message to output
        setOutput((prev) => ({
          ...prev,
          [session_id]: [
            ...(prev[session_id] ?? []),
            `\n--- Agent exited with code ${code ?? 'unknown'} ---`,
          ],
        }));
      });

      if (!cancelled) {
        unlistenRefs.current = [unlistenOutput, unlistenExit];
      } else {
        unlistenOutput();
        unlistenExit();
      }
    }

    setupListeners();

    return () => {
      cancelled = true;
      for (const unlisten of unlistenRefs.current) {
        unlisten();
      }
      unlistenRefs.current = [];
    };
  }, []);

  async function spawn(
    name: string,
    backend: AgentBackend,
    model: string,
    prompt: string,
  ): Promise<string> {
    setError(null);
    try {
      const sessionId = await agentSpawn(name, backend, model, prompt);
      // Initialize output log for this session
      setOutput((prev) => ({ ...prev, [sessionId]: [] }));
      // Refresh sessions
      const list = await agentList();
      setSessions(list);
      return sessionId;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setError(message);
      throw err;
    }
  }

  async function stop(sessionId: string): Promise<void> {
    setError(null);
    try {
      await agentStop(sessionId);
      const list = await agentList();
      setSessions(list);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  async function remove(sessionId: string): Promise<void> {
    setError(null);
    try {
      await agentRemove(sessionId);
      setSessions((prev) => prev.filter((s) => s.id !== sessionId));
      setOutput((prev) => {
        const next = { ...prev };
        delete next[sessionId];
        return next;
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  async function refresh(): Promise<void> {
    try {
      const list = await agentList();
      setSessions(list);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  return { sessions, output, loading, error, spawn, stop, remove, refresh };
}
