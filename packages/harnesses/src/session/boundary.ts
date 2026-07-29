/**
 * Control-layer session boundary: register / end against RevDev daemon.
 *
 * Soft-optional: when the socket is down or RPC fails, returns ok:false and
 * never throws — session hooks must not block harness startup/shutdown.
 *
 * Used by Grok (and any equal adapter) SessionStart/SessionEnd. Claude still
 * uses its Studio hook path which calls the same daemon + identity store.
 */

import { hostname } from 'node:os';
import {
  clearDaemonSessionCache,
  clearHookIdentity,
  type HookIdentity,
  readDaemonSessionCache,
  resolveAfterRegister,
  writeDaemonSessionCache,
} from './identity-cache.js';
import { isDaemonSocketPresent, rpcCall } from './rpc.js';
import { signRpc } from './sign.js';

export interface SessionBoundaryResult {
  readonly ok: boolean;
  readonly skipped: boolean;
  readonly agentId?: string;
  readonly reason?: string;
}

export interface RegisterOptions {
  readonly backend: string;
  readonly workDir?: string;
  readonly agentId?: string;
  readonly agentName?: string;
  readonly socketPath?: string;
  readonly ppid?: number | string;
  readonly timeoutMs?: number;
}

export interface EndOptions {
  readonly socketPath?: string;
  readonly ppid?: number | string;
  readonly timeoutMs?: number;
  readonly exitSummary?: string;
  /** When set, end this agent even if cache missing (must have identity). */
  readonly agentId?: string;
}

function defaultAgentId(backend: string): string {
  const host =
    hostname()
      .replace(/[^a-zA-Z0-9_-]/g, '')
      .slice(0, 24) || 'host';
  return `${backend}-${host}-${process.pid}-${Date.now().toString(36)}`;
}

function asStringField(value: unknown): string | undefined {
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}

function asRegisterResult(raw: unknown): {
  agentId: string;
  did?: string;
  publicKeyPem?: string;
  privateKeyPem?: string;
} | null {
  if (!raw || typeof raw !== 'object') return null;
  const o = raw as Record<string, unknown>;
  let sessionId: string | undefined;
  if (o.session && typeof o.session === 'object') {
    sessionId = asStringField((o.session as { id?: unknown }).id);
  }
  const agentId = asStringField(o.agentId) ?? asStringField(o.sessionId) ?? sessionId;
  if (!agentId) return null;
  return {
    agentId,
    did: asStringField(o.did),
    publicKeyPem: asStringField(o.publicKeyPem),
    privateKeyPem: asStringField(o.privateKeyPem),
  };
}

/**
 * Register this process as a daemon session agent.
 * Caches agent id under `~/.local/share/revealui/daemon-sessions/<ppid>.id`
 * (mode 0600; not world-writable /tmp) and signing material under
 * hook-identities when the daemon returns a one-shot key.
 */
export async function sessionRegister(options: RegisterOptions): Promise<SessionBoundaryResult> {
  const socketPath = options.socketPath;
  if (!isDaemonSocketPresent(socketPath)) {
    return { ok: false, skipped: true, reason: 'daemon socket absent' };
  }

  const agentId = options.agentId ?? defaultAgentId(options.backend);
  const params = {
    agentId,
    agentName: options.agentName ?? agentId,
    workDir: options.workDir ?? process.cwd(),
    backend: options.backend,
    pid: process.ppid,
  };

  try {
    const raw = await rpcCall('session.register', params, {
      socketPath,
      timeoutMs: options.timeoutMs ?? 4000,
    });
    const reg = asRegisterResult(raw);
    if (!reg) {
      return { ok: false, skipped: false, reason: 'register returned no agentId' };
    }
    resolveAfterRegister(reg);
    writeDaemonSessionCache(reg.agentId, options.ppid ?? process.ppid);
    return { ok: true, skipped: false, agentId: reg.agentId };
  } catch (err) {
    return {
      ok: false,
      skipped: true,
      reason: err instanceof Error ? err.message : String(err),
    };
  }
}

/**
 * End the cached daemon session (signature-required). Soft if no cache or daemon down.
 */
export async function sessionEnd(options: EndOptions = {}): Promise<SessionBoundaryResult> {
  const socketPath = options.socketPath;
  if (!isDaemonSocketPresent(socketPath)) {
    clearDaemonSessionCache(options.ppid ?? process.ppid);
    return { ok: false, skipped: true, reason: 'daemon socket absent' };
  }

  const agentId = options.agentId ?? readDaemonSessionCache(options.ppid ?? process.ppid);
  if (!agentId) {
    return { ok: false, skipped: true, reason: 'no cached daemon session id' };
  }

  const identity = resolveAfterRegister({ agentId });
  if (!identity) {
    clearDaemonSessionCache(options.ppid ?? process.ppid);
    return {
      ok: false,
      skipped: true,
      agentId,
      reason: 'no signing identity for session.end',
    };
  }

  const params: Record<string, unknown> = {
    actorAgentId: agentId,
    exitSummary: options.exitSummary ?? 'hook-session-end',
  };

  try {
    const signature = signRpc(identity as HookIdentity, 'session.end', params);
    await rpcCall('session.end', params, {
      socketPath,
      timeoutMs: options.timeoutMs ?? 4000,
      signature,
    });
    clearDaemonSessionCache(options.ppid ?? process.ppid);
    clearHookIdentity(agentId);
    return { ok: true, skipped: false, agentId };
  } catch (err) {
    // Still clear cache so we do not leave stale ids; prune reaps daemon rows.
    clearDaemonSessionCache(options.ppid ?? process.ppid);
    return {
      ok: false,
      skipped: false,
      agentId,
      reason: err instanceof Error ? err.message : String(err),
    };
  }
}
