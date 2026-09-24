/**
 * Studio LoopGuard client (GAP-362).
 *
 * Talks to the RevDev daemon on harness.sock (`loop.arm` / `loop.tick` /
 * `loop.stop`). Product paths with no daemon keep today's behavior: a missing
 * socket returns immediately, and a dead or silent socket fails open inside
 * `timeoutMs` without throwing.
 *
 * The daemon owns the no-op counter. `DAEMON_LOOP_NOOP_LIMIT` (3) is that
 * default: after this many consecutive `advanced: false` ticks, `loop.tick`
 * returns `status: not_advancing`. This module does not keep a second counter.
 */

import { randomUUID } from 'node:crypto';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { createConnection } from 'node:net';
import { homedir } from 'node:os';
import { join } from 'node:path';

/** RevDev `DEFAULT_NOOP_LIMIT`. Documented here; the daemon applies it. */
export const DAEMON_LOOP_NOOP_LIMIT = 3;

/**
 * Cadence declaration sent on `loop.arm`. RevDev warns on idle intervals
 * under 60s. Interactive tool loops are not idle polls, so the declaration
 * stays at this floor. The runtime does not sleep for this long.
 */
export const DAEMON_LOOP_INTERVAL_MS = 60_000;

/** Bound for a socket that exists but never answers. */
export const DAEMON_LOOP_TIMEOUT_MS = 750;

/** Used when no Studio session id is cached. Unknown ids are daemon-minted. */
export const PRODUCT_RUNTIME_ACTOR_ID = 'revealui-product-runtime';

const ACTOR_ID_MAX = 256;

export type LoopGuardStatus = 'armed' | 'not_advancing' | 'stopped' | 'unavailable';

export interface LoopGuardSignal {
  readonly attached: boolean;
  readonly status: LoopGuardStatus;
  readonly signal: string | null;
}

export interface LoopGuardTickInput {
  readonly advanced: boolean;
  readonly tokensIn?: number;
  readonly tokensOut?: number;
  readonly costMicros?: number;
}

export interface LoopGuardPort {
  arm(input: { readonly loopId: string; readonly actorAgentId?: string }): Promise<LoopGuardSignal>;
  tick(input: { readonly loopId: string } & LoopGuardTickInput): Promise<LoopGuardSignal>;
  stop(loopId: string): Promise<void>;
}

export interface DaemonLoopGuardConfig {
  /** Defaults to `REVEALUI_SOCKET` or `~/.local/share/revealui/harness.sock`. */
  readonly socketPath?: string;
  /** RPC budget per call when the socket accepts but stays silent. */
  readonly timeoutMs?: number;
  /** `loop.arm` cadence declaration. Defaults to {@link DAEMON_LOOP_INTERVAL_MS}. */
  readonly intervalMs?: number;
  /**
   * Sent only when set. Omitted so the daemon keeps {@link DAEMON_LOOP_NOOP_LIMIT}.
   */
  readonly noopLimit?: number;
  /** Overrides the cached Studio session id and the product fallback. */
  readonly actorAgentId?: string;
}

const UNAVAILABLE: LoopGuardSignal = {
  attached: false,
  status: 'unavailable',
  signal: null,
};

export function defaultHarnessSocketPath(): string {
  return (
    process.env.REVEALUI_SOCKET ?? join(homedir(), '.local', 'share', 'revealui', 'harness.sock')
  );
}

export function isHarnessSocketPresent(socketPath: string = defaultHarnessSocketPath()): boolean {
  try {
    if (!existsSync(socketPath)) return false;
    return Boolean(statSync(socketPath));
  } catch {
    return false;
  }
}

/**
 * Studio session id written by harness SessionStart.
 * The hook process records the parent pid; in-process callers record ppid.
 */
export function readStudioActorId(): string | null {
  const dir =
    process.env.REVDEV_DAEMON_SESSION_DIR ??
    join(homedir(), '.local', 'share', 'revealui', 'daemon-sessions');
  const keys = [process.pid, process.ppid];
  for (const key of keys) {
    try {
      const raw = readFileSync(join(dir, `${key}.id`), 'utf8');
      const id = usableActorId(raw);
      if (id) return id;
    } catch {
      /* absent */
    }
  }
  return null;
}

export function studioLoopId(taskId: string): string {
  const safe = taskId.length > 120 ? taskId.slice(0, 120) : taskId;
  return `agent-runtime:${safe}:${randomUUID()}`;
}

/**
 * An iteration advances when the model finishes the task or runs at least
 * one tool that was not a duplicate of an earlier call in the same task.
 */
export function iterationAdvanced(input: {
  readonly completed: boolean;
  readonly newToolExecutions: number;
}): boolean {
  return input.completed || input.newToolExecutions > 0;
}

