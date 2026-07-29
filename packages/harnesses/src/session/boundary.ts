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
import { archiveSessionExit } from './archive-exit.js';
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
  /** Optional backend label for cold archive (e.g. grok, claude-code). */
  readonly backend?: string;
  /** Optional work dir / task captured at exit for the archive record. */
  readonly workDir?: string;
  readonly task?: string;
  /** Skip cold-archive write (tests). Default false. */
  readonly skipArchive?: boolean;
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
 * End the cached daemon session (signature-required), then archive the exit
 * into the RevFleet cold session store so live peer lists stay unpolluted.
 * Soft if no cache or daemon down — archive still runs when agentId is known.
 */
export async function sessionEnd(options: EndOptions = {}): Promise<SessionBoundaryResult> {
  const socketPath = options.socketPath;
  const exitSummary = options.exitSummary ?? 'hook-session-end';
  const ppid = options.ppid ?? process.ppid;

  if (!isDaemonSocketPresent(socketPath)) {
    const agentId = options.agentId ?? readDaemonSessionCache(ppid);
    if (agentId && !options.skipArchive) {
      archiveSessionExit({
        agentId,
        endedAt: new Date().toISOString(),
        exitSummary,
        backend: options.backend,
        workDir: options.workDir ?? process.cwd(),
        task: options.task,
        ppid,
        source: 'session.end',
        daemonEnded: false,
        notes: 'daemon socket absent; archived without session.end RPC',
      });
    }
    clearDaemonSessionCache(ppid);
    return { ok: false, skipped: true, reason: 'daemon socket absent', agentId };
  }

  const agentId = options.agentId ?? readDaemonSessionCache(ppid);
  if (!agentId) {
    return { ok: false, skipped: true, reason: 'no cached daemon session id' };
  }

  const identity = resolveAfterRegister({ agentId });
  if (!identity) {
    if (!options.skipArchive) {
      archiveSessionExit({
        agentId,
        endedAt: new Date().toISOString(),
        exitSummary,
        backend: options.backend,
        workDir: options.workDir ?? process.cwd(),
        task: options.task,
        ppid,
        source: 'session.end',
        daemonEnded: false,
        notes: 'no signing identity; cache cleared; prune may reap daemon row',
      });
    }
    clearDaemonSessionCache(ppid);
    return {
      ok: false,
      skipped: true,
      agentId,
      reason: 'no signing identity for session.end',
    };
  }

  const params: Record<string, unknown> = {
    actorAgentId: agentId,
    exitSummary,
  };

  let daemonEnded = false;
  let endError: string | undefined;
  try {
    const signature = signRpc(identity as HookIdentity, 'session.end', params);
    await rpcCall('session.end', params, {
      socketPath,
      timeoutMs: options.timeoutMs ?? 4000,
      signature,
    });
    daemonEnded = true;
  } catch (err) {
    endError = err instanceof Error ? err.message : String(err);
  }

  // Always clear local cache after an exit attempt so peers do not keep a
  // stale "live" claim for this process.
  clearDaemonSessionCache(ppid);
  clearHookIdentity(agentId);

  if (!options.skipArchive) {
    const archived = archiveSessionExit({
      agentId,
      endedAt: new Date().toISOString(),
      exitSummary,
      backend: options.backend,
      workDir: options.workDir ?? process.cwd(),
      task: options.task,
      ppid,
      source: 'session.end',
      daemonEnded,
      notes: endError ? `session.end RPC failed: ${endError}` : undefined,
    });
    if (archived.ok && archived.path) {
      // Visible one-liner so SessionEnd logs show the archive path.
      process.stderr.write(`[session-archive] wrote ${archived.path}\n`);
    } else if (!archived.ok) {
      process.stderr.write(
        `[session-archive] WARN: cold archive failed (${archived.reason ?? 'unknown'})\n`,
      );
    }
  }

  if (daemonEnded) {
    return { ok: true, skipped: false, agentId };
  }
  return {
    ok: false,
    skipped: false,
    agentId,
    reason: endError ?? 'session.end failed',
  };
}
