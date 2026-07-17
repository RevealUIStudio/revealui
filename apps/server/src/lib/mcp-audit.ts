/**
 * Governed-MCP audit writer (GAP-371 Phase 1).
 *
 * Writes one hash-chained receipt to `audit_log` for every `tools/call` on the
 * `/api/mcp` endpoint. Reuses the failure classifier + rolling-ratio tracker
 * that every other audit write path funnels through
 * (`classifyAuditWriteFailure` / `recordAuditWriteResult`).
 *
 * `recordMcpToolAudit` THROWS when the write does not land, so the caller (the
 * content factory's audit sink) can fail closed for mutating tools and degrade
 * for reads — the factory owns that policy split, not this module.
 *
 * Hash chain. Each receipt is signed HMAC-SHA256 over its immutable fields plus
 * the previous receipt's signature, so tampering with any row invalidates every
 * later signature. The MCP receipt stream keeps its OWN per-process chain head
 * (`lastMcpSignature`), independent of the security-event chain in
 * `postgres-audit-storage.ts`. This is INTENTIONAL duplication, not drift: the
 * two are distinct append streams interleaved in one table (exactly as the
 * unsigned credential-event rows already coexist there), each independently
 * verifiable by walking its own eventType stream. Consolidating both onto a
 * single shared chain head is a deliberate future refactor, not a Phase-1
 * concern (audit-first §Mindfulness: classified INTENTIONAL).
 *
 * Concurrency (GAP-371 Phase 2, Finding-1 fix). The chain head is a read-modify-
 * write: read `lastMcpSignature`, sign against it, INSERT, then advance the head
 * on success. Two `recordMcpToolAudit` calls racing across the insert `await`
 * would both read the same head and both write it as `previousSignature`, FORKING
 * the chain (two rows chained to one parent, later tampering on a stranded branch
 * undetectable). Phase 2 turns on the fail-closed mutating-audit path, so every
 * append is on the hot path. The fix serializes appends through a promise-chain
 * mutex (`appendQueue`): each call's critical section runs only after the prior
 * one has settled, so the head is read and advanced atomically per process. A
 * failed write does NOT advance the head and does NOT poison the queue — the next
 * append chains from the last DURABLE signature, leaving no gap.
 *
 * Verification tolerates the per-process segmentation this design already has: a
 * serverless deployment runs many processes, each an independent segment rooted
 * at `previousSignature = null`. `verifyMcpAuditChain` verifies one segment (one
 * process's rows) as a single unbroken, unforked, tamper-evident chain.
 */

import { createHmac, randomUUID } from 'node:crypto';
import { classifyAuditWriteFailure, recordAuditWriteResult } from '@revealui/core/security';
import { getClient } from '@revealui/db';
import { auditLog } from '@revealui/db/schema';

export type McpAuditOutcome = 'invoked' | 'denied' | 'failed';

const OUTCOME_TO_EVENT_TYPE: Readonly<Record<McpAuditOutcome, string>> = {
  invoked: 'mcp:tool:invoked',
  denied: 'mcp:tool:denied',
  failed: 'mcp:tool:failed',
};

export interface McpAuditInput {
  outcome: McpAuditOutcome;
  /** MCP client name from the `initialize` handshake (e.g. `opencode`). */
  clientName: string;
  /** MCP session id the call routed through. */
  sessionId?: string;
  /** The user resolved from the verified bearer token (never client input). */
  userId: string;
  /** Server-derived account, or null when the caller has no account. */
  accountId: string | null;
  tool: string;
  /** sha256 (hex) of the canonical JSON of the raw args. Raw args never stored. */
  argsDigest: string;
  /** Allowlisted non-secret scalars (collection, site_id). */
  scalars: Record<string, string>;
  durationMs: number;
  httpStatus?: number;
  /** Why a call was denied (`authz` / `rate-limit`), when `outcome === 'denied'`. */
  reason?: string;
}

/** Per-process hash-chain head for the MCP receipt stream. */
let lastMcpSignature: string | null = null;

