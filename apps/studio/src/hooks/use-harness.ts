import { useEffect, useRef, useState } from 'react';
import {
  harnessCheckFile,
  harnessClaimTask,
  harnessCompleteTask,
  harnessCreateTask,
  harnessInbox,
  harnessMarkRead,
  harnessPing,
  harnessReleaseTask,
  harnessReservations,
  harnessReserveFile,
  harnessSendMessage,
  harnessSessions,
  harnessTasks,
} from '../lib/invoke';
import type {
  HarnessClaimResult,
  HarnessMessage,
  HarnessReservation,
  HarnessReserveResult,
  HarnessSession,
  HarnessTask,
} from '../types';

/** Fallback poll interval for browser dev mode (no Tauri events available) */
const BROWSER_POLL_MS = 5_000;

export interface UseHarnessReturn {
  connected: boolean;
  sessions: HarnessSession[];
  messages: HarnessMessage[];
  tasks: HarnessTask[];
  reservations: HarnessReservation[];
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  sendMessage: (
    fromAgent: string,
    toAgent: string,
    subject: string,
    body: string,
  ) => Promise<HarnessMessage>;
  markRead: (messageIds: number[]) => Promise<void>;
  createTask: (taskId: string, description: string) => Promise<HarnessTask>;
  claimTask: (taskId: string, agentId: string) => Promise<HarnessClaimResult>;
  completeTask: (taskId: string, agentId: string) => Promise<boolean>;
  releaseTask: (taskId: string, agentId: string) => Promise<boolean>;
  reserveFile: (
    filePath: string,
    agentId: string,
    ttlSeconds: number,
    reason: string,
  ) => Promise<HarnessReserveResult>;
  checkFile: (filePath: string) => Promise<HarnessReservation | null>;
}

/** True when running inside the Tauri webview */
function isTauri(): boolean {
  return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;
}

async function fetchHarnessState(agentId: string | undefined): Promise<{
  connected: boolean;
  sessions: HarnessSession[];
  messages: HarnessMessage[];
  tasks: HarnessTask[];
  reservations: HarnessReservation[];
}> {
  const alive = await harnessPing();
  if (!alive) {
    return { connected: false, sessions: [], messages: [], tasks: [], reservations: [] };
  }

  const [sessions, messages, tasks, reservations] = await Promise.all([
    harnessSessions(),
    agentId ? harnessInbox(agentId, false) : Promise.resolve([]),
    harnessTasks(),
    harnessReservations(),
  ]);

  return { connected: true, sessions, messages, tasks, reservations };
}

export function useHarness(agentId?: string): UseHarnessReturn {
  const [connected, setConnected] = useState(false);
  const [sessions, setSessions] = useState<HarnessSession[]>([]);
  const [messages, setMessages] = useState<HarnessMessage[]>([]);
  const [tasks, setTasks] = useState<HarnessTask[]>([]);
  const [reservations, setReservations] = useState<HarnessReservation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const agentIdRef = useRef(agentId);
  agentIdRef.current = agentId;

  async function loadAll(): Promise<void> {
    try {
      const state = await fetchHarnessState(agentIdRef.current);
      setConnected(state.connected);
      setSessions(state.sessions);
      setMessages(state.messages);
      setTasks(state.tasks);
      setReservations(state.reservations);
      setError(state.connected ? null : 'Harness daemon not running');
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setConnected(false);
    } finally {
      setLoading(false);
    }
  }

  // Keep a stable ref to loadAll so the interval always calls the latest version
  const loadAllRef = useRef(loadAll);
  loadAllRef.current = loadAll;

  // Tauri mode: subscribe to push events from the Rust harness_watcher
  useEffect(() => {
    if (!isTauri()) return;

    let cancelled = false;
    const unlistenFns: Array<() => void> = [];

    async function setupListeners(): Promise<void> {
      // Dynamic import — only resolved in Tauri context
      const { listen } = await import('@tauri-apps/api/event');

      interface StatePayload {
        connected: boolean;
        sessions: HarnessSession[];
        tasks: HarnessTask[];
        reservations: HarnessReservation[];
      }

      interface MailPayload {
        messages: HarnessMessage[];
      }

      const unlistenState = await listen<StatePayload>('harness:state', (event) => {
        if (cancelled) return;
        const { connected: conn, sessions: sess, tasks: tsk, reservations: res } = event.payload;
        setConnected(conn);
        setSessions(sess);
        setTasks(tsk);
        setReservations(res);
        setError(conn ? null : 'Harness daemon not running');
        setLoading(false);
      });

      const unlistenMail = await listen<MailPayload>('harness:mail', (event) => {
        if (cancelled) return;
        setMessages(event.payload.messages);
      });

      if (!cancelled) {
        unlistenFns.push(unlistenState, unlistenMail);
      } else {
        unlistenState();
        unlistenMail();
      }
    }

    setupListeners();

    // Do one initial fetch so we don't wait for the first watcher tick
    void loadAllRef.current();

    return () => {
      cancelled = true;
      for (const fn of unlistenFns) {
        fn();
      }
    };
  }, []);

  // Browser mode: fall back to polling (no Tauri event system available)
  useEffect(() => {
    if (isTauri()) return;

    void loadAllRef.current();
    const id = setInterval(() => void loadAllRef.current(), BROWSER_POLL_MS);
    return () => clearInterval(id);
  }, []);

  async function refresh(): Promise<void> {
    setLoading(true);
    await loadAll();
  }

  async function sendMessage(
    fromAgent: string,
    toAgent: string,
    subject: string,
    body: string,
  ): Promise<HarnessMessage> {
    const msg = await harnessSendMessage(fromAgent, toAgent, subject, body);
    // In browser mode, refresh immediately. In Tauri mode, the watcher will push.
    if (!isTauri()) await loadAll();
    return msg;
  }

  async function markRead(messageIds: number[]): Promise<void> {
    await harnessMarkRead(messageIds);
    if (!isTauri()) await loadAll();
  }

  async function createTask(taskId: string, description: string): Promise<HarnessTask> {
    const task = await harnessCreateTask(taskId, description);
    if (!isTauri()) await loadAll();
    return task;
  }

  async function claimTask(taskId: string, aid: string): Promise<HarnessClaimResult> {
    const result = await harnessClaimTask(taskId, aid);
    if (!isTauri()) await loadAll();
    return result;
  }

  async function completeTask(taskId: string, aid: string): Promise<boolean> {
    const ok = await harnessCompleteTask(taskId, aid);
    if (!isTauri()) await loadAll();
    return ok;
  }

  async function releaseTask(taskId: string, aid: string): Promise<boolean> {
    const ok = await harnessReleaseTask(taskId, aid);
    if (!isTauri()) await loadAll();
    return ok;
  }

  async function reserveFile(
    filePath: string,
    aid: string,
    ttlSeconds: number,
    reason: string,
  ): Promise<HarnessReserveResult> {
    const result = await harnessReserveFile(filePath, aid, ttlSeconds, reason);
    if (!isTauri()) await loadAll();
    return result;
  }

  return {
    connected,
    sessions,
    messages,
    tasks,
    reservations,
    loading,
    error,
    refresh,
    sendMessage,
    markRead,
    createTask,
    claimTask,
    completeTask,
    releaseTask,
    reserveFile,
    checkFile: harnessCheckFile,
  };
}
