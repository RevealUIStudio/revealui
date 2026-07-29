/**
 * GAP-459 S2 — peer-context panel for session start.
 *
 * Fetches `context.snapshot` (S1) when available; falls back to `session.list`
 * if the daemon is older than S1. When the daemon is down, returns a visible
 * unavailable result — never a silent empty peer set (ADR 2026-07-28).
 */

import { isDaemonSocketPresent, rpcCall } from './rpc.js';

export type PeerContextStatus = 'available' | 'unavailable' | 'degraded';

export interface PeerSessionLine {
  readonly agentId: string;
  readonly task: string;
  readonly active?: boolean;
  readonly isSelf?: boolean;
}

export interface PeerReservationLine {
  readonly agentId: string;
  readonly path: string;
}

export interface PeerFindingLine {
  readonly agentId: string;
  readonly eventType: string;
  readonly summary: string;
}

export interface PeerContextSnapshot {
  readonly status: PeerContextStatus;
  /** Short reason when unavailable/degraded (shown in WARN line). */
  readonly reason?: string;
  readonly selfAgentId?: string | null;
  readonly peers: readonly PeerSessionLine[];
  readonly reservations: readonly PeerReservationLine[];
  readonly findings: readonly PeerFindingLine[];
  readonly source: 'context.snapshot' | 'session.list' | 'none';
}

