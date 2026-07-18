import { type ChildProcess, spawn as nodeSpawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { EventEmitter } from 'node:events';

// ── Types ───────────────────────────────────────────────────────────

export type AgentBackend = 'Snap' | 'Ollama';

export interface AgentSessionInfo {
  id: string;
  name: string;
  model: string;
  backend: AgentBackend;
  prompt: string;
  status: 'running' | 'stopped' | 'errored';
  pid: number | null;
}

export interface AgentOutputEvent {
  sessionId: string;
  stream: 'stdout' | 'stderr';
  data: string;
}

export interface AgentExitEvent {
  sessionId: string;
  code: number | null;
}

// ── Configuration ───────────────────────────────────────────────────

export interface SpawnerConfig {
  /** Inference snap OpenAI-compatible endpoint (default: http://localhost:9090) */
  snapEndpoint: string;
  /** Max concurrent agent sessions (default: 8) */
  maxSessions: number;
  /**
   * Grace period, in milliseconds, between SIGTERM and the SIGKILL escalation
   * for a child that does not exit on its own (default: 5000).
   */
  terminationGraceMs: number;
}

const DEFAULT_CONFIG: SpawnerConfig = {
  snapEndpoint: 'http://localhost:9090',
  maxSessions: 8,
  terminationGraceMs: 5000,
};

// ── Service ─────────────────────────────────────────────────────────

interface AgentProcess {
  name: string;
  model: string;
  backend: AgentBackend;
  prompt: string;
  child: ChildProcess;
  status: 'running' | 'stopped' | 'errored';
  /** Pending SIGKILL escalation timer, set while a SIGTERM grace window is open. */
  graceTimer?: ReturnType<typeof setTimeout>;
}

/**
 * Manages agent process lifecycle on the daemon host.
 *
 * Emits:
 *   'output' → AgentOutputEvent  (each stdout/stderr line)
 *   'exit'   → AgentExitEvent    (process termination)
 */
export class SpawnerService extends EventEmitter {
  private readonly sessions = new Map<string, AgentProcess>();
  private readonly config: SpawnerConfig;

  constructor(overrides?: Partial<SpawnerConfig>) {
    super();
    this.config = { ...DEFAULT_CONFIG, ...overrides };
  }

  /** Spawn a new agent process. Returns the session ID. */
  spawn(name: string, backend: AgentBackend, model: string, prompt: string): string {
    if (this.sessions.size >= this.config.maxSessions) {
      throw new Error(`Max sessions (${this.config.maxSessions}) reached`);
    }

    const sessionId = randomUUID();
    let child: ChildProcess;

    switch (backend) {
      case 'Snap': {
        const body = JSON.stringify({
          model,
          messages: [{ role: 'user', content: prompt }],
          stream: false,
        });
        child = nodeSpawn(
          'curl',
          [
            '-s',
            '-X',
            'POST',
            `${this.config.snapEndpoint}/v1/chat/completions`,
            '-H',
            'Content-Type: application/json',
            '-d',
            body,
          ],
          { stdio: ['ignore', 'pipe', 'pipe'] },
        );
        break;
      }
      case 'Ollama': {
        child = nodeSpawn('ollama', ['run', model, prompt], {
          stdio: ['ignore', 'pipe', 'pipe'],
        });
        break;
      }
    }

    const proc: AgentProcess = {
      name,
      model,
      backend,
      prompt,
      child,
      status: 'running',
    };
    this.sessions.set(sessionId, proc);

    // Stream stdout
    child.stdout?.on('data', (chunk: Buffer) => {
      const data = chunk.toString();
      if (data.length > 0) {
        this.emit('output', { sessionId, stream: 'stdout', data } satisfies AgentOutputEvent);
      }
    });

    // Stream stderr
    child.stderr?.on('data', (chunk: Buffer) => {
      const data = chunk.toString();
      if (data.length > 0) {
        this.emit('output', { sessionId, stream: 'stderr', data } satisfies AgentOutputEvent);
      }
    });

    // Handle exit. The close handler is the single source of truth for terminal
    // status; if a SIGTERM grace window is still open, close-before-timeout wins
    // and the pending SIGKILL escalation is cancelled.
    child.on('close', (code) => {
      if (proc.graceTimer) {
        clearTimeout(proc.graceTimer);
        proc.graceTimer = undefined;
      }
      proc.status = code === 0 ? 'stopped' : 'errored';
      this.emit('exit', { sessionId, code } satisfies AgentExitEvent);
    });

    child.on('error', () => {
      proc.status = 'errored';
      this.emit('exit', { sessionId, code: null } satisfies AgentExitEvent);
    });

    return sessionId;
  }

  /**
   * Request termination of a running agent: SIGTERM now, SIGKILL after the
   * configured grace period if it has not exited. Returns once SIGTERM is sent;
   * the status transition is event-driven (the child's `close` handler sets the
   * terminal status), so `list()` keeps reporting `running` until the process
   * actually exits.
   */
  stop(sessionId: string): void {
    const proc = this.sessions.get(sessionId);
    if (!proc) throw new Error(`No agent session: ${sessionId}`);
    if (proc.status !== 'running') throw new Error(`Agent is not running (${proc.status})`);
    this.terminate(proc);
  }

  /** List all agent sessions. */
  list(): AgentSessionInfo[] {
    const result: AgentSessionInfo[] = [];
    for (const [id, proc] of this.sessions) {
      result.push({
        id,
        name: proc.name,
        model: proc.model,
        backend: proc.backend,
        prompt: proc.prompt,
        status: proc.status,
        pid: proc.child.pid ?? null,
      });
    }
    return result;
  }

  /** Remove a stopped/errored session. */
  remove(sessionId: string): void {
    const proc = this.sessions.get(sessionId);
    if (!proc) throw new Error(`No agent session: ${sessionId}`);
    if (proc.status === 'running')
      throw new Error('Cannot remove a running agent  -  stop it first');
    this.sessions.delete(sessionId);
  }

  /**
   * Request termination of all running agents (called on daemon shutdown).
   * Same SIGTERM → grace → SIGKILL escalation as `stop`, with event-driven
   * status, so shutdown neither wedges a child that ignores SIGTERM nor lies
   * about its status.
   */
  stopAll(): void {
    for (const [, proc] of this.sessions) {
      if (proc.status === 'running') {
        this.terminate(proc);
      }
    }
  }

  /**
   * Send SIGTERM and arm a bounded SIGKILL escalation. Status is left `running`;
   * the child's `close` handler owns the terminal transition. Idempotent while a
   * grace window is already open. The escalation timer is unref'd so it can never
   * keep the process alive or fire after exit.
   */
  private terminate(proc: AgentProcess): void {
    if (proc.graceTimer) return;
    proc.child.kill('SIGTERM');
    const timer = setTimeout(() => {
      proc.graceTimer = undefined;
      if (proc.status === 'running') {
        proc.child.kill('SIGKILL');
      }
    }, this.config.terminationGraceMs);
    timer.unref?.();
    proc.graceTimer = timer;
  }
}