export function createDaemonLoopGuard(config: DaemonLoopGuardConfig = {}): LoopGuardPort {
  const socketPath = config.socketPath ?? defaultHarnessSocketPath();
  const timeoutMs = config.timeoutMs ?? DAEMON_LOOP_TIMEOUT_MS;
  const intervalMs = config.intervalMs ?? DAEMON_LOOP_INTERVAL_MS;
  const noopLimit = config.noopLimit;
  let attached = false;
  let disabled = false;
  let actorAgentId = usableActorId(config.actorAgentId ?? '') ?? PRODUCT_RUNTIME_ACTOR_ID;

  async function call(method: string, params: Record<string, unknown>): Promise<unknown> {
    return rpcCall(socketPath, method, params, timeoutMs);
  }

  return {
    async arm(input) {
      if (disabled) return UNAVAILABLE;
      const explicit = usableActorId(input.actorAgentId ?? config.actorAgentId ?? '');
      actorAgentId = explicit ?? readStudioActorId() ?? PRODUCT_RUNTIME_ACTOR_ID;
      if (!isHarnessSocketPresent(socketPath)) {
        disabled = true;
        return UNAVAILABLE;
      }
      const params: Record<string, unknown> = {
        loopId: input.loopId,
        intervalMs,
        actorAgentId,
      };
      if (typeof noopLimit === 'number' && noopLimit > 0) {
        params.noopLimit = Math.floor(noopLimit);
      }
      try {
        const result = await call('loop.arm', params);
        attached = true;
        return signalFromResult(result);
      } catch {
        disabled = true;
        attached = false;
        return UNAVAILABLE;
      }
    },

    async tick(input) {
      if (!attached || disabled) return UNAVAILABLE;
      const params: Record<string, unknown> = {
        loopId: input.loopId,
        advanced: input.advanced,
        actorAgentId,
      };
      if (typeof input.tokensIn === 'number' && input.tokensIn > 0) {
        params.tokensIn = Math.floor(input.tokensIn);
      }
      if (typeof input.tokensOut === 'number' && input.tokensOut > 0) {
        params.tokensOut = Math.floor(input.tokensOut);
      }
      if (typeof input.costMicros === 'number' && input.costMicros > 0) {
        params.costMicros = Math.floor(input.costMicros);
      }
      try {
        const result = await call('loop.tick', params);
        return signalFromResult(result);
      } catch {
        disabled = true;
        return UNAVAILABLE;
      }
    },

    async stop(loopId) {
      if (!attached || disabled) return;
      try {
        await call('loop.stop', { loopId, actorAgentId });
      } catch {
        disabled = true;
      }
    },
  };
}

function usableActorId(raw: string): string | null {
  const id = raw.trim();
  if (id.length === 0 || id.length > ACTOR_ID_MAX) return null;
  if (id.includes('/') || id.includes('\\') || id.includes('\0')) return null;
  return id;
}

function signalFromResult(result: unknown): LoopGuardSignal {
  if (!result || typeof result !== 'object') {
    return { attached: true, status: 'armed', signal: null };
  }
  const loop = (result as { loop?: unknown }).loop;
  if (!loop || typeof loop !== 'object') {
    return { attached: true, status: 'armed', signal: null };
  }
  const statusRaw = (loop as { status?: unknown }).status;
  const signalRaw = (loop as { lastSignal?: unknown }).lastSignal;
  const signal = typeof signalRaw === 'string' ? signalRaw : null;
  if (statusRaw === 'not_advancing' || statusRaw === 'stopped' || statusRaw === 'armed') {
    return { attached: true, status: statusRaw, signal };
  }
  return { attached: true, status: 'armed', signal };
}

function rpcCall(
  socketPath: string,
  method: string,
  params: Record<string, unknown>,
  timeoutMs: number,
): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const socket = createConnection(socketPath);
    let buffer = '';
    let settled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const finish = (err: Error | null, value?: unknown): void => {
      if (settled) return;
      settled = true;
      if (timer) clearTimeout(timer);
      socket.destroy();
      if (err) reject(err);
      else resolve(value);
    };
    timer = setTimeout(() => {
      finish(new Error(`loop guard RPC timeout after ${timeoutMs}ms`));
    }, timeoutMs);

    socket.on('connect', () => {
      const frame = JSON.stringify({ jsonrpc: '2.0', id: 1, method, params });
      socket.write(`${frame}\n`);
    });

    socket.on('data', (chunk) => {
      buffer += chunk.toString();
      const lines = buffer.split('\n');
      buffer = lines.pop() ?? '';
      for (const line of lines) {
        if (!line.trim()) continue;
        try {
          const resp = JSON.parse(line) as {
            result?: unknown;
            error?: { message?: string };
          };
          if (resp.error) {
            finish(new Error(resp.error.message ?? 'loop guard RPC error'));
          } else {
            finish(null, resp.result);
          }
        } catch (err) {
          finish(err instanceof Error ? err : new Error(String(err)));
        }
        return;
      }
    });

    socket.on('error', (err) => {
      finish(err);
    });
  });
}