export interface FetchPeerContextOptions {
  readonly socketPath?: string;
  readonly actorAgentId?: string;
  readonly timeoutMs?: number;
  readonly includeSelf?: boolean;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function str(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value : fallback;
}

function asPeerFromSnapshotRow(row: unknown): PeerSessionLine | null {
  const r = asRecord(row);
  if (!r) return null;
  const agentId = str(r.agentId) || str(r.id);
  if (!agentId) return null;
  return {
    agentId,
    task: str(r.task, '(no task)'),
    active: r.active === true || r.active === 't',
    isSelf: r.isSelf === true,
  };
}

function asFinding(row: unknown): PeerFindingLine | null {
  const r = asRecord(row);
  if (!r) return null;
  const agentId = str(r.agentId) || str(r.agent_id);
  const eventType = str(r.eventType) || str(r.event_type);
  if (!agentId || !eventType) return null;
  const payload = asRecord(r.payload) ?? {};
  const summary = str(payload.summary) || str(payload.message) || eventType;
  return { agentId, eventType, summary };
}

function asReservation(row: unknown): PeerReservationLine | null {
  const r = asRecord(row);
  if (!r) return null;
  const agentId = str(r.agentId) || str(r.agent_id);
  const path = str(r.path) || str(r.file_path);
  if (!agentId || !path) return null;
  return { agentId, path };
}

/**
 * Load peer context. Soft-optional: never throws.
 */
export async function fetchPeerContext(
  options: FetchPeerContextOptions = {},
): Promise<PeerContextSnapshot> {
  const socketPath = options.socketPath;
  if (!isDaemonSocketPresent(socketPath)) {
    return {
      status: 'unavailable',
      reason: 'daemon socket absent',
      peers: [],
      reservations: [],
      findings: [],
      source: 'none',
    };
  }

  const actorAgentId = options.actorAgentId;
  const timeoutMs = options.timeoutMs ?? 4000;

  try {
    const raw = await rpcCall(
      'context.snapshot',
      {
        actorAgentId,
        includeSelf: options.includeSelf === true,
      },
      { socketPath, timeoutMs },
    );
    const o = asRecord(raw);
    if (!o) {
      return {
        status: 'degraded',
        reason: 'context.snapshot returned empty body',
        peers: [],
        reservations: [],
        findings: [],
        source: 'context.snapshot',
      };
    }

    const peersRaw = Array.isArray(o.peers) ? o.peers : [];
    const peers = peersRaw
      .map(asPeerFromSnapshotRow)
      .filter((p): p is PeerSessionLine => p != null);

    const reservations = (Array.isArray(o.reservations) ? o.reservations : [])
      .map(asReservation)
      .filter((r): r is PeerReservationLine => r != null);

    const findings = (Array.isArray(o.findings) ? o.findings : [])
      .map(asFinding)
      .filter((f): f is PeerFindingLine => f != null);

    return {
      status: 'available',
      selfAgentId: actorAgentId ?? (typeof o.selfAgentId === 'string' ? o.selfAgentId : null),
      peers,
      reservations,
      findings,
      source: 'context.snapshot',
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    // S1 not on this daemon yet → fall back to session.list presence only.
    if (/Method not found|context\.snapshot|not found/i.test(message)) {
      return fetchPeersViaSessionList({
        socketPath,
        actorAgentId,
        timeoutMs,
        reason: 'context.snapshot unavailable; using session.list',
      });
    }
    // License / Pro gate or other soft failures: still visible.
    if (/-32001|license|Pro/i.test(message)) {
      return {
        status: 'degraded',
        reason: `peer snapshot needs Pro coordination license (${message})`,
        peers: [],
        reservations: [],
        findings: [],
        source: 'none',
      };
    }
    return {
      status: 'unavailable',
      reason: message,
      peers: [],
      reservations: [],
      findings: [],
      source: 'none',
    };
  }
}

async function fetchPeersViaSessionList(options: {
  socketPath?: string;
  actorAgentId?: string;
  timeoutMs: number;
  reason: string;
}): Promise<PeerContextSnapshot> {
  try {
    const raw = await rpcCall(
      'session.list',
      {},
      {
        socketPath: options.socketPath,
        timeoutMs: options.timeoutMs,
      },
    );
    const o = asRecord(raw);
    const sessions = Array.isArray(o?.sessions) ? o.sessions : [];
    const peers: PeerSessionLine[] = [];
    for (const row of sessions) {
      const r = asRecord(row);
      if (!r) continue;
      const id = str(r.id) || str(r.agentId) || str(r.agent_id);
      if (!id) continue;
      if (options.actorAgentId && id === options.actorAgentId) continue;
      peers.push({
        agentId: id,
        task: str(r.task, '(no task)'),
        active: r.active === true || r.active === 't',
      });
    }
    return {
      status: 'degraded',
      reason: options.reason,
      selfAgentId: options.actorAgentId ?? null,
      peers,
      reservations: [],
      findings: [],
      source: 'session.list',
    };
  } catch (err) {
    return {
      status: 'unavailable',
      reason: err instanceof Error ? err.message : String(err),
      peers: [],
      reservations: [],
      findings: [],
      source: 'none',
    };
  }
}

/**
 * Format a multi-line peer panel for SessionStart stdout/stderr.
 * Always produces at least one line so absence of peers is not silent when
 * the layer is unavailable.
 */
export function formatPeerPanel(snapshot: PeerContextSnapshot): string {
  const lines: string[] = [];

  if (snapshot.status === 'unavailable') {
    lines.push(
      `[peer-context] WARN: coordination layer unavailable (${snapshot.reason ?? 'unknown'}). Proceeding without peer awareness.`,
    );
    return `${lines.join('\n')}\n`;
  }

  if (snapshot.status === 'degraded') {
    lines.push(
      `[peer-context] WARN: degraded peer view (${snapshot.reason ?? 'partial'}). Autonomy continues.`,
    );
  } else {
    lines.push(`[peer-context] ok (source=${snapshot.source})`);
  }

  if (snapshot.peers.length === 0) {
    lines.push('[peer-context] peers: none other active on this machine');
  } else {
    lines.push(`[peer-context] peers (${snapshot.peers.length}):`);
    for (const p of snapshot.peers.slice(0, 12)) {
      const flag = p.active === false ? ' idle' : '';
      const task = p.task.replace(/\s+/g, ' ').slice(0, 80);
      lines.push(`  - ${p.agentId}${flag}: ${task}`);
    }
    if (snapshot.peers.length > 12) {
      lines.push(`  … +${snapshot.peers.length - 12} more`);
    }
  }

  if (snapshot.reservations.length > 0) {
    lines.push(`[peer-context] file claims (${snapshot.reservations.length}):`);
    for (const r of snapshot.reservations.slice(0, 8)) {
      lines.push(`  - ${r.agentId}: ${r.path}`);
    }
  }

  if (snapshot.findings.length > 0) {
    lines.push(`[peer-context] recent findings (${snapshot.findings.length}):`);
    for (const f of snapshot.findings.slice(0, 5)) {
      lines.push(`  - ${f.agentId} ${f.eventType}: ${f.summary.slice(0, 100)}`);
    }
  }

  return `${lines.join('\n')}\n`;
}

/** Fetch + format in one call for CLI/hooks. */
export async function renderPeerPanel(options: FetchPeerContextOptions = {}): Promise<string> {
  const snap = await fetchPeerContext(options);
  return formatPeerPanel(snap);
}
