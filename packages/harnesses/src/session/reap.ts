/**
 * GAP-459 abandoned-session reaper (control layer).
 *
 * 1. List live daemon sessions
 * 2. Cold-archive each heartbeat-idle candidate
 * 3. Signed `harness.prune` with heartbeatStaleSeconds (daemon ends them)
 *
 * Soft-optional when the daemon is down. Never throws to callers that ignore
 * the result; CLI prints status.
 */

import { archiveSessionExit } from './archive-exit.js';
import { sessionRegister } from './boundary.js';
import {
  type HookIdentity,
  loadHookIdentity,
  readDaemonSessionCache,
  resolveAfterRegister,
} from './identity-cache.js';
import { PEER_LIVE_STALE_SECONDS } from './peer-context.js';
import { isDaemonSocketPresent, rpcCall } from './rpc.js';
import { signRpc } from './sign.js';

/** Default matches daemon MIN_HEARTBEAT_STALE_SECONDS (1 hour). */
export const DEFAULT_HEARTBEAT_STALE_SECONDS = 3600;

export interface ReapOptions {
  readonly socketPath?: string;
  readonly timeoutMs?: number;
  readonly backend?: string;
  readonly workDir?: string;
  readonly ppid?: number | string;
  /** Seconds of updated_at idle before reaping. Floored at 3600 by daemon. */
  readonly heartbeatStaleSeconds?: number;
  /** Start-age arm for classic prune (days). Default 7. */
  readonly staleDays?: number;
  readonly hardDeleteDays?: number;
  /** Dry-run: archive candidates only, skip harness.prune. */
  readonly dryRun?: boolean;
}

export interface ReapResult {
  readonly ok: boolean;
  readonly skipped: boolean;
  readonly reason?: string;
  readonly candidates: number;
  readonly archived: number;
  readonly aged?: number;
  readonly deleted?: number;
  readonly heartbeatStaleSeconds?: number;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function str(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

function num(value: unknown): number | undefined {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim() !== '') {
    const n = Number(value);
    if (Number.isFinite(n)) return n;
  }
  return undefined;
}

/**
 * True when a session.list row looks abandoned (same class as peer-panel hide).
 */
export function isAbandonedSessionRow(
  row: Record<string, unknown>,
  heartbeatStaleSeconds: number,
  selfAgentId?: string | null,
): boolean {
  const id = str(row.id) || str(row.agentId) || str(row.agent_id);
  if (!id) return false;
  if (selfAgentId && id === selfAgentId) return false;
  if (row.active === true || row.active === 't') return false;
  const stale = num(row.staleSeconds) ?? num(row.stale_seconds);
  if (stale !== undefined) return stale >= heartbeatStaleSeconds;
  // Without staleSeconds, treat non-active as abandoned only if we have no active flag true
  return row.active === false || row.active === 'f';
}

export async function sessionReap(options: ReapOptions = {}): Promise<ReapResult> {
  const socketPath = options.socketPath;
  const heartbeatStaleSeconds = Math.max(
    DEFAULT_HEARTBEAT_STALE_SECONDS,
    Math.floor(options.heartbeatStaleSeconds ?? DEFAULT_HEARTBEAT_STALE_SECONDS),
  );
  const staleDays = Math.max(1, Math.floor(options.staleDays ?? 7));
  const hardDeleteDays = Math.max(1, Math.floor(options.hardDeleteDays ?? 30));
  const timeoutMs = options.timeoutMs ?? 8000;
  const ppid = options.ppid ?? process.ppid;

  if (!isDaemonSocketPresent(socketPath)) {
    return {
      ok: false,
      skipped: true,
      reason: 'daemon socket absent',
      candidates: 0,
      archived: 0,
    };
  }

  // Ensure we have a signed identity for harness.prune.
  let agentId = readDaemonSessionCache(ppid);
  let identity: HookIdentity | null = agentId ? loadHookIdentity(agentId) : null;
  if (!identity) {
    const reg = await sessionRegister({
      backend: options.backend ?? 'grok',
      workDir: options.workDir ?? process.cwd(),
      socketPath,
      ppid,
      timeoutMs,
    });
    if (!reg.ok || !reg.agentId) {
      return {
        ok: false,
        skipped: true,
        reason: reg.reason ?? 'could not register reaper identity',
        candidates: 0,
        archived: 0,
      };
    }
    agentId = reg.agentId;
    identity = resolveAfterRegister({ agentId }) ?? loadHookIdentity(agentId);
  }
  if (!identity || !agentId) {
    return {
      ok: false,
      skipped: true,
      reason: 'no signing identity for harness.prune',
      candidates: 0,
      archived: 0,
    };
  }

  let listRaw: unknown;
  try {
    listRaw = await rpcCall('session.list', {}, { socketPath, timeoutMs });
  } catch (err) {
    return {
      ok: false,
      skipped: false,
      reason: err instanceof Error ? err.message : String(err),
      candidates: 0,
      archived: 0,
    };
  }

  const sessions = Array.isArray(asRecord(listRaw)?.sessions)
    ? (asRecord(listRaw)!.sessions as unknown[])
    : [];
  const candidates: Array<{ id: string; task: string; staleSeconds?: number }> = [];
  for (const row of sessions) {
    const r = asRecord(row);
    if (!r) continue;
    if (!isAbandonedSessionRow(r, heartbeatStaleSeconds, agentId)) continue;
    const id = str(r.id) || str(r.agentId);
    candidates.push({
      id,
      task: str(r.task) || '(no task)',
      staleSeconds: num(r.staleSeconds) ?? num(r.stale_seconds),
    });
  }

  let archived = 0;
  for (const c of candidates) {
    const res = archiveSessionExit({
      agentId: c.id,
      endedAt: new Date().toISOString(),
      exitSummary: 'reaped-abandoned',
      backend: options.backend,
      workDir: c.task,
      task: c.task,
      ppid,
      source: 'session.reap',
      daemonEnded: false,
      notes: `candidate staleSeconds=${c.staleSeconds ?? '?'} heartbeatFloor=${heartbeatStaleSeconds}`,
    });
    if (res.ok) archived += 1;
  }

  if (options.dryRun) {
    return {
      ok: true,
      skipped: false,
      reason: 'dry-run: archived candidates only; prune skipped',
      candidates: candidates.length,
      archived,
      heartbeatStaleSeconds,
    };
  }

  const pruneParams: Record<string, unknown> = {
    actorAgentId: agentId,
    staleDays,
    hardDeleteDays,
    heartbeatStaleSeconds,
  };

  try {
    const signature = signRpc(identity, 'harness.prune', pruneParams);
    const result = (await rpcCall('harness.prune', pruneParams, {
      socketPath,
      timeoutMs: Math.max(timeoutMs, 15_000),
      signature,
    })) as { aged?: number; deleted?: number; heartbeatStaleSeconds?: number };

    return {
      ok: true,
      skipped: false,
      candidates: candidates.length,
      archived,
      aged: typeof result.aged === 'number' ? result.aged : undefined,
      deleted: typeof result.deleted === 'number' ? result.deleted : undefined,
      heartbeatStaleSeconds:
        typeof result.heartbeatStaleSeconds === 'number'
          ? result.heartbeatStaleSeconds
          : heartbeatStaleSeconds,
    };
  } catch (err) {
    return {
      ok: false,
      skipped: false,
      reason: err instanceof Error ? err.message : String(err),
      candidates: candidates.length,
      archived,
      heartbeatStaleSeconds,
    };
  }
}

// Re-export panel constant for callers that want display-aligned thresholds.
export { PEER_LIVE_STALE_SECONDS };
