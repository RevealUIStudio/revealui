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
}

const DEFAULT_CONFIG: SpawnerConfig = {
  snapEndpoint: 'http://localhost:9090',
  maxSessions: 8,
};

// ── Service ─────────────────────────────────────────────────────────

interface AgentProcess {
  name: string;
  model: string;
  backend: AgentBackend;
  prompt: string;
  child: ChildProcess;
  status: 'running' | 'stopped' | 'errored';
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

    // Handle exit
    child.on('close', (code) => {
      proc.status = code === 0 ? 'stopped' : 'errored';
      this.emit('exit', { sessionId, code } satisfies AgentExitEvent);
    });

    child.on('error', () => {
      proc.status = 'errored';
      this.emit('exit', { sessionId, code: null } satisfies AgentExitEvent);
    });

    return sessionId;
  }

  /** Stop a running agent by killing its process. */
  stop(sessionId: string): void {
    const proc = this.sessions.get(sessionId);
    if (!proc) throw new Error(`No agent session: ${sessionId}`);
    if (proc.status !== 'running') throw new Error(`Agent is not running (${proc.status})`);
    proc.child.kill('SIGTERM');
    proc.status = 'stopped';
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

  /** Kill all running agents (called on daemon shutdown). */
  stopAll(): void {
    for (const [, proc] of this.sessions) {
      if (proc.status === 'running') {
        proc.child.kill('SIGTERM');
        proc.status = 'stopped';
      }
    }
  }
}
