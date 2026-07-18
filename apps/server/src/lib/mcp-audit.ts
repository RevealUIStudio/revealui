/**
 * Governed-MCP audit writer (GAP-371 Phase 1/2).
 *
 * Writes one receipt to `audit_log` for every `tools/call` on the `/api/mcp`
 * endpoint. Reuses the failure classifier + rolling-ratio tracker that every
 * other audit write path funnels through (`classifyAuditWriteFailure` /
 * `recordAuditWriteResult`).
 *
 * `recordMcpToolAudit` THROWS when the write does not land, so the caller (the
 * content factory's audit sink) can fail closed for mutating tools and degrade
 * for reads — the factory owns that policy split, not this module.
 *
 * Signing (GAP-355 Stage 3). The bespoke HMAC hash chain this module used to keep
 * (`signChained` over a local `canonicalJson`, a per-process `lastMcpSignature`
 * head, and an `appendQueue` mutex serializing the read-modify-write) is GONE.
 * The receipt now writes through the single `DrizzleAuditStore` door
 * (`createAuditStore`), and the door signs each row independently with the
 * process-wide Ed25519 signer (RFC 8785 canonicalization over the full row). With
 * no shared chain head there is no read-modify-write to serialize, so the mutex
 * is removed too; concurrent appends are independently signed and cannot fork.
 * `previous_signature` is not written going forward (the chain is abandoned, ADR
 * `2026-07-12-audit-receipt-architecture` finding 3; deletion evidence is now the
 * monotonic `seq` from Stage 2). The fail-closed mutating-tool policy and the
 * loud-failure rails are unchanged.
 */

import { randomUUID } from 'node:crypto';
import { classifyAuditWriteFailure, recordAuditWriteResult } from '@revealui/core/security';
import { getClient } from '@revealui/db';
import { createAuditStore } from './audit-signer.js';

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

/**
 * Append one governed-MCP receipt through the single audit door. Throws on a
 * failed write (already classified + counted) so the caller can fail closed. A
 * configured signer that fails also throws here (fail-closed, GAP-355 Stage 3
 * D5) and is routed through the same rails — no unsigned receipt lands.
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
  if (input.reason !== undefined) payload.reason = input.reason;

  try {
    // ONE DOOR (GAP-355 Stage 2): the single `insert(auditLog)` site in
    // DrizzleAuditStore. createAuditStore injects the process-wide Ed25519 signer
    // (Stage 3), so the row is signed at the door.
    await createAuditStore(getClient()).append({
      id,
      timestamp,
      eventType,
      severity,
      agentId,
      sessionId: input.sessionId ?? undefined,
      payload,
      policyViolations: [],
    });
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