/**
 * Serialization gate for the chain-head read-modify-write (Finding-1). Appends
 * run one at a time: each `recordMcpToolAudit` chains its critical section after
 * the previous one settles, so concurrent calls cannot both read the same head
 * and fork the chain. A rejected append is caught HERE (so the queue is never
 * poisoned) while the original promise still rejects to the caller.
 */
let appendQueue: Promise<void> = Promise.resolve();

/** Test-only reset of the chain head and serialization queue. */
export function __resetMcpAuditChainForTest(): void {
  lastMcpSignature = null;
  appendQueue = Promise.resolve();
}

function getAuditSecret(): string {
  const secret = process.env.REVEALUI_AUDIT_HMAC_SECRET ?? process.env.REVEALUI_SECRET;
  if (!secret) {
    throw new Error(
      'Audit HMAC signing requires REVEALUI_AUDIT_HMAC_SECRET (or REVEALUI_SECRET fallback) ' +
        'to be set. MCP receipts are non-optional; a missing key fails loud rather than ' +
        'silently writing an unsigned row.',
    );
  }
  return secret;
}

/**
 * Deterministic JSON with object keys sorted recursively. The receipt payload
 * is stored as `jsonb`, which does NOT preserve key insertion order on
 * readback, so signing over `JSON.stringify(payload)` directly would make a
 * row un-verifiable from storage. Signing over the CANONICAL form makes the
 * signature reproducible from the DB regardless of jsonb's reordering. No
 * regex; a manual recursive serializer.
 */
function canonicalJson(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value) ?? 'null';
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  const entries = Object.entries(value as Record<string, unknown>).sort((a, b) =>
    a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0,
  );
  return `{${entries.map(([k, v]) => `${JSON.stringify(k)}:${canonicalJson(v)}`).join(',')}}`;
}

/**
 * HMAC-SHA256 over the receipt's immutable fields chained to the previous
 * signature. The payload is canonicalized (sorted keys) so the signature is
 * reproducible from the jsonb-stored row (`verifyMcpAuditChain`).
 */
function signChained(
  entry: {
    timestamp: string;
    eventType: string;
    severity: string;
    agentId: string;
    payload: unknown;
  },
  previousSig: string | null,
  secret: string,
): string {
  const canonical = JSON.stringify({
    timestamp: entry.timestamp,
    eventType: entry.eventType,
    severity: entry.severity,
    agentId: entry.agentId,
    payload: canonicalJson(entry.payload),
    previousSignature: previousSig ?? '',
  });
  return createHmac('sha256', secret).update(canonical).digest('hex');
}

/**
 * Append one governed-MCP receipt. Throws on a failed write (already classified
 * + counted) so the caller can fail closed. The chain head only advances on a
 * durable write, so a failed write leaves no gap.
 *
 * Appends are serialized (Finding-1): concurrent calls queue so the chain-head
 * read-modify-write is atomic per process and can never fork.
 */
export async function recordMcpToolAudit(input: McpAuditInput): Promise<void> {
  const run = appendQueue.then(() => appendReceipt(input));
  // Keep the queue alive regardless of this write's outcome (a rejection here
  // must not poison later appends), while still surfacing it to the caller.
  appendQueue = run.then(
    () => undefined,
    () => undefined,
  );
  return run;
}

/** The serialized critical section: read head → sign → insert → advance head. */
async function appendReceipt(input: McpAuditInput): Promise<void> {
  const id = randomUUID();
  const timestamp = new Date();
  const eventType = OUTCOME_TO_EVENT_TYPE[input.outcome];
  const severity = input.outcome === 'invoked' ? 'info' : 'warn';
  const agentId = `mcp:${input.clientName}`;

  const payload: Record<string, unknown> = {
    userId: input.userId,
    accountId: input.accountId,
    tool: input.tool,
    argsDigest: input.argsDigest,
    outcome: input.outcome,
    durationMs: input.durationMs,
    ...input.scalars,
  };
  if (input.httpStatus !== undefined) payload.httpStatus = input.httpStatus;
  if (input.reason !== undefined) payload.reason = input.reason;

  const secret = getAuditSecret();
  const previousSignature = lastMcpSignature;
  const signature = signChained(
    { timestamp: timestamp.toISOString(), eventType, severity, agentId, payload },
    previousSignature,
    secret,
  );

  try {
    await getClient()
      .insert(auditLog)
      .values({
        id,
        timestamp,
        eventType,
        severity,
        agentId,
        taskId: null,
        sessionId: input.sessionId ?? null,
        payload,
        policyViolations: [],
        signature,
        previousSignature,
      });
    lastMcpSignature = signature;
    recordAuditWriteResult({ ok: true, eventId: id, eventType });
  } catch (err) {
    recordAuditWriteResult({
      ok: false,
      reason: classifyAuditWriteFailure(err),
      eventId: id,
      eventType,
    });
    throw err;
  }
}

