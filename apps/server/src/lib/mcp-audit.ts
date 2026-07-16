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
}

/** Per-process hash-chain head for the MCP receipt stream. */
let lastMcpSignature: string | null = null;

/** Test-only reset of the chain head. */
export function __resetMcpAuditChainForTest(): void {
  lastMcpSignature = null;
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
 * HMAC-SHA256 over the receipt's immutable fields chained to the previous
 * signature. Mirrors the canonical form used by the security-event chain so
 * both streams verify the same way.
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
    payload: entry.payload,
    previousSignature: previousSig ?? '',
  });
  return createHmac('sha256', secret).update(canonical).digest('hex');
}

/**
 * Append one governed-MCP receipt. Throws on a failed write (already classified
 * + counted) so the caller can fail closed. The chain head only advances on a
 * durable write, so a failed write leaves no gap.
 */
export async function recordMcpToolAudit(input: McpAuditInput): Promise<void> {
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
