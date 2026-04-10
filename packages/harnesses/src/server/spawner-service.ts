import { type ChildProcess, spawn as nodeSpawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { EventEmitter } from 'node:events';

// ── Types ───────────────────────────────────────────────────────────

export type AgentBackend = 'Snap' | 'Ollama' | 'ClaudeCode';

export interface AgentSessionInfo {
  id: string;
  name: string;
  model: string;
  backend: AgentBackend;
  prompt: string;
  status: 'running' | 'stopped' | 'errored';
  pid: number | null;
  /** Whether this session is a PTY (interactive terminal). */
  isPty: boolean;
}

export interface AgentOutputEvent {
  sessionId: string;
  stream: 'stdout' | 'stderr' | 'pty';
  data: string;
}

export interface AgentExitEvent {
  sessionId: string;
  code: number | null;
}

/** node-pty IPty interface (dynamically imported to keep it optional). */
interface IPty {
  pid: number;
  cols: number;
  rows: number;
  onData: (handler: (data: string) => void) => { dispose: () => void };
  onExit: (handler: (e: { exitCode: number; signal?: number }) => void) => { dispose: () => void };
  write: (data: string) => void;
  resize: (cols: number, rows: number) => void;
  kill: (signal?: string) => void;
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
  child: ChildProcess | null;
  pty: IPty | null;
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
  spawn(
    name: string,
    backend: AgentBackend,
    model: string,
    prompt: string,
    options?: { cwd?: string; cols?: number; rows?: number },
  ): string {
    if (this.sessions.size >= this.config.maxSessions) {
      throw new Error(`Max sessions (${this.config.maxSessions}) reached`);
    }

    const sessionId = randomUUID();

    if (backend === 'ClaudeCode') {
      return this.spawnPty(sessionId, name, model, prompt, options);
    }

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
      pty: null,
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

  /**
   * Spawn a ClaudeCode process with PTY support (interactive terminal).
   * Uses node-pty (dynamically imported) so the harness still works without it.
   */
  private spawnPty(
    sessionId: string,
    name: string,
    model: string,
    prompt: string,
    options?: { cwd?: string; cols?: number; rows?: number },
  ): string {
    // node-pty is dynamically required — it's optional and native
    let ptyModule: { spawn: (file: string, args: string[], opts: unknown) => IPty };
    try {
      // biome-ignore lint/style/noCommaOperator: dynamic require for optional native module
      ptyModule = require('node-pty');
    } catch {
      throw new Error(
        'node-pty is not installed. Run: pnpm add node-pty --filter @revealui/harnesses',
      );
    }

    const cols = options?.cols ?? 120;
    const rows = options?.rows ?? 30;
    const cwd = options?.cwd ?? process.cwd();

    const pty = ptyModule.spawn('claude', [], {
      name: 'xterm-256color',
      cols,
      rows,
      cwd,
      env: {
        ...process.env,
        CLAUDE_AGENT_ROLE: name,
        TERM: 'xterm-256color',
      },
    });

    const proc: AgentProcess = {
      name,
      model,
      backend: 'ClaudeCode',
      prompt,
      child: null,
      pty,
      status: 'running',
    };
    this.sessions.set(sessionId, proc);

    // Stream PTY output
    pty.onData((data: string) => {
      this.emit('output', { sessionId, stream: 'pty', data } satisfies AgentOutputEvent);
    });

    // Handle PTY exit
    pty.onExit(({ exitCode }: { exitCode: number }) => {
      proc.status = exitCode === 0 ? 'stopped' : 'errored';
      this.emit('exit', { sessionId, code: exitCode } satisfies AgentExitEvent);
    });

    return sessionId;
  }

  /** Write input data to a session's PTY. Only works for PTY sessions. */
  write(sessionId: string, data: string): void {
    const proc = this.sessions.get(sessionId);
    if (!proc) throw new Error(`No agent session: ${sessionId}`);
    if (!proc.pty) throw new Error('Session is not a PTY — use ClaudeCode backend');
    if (proc.status !== 'running') throw new Error(`Agent is not running (${proc.status})`);
    proc.pty.write(data);
  }

  /** Resize a session's PTY terminal. Only works for PTY sessions. */
  resize(sessionId: string, cols: number, rows: number): void {
    const proc = this.sessions.get(sessionId);
    if (!proc) throw new Error(`No agent session: ${sessionId}`);
    if (!proc.pty) throw new Error('Session is not a PTY — use ClaudeCode backend');
    if (proc.status !== 'running') throw new Error(`Agent is not running (${proc.status})`);
    proc.pty.resize(cols, rows);
  }

  /** Stop a running agent by killing its process. */
  stop(sessionId: string): void {
    const proc = this.sessions.get(sessionId);
    if (!proc) throw new Error(`No agent session: ${sessionId}`);
    if (proc.status !== 'running') throw new Error(`Agent is not running (${proc.status})`);
    if (proc.pty) {
      proc.pty.kill();
    } else if (proc.child) {
      proc.child.kill('SIGTERM');
    }
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
        pid: proc.pty?.pid ?? proc.child?.pid ?? null,
        isPty: proc.pty !== null,
      });
    }
    return result;
  }

  /** Remove a stopped/errored session. */
  remove(sessionId: string): void {
    const proc = this.sessions.get(sessionId);
    if (!proc) throw new Error(`No agent session: ${sessionId}`);
    if (proc.status === 'running') throw new Error('Cannot remove a running agent — stop it first');
    this.sessions.delete(sessionId);
  }

  /** Kill all running agents (called on daemon shutdown). */
  stopAll(): void {
    for (const [, proc] of this.sessions) {
      if (proc.status === 'running') {
        if (proc.pty) {
          proc.pty.kill();
        } else if (proc.child) {
          proc.child.kill('SIGTERM');
        }
        proc.status = 'stopped';
      }
    }
  }
}
