/**
 * AgentTerminalPane  -  embedded terminal for daemon-managed agent sessions.
 *
 * Left sidebar: list of active sessions + "New Agent" button.
 * Main area: xterm.js terminal connected to the selected session via
 * agent.input (keystrokes) and agent:output (data) events.
 */

import type { Terminal } from '@xterm/xterm';
import { useCallback, useEffect, useRef, useState } from 'react';
import { agentInput, agentList, agentResize, agentSpawn, agentStop } from '../../lib/invoke';
import type { AgentSessionInfo } from '../../types';
import TerminalView from '../terminal/TerminalView';
import Button from '../ui/Button';
import StatusDot from '../ui/StatusDot';

function isTauri(): boolean {
  return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;
}

export default function AgentTerminalPane() {
  const [sessions, setSessions] = useState<AgentSessionInfo[]>([]);
  const [activeSession, setActiveSession] = useState<string | null>(null);
  const [spawning, setSpawning] = useState(false);
  const terminalRef = useRef<Terminal | null>(null);
  const unlistenRef = useRef<(() => void) | null>(null);

  // Poll sessions
  useEffect(() => {
    let cancelled = false;

    async function poll() {
      try {
        const list = await agentList();
        if (!cancelled) setSessions(list);
      } catch {
        // daemon unreachable
      }
    }

    poll();
    const interval = setInterval(poll, 5000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  // Subscribe to PTY output events for the active session
  useEffect(() => {
    if (!activeSession) return;

    const terminal = terminalRef.current;
    if (!terminal) return;

    // Clear terminal when switching sessions
    terminal.clear();
    terminal.writeln(`\x1b[1;33mAttached to ${activeSession}\x1b[0m`);
    terminal.writeln('');

    // Listen for output events from Tauri
    if (isTauri()) {
      let cleanup: (() => void) | null = null;
      import('@tauri-apps/api/event').then(({ listen }) => {
        listen<{ sessionId: string; stream: string; data: string }>('agent:output', (event) => {
          if (event.payload.sessionId === activeSession) {
            terminalRef.current?.write(event.payload.data);
          }
        }).then((unlisten) => {
          cleanup = unlisten;
          unlistenRef.current = unlisten;
        });
      });

      return () => {
        cleanup?.();
        unlistenRef.current = null;
      };
    }

    // Browser fallback: no streaming, just show status
    terminal.writeln('\x1b[90m(Browser mode  -  PTY streaming requires Tauri desktop)\x1b[0m');
    return undefined;
  }, [activeSession]);

  const handleData = useCallback(
    (data: string) => {
      if (activeSession) {
        agentInput(activeSession, data).catch(() => {
          // session may have ended
        });
      }
    },
    [activeSession],
  );

  const handleResize = useCallback(
    (cols: number, rows: number) => {
      if (activeSession) {
        agentResize(activeSession, cols, rows).catch(() => {
          // session may have ended
        });
      }
    },
    [activeSession],
  );

  async function spawnAgent() {
    setSpawning(true);
    try {
      const cols = terminalRef.current?.cols ?? 120;
      const rows = terminalRef.current?.rows ?? 30;
      const sessionId = await agentSpawn(
        `agent-${Date.now().toString(36)}`,
        'Snap',
        'default',
        '',
        { cols, rows },
      );
      setActiveSession(sessionId);
      // Refresh session list
      const list = await agentList();
      setSessions(list);
    } catch (err) {
      terminalRef.current?.writeln(
        `\x1b[31mFailed to spawn: ${err instanceof Error ? err.message : String(err)}\x1b[0m`,
      );
    } finally {
      setSpawning(false);
    }
  }

  async function stopSession(sessionId: string) {
    try {
      await agentStop(sessionId);
      if (activeSession === sessionId) setActiveSession(null);
      const list = await agentList();
      setSessions(list);
    } catch {
      // already stopped
    }
  }

  const runningCount = sessions.filter((s) => s.status === 'running').length;

  return (
    <div className="flex h-full flex-col overflow-hidden md:flex-row">
      {/* Sidebar  -  session list */}
      <div className="flex w-full flex-col border-b border-neutral-800 md:w-56 md:border-r md:border-b-0">
        <div className="flex items-center justify-between border-b border-neutral-800 px-3 py-2">
          <span className="text-sm font-medium text-neutral-300">
            Agents {runningCount > 0 && `(${runningCount})`}
          </span>
          <Button size="sm" onClick={spawnAgent} disabled={spawning}>
            {spawning ? '...' : '+ New'}
          </Button>
        </div>

        <div className="flex-1 overflow-y-auto">
          {sessions.length === 0 && (
            <p className="px-3 py-4 text-xs text-neutral-500">
              No agent sessions. Click "+ New" to spawn an agent.
            </p>
          )}
          {sessions.map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => setActiveSession(s.id)}
              className={`flex w-full items-center gap-2 border-b border-neutral-800/50 px-3 py-2 text-left text-sm transition-colors hover:bg-neutral-800/50 ${
                activeSession === s.id ? 'bg-neutral-800' : ''
              }`}
            >
              <StatusDot
                status={s.status === 'running' ? 'ok' : s.status === 'errored' ? 'error' : 'off'}
              />
              <div className="min-w-0 flex-1">
                <div className="truncate text-neutral-200">{s.name}</div>
                <div className="truncate text-xs text-neutral-500">
                  {s.backend} · {s.status}
                </div>
              </div>
              {s.status === 'running' && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    stopSession(s.id);
                  }}
                  className="rounded px-1 text-xs text-neutral-500 hover:bg-red-900/30 hover:text-red-400"
                  title="Stop"
                >
                  ■
                </button>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Main area  -  terminal */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {activeSession ? (
          <TerminalView onData={handleData} onResize={handleResize} terminalRef={terminalRef} />
        ) : (
          <div className="flex flex-1 items-center justify-center text-neutral-500">
            <div className="text-center">
              <p className="text-lg">No session selected</p>
              <p className="mt-1 text-sm">
                Select a session from the sidebar or spawn a new agent.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