/** A stored MCP receipt row, as read back from `audit_log`. */
export interface McpAuditChainRow {
  timestamp: Date | string;
  eventType: string;
  severity: string;
  agentId: string;
  payload: unknown;
  signature: string | null;
  previousSignature: string | null;
}

/** Result of verifying one process-segment of the MCP receipt chain. */
export interface McpAuditChainVerification {
  valid: boolean;
  reason?: string;
}

function normalizeTimestamp(value: Date | string): string {
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

/**
 * Verify one per-process segment of the MCP receipt chain (Finding-1). Given the
 * rows of a single process's stream (any order), assert they form ONE unbroken,
 * unforked, tamper-evident chain:
 *
 *  - every row's stored signature recomputes from its own fields + its
 *    `previousSignature` (tamper detection);
 *  - no two rows share a `previousSignature` and no two share a `signature`
 *    (fork detection — the exact failure a racing read-modify-write produces);
 *  - exactly one root (`previousSignature === null`) and every row is reachable
 *    by following signature links from it (single unbroken path).
 *
 * Order-independent: it reconstructs the linkage rather than trusting storage
 * order (there is no monotonic sequence column on `audit_log`).
 */
export function verifyMcpAuditChain(
  rows: readonly McpAuditChainRow[],
  secret: string,
): McpAuditChainVerification {
  if (rows.length === 0) return { valid: true };

  const bySignature = new Map<string, McpAuditChainRow>();
  const seenPrevious = new Set<string>();
  let root: McpAuditChainRow | null = null;

  for (const row of rows) {
    if (typeof row.signature !== 'string') {
      return { valid: false, reason: 'row is missing a signature' };
    }
    const expected = signChained(
      {
        timestamp: normalizeTimestamp(row.timestamp),
        eventType: row.eventType,
        severity: row.severity,
        agentId: row.agentId,
        payload: row.payload,
      },
      row.previousSignature,
      secret,
    );
    if (expected !== row.signature) {
      return { valid: false, reason: `signature mismatch for row ${row.signature}` };
    }
    if (bySignature.has(row.signature)) {
      return { valid: false, reason: `duplicate signature ${row.signature}` };
    }
    bySignature.set(row.signature, row);

    const prev = row.previousSignature;
    if (prev === null) {
      if (root) return { valid: false, reason: 'chain has more than one root (fork)' };
      root = row;
    } else {
      if (seenPrevious.has(prev)) {
        return { valid: false, reason: `two rows chain to the same parent ${prev} (fork)` };
      }
      seenPrevious.add(prev);
    }
  }

  if (!root) return { valid: false, reason: 'chain has no root' };

  // Walk from the root following signature → next(previousSignature) links; the
  // whole segment must be reachable in one unbroken path.
  let reachable = 0;
  let cursor: McpAuditChainRow | undefined = root;
  const nextByPrevious = new Map<string, McpAuditChainRow>();
  for (const row of rows) {
    if (row.previousSignature !== null) nextByPrevious.set(row.previousSignature, row);
  }
  while (cursor) {
    reachable += 1;
    cursor = cursor.signature ? nextByPrevious.get(cursor.signature) : undefined;
  }
  if (reachable !== rows.length) {
    return {
      valid: false,
      reason: `chain is broken: ${reachable} of ${rows.length} rows reachable`,
    };
  }

  return { valid: true };
}
