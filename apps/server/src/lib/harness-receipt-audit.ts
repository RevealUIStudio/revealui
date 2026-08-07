/**
 * Harness hook receipt writer (GAP-381 Phase A).
 *
 * Appends one `harness.hook.*` audit_log row per ingested hook event through
 * the single `DrizzleAuditStore` door (same door as MCP tool receipts).
 * Failures throw so the route can fail closed (I-3).
 *
 * Retention (design §8 D-A): rows live in the shared `audit_log` table and
 * follow the same account GDPR export/delete and platform retention policy
 * as every other audit receipt. No parallel harness-only store.
 */

import { randomUUID } from 'node:crypto';
import { classifyAuditWriteFailure, recordAuditWriteResult } from '@revealui/core/security';
import { getClient } from '@revealui/db';
import { createAuditStore } from './audit-signer.js';

export interface HarnessReceiptAuditInput {
  /** User resolved from the verified device token only (I-1). */
  userId: string;
  accountId: string | null;
  /** Editor source: cursor | claude-code | vscode | opencode | grok */
  source: string;
  /** Normalized event kind (session-start, pre-tool, …). */
  kind: string;
  /** Honest enforcement tier from the client decision (must not invent 'enforced'). */
  enforcementTier: 'enforced' | 'advisory';
  /** Local policy decision: allow | deny | ask | none */
  decision?: string;
  toolName?: string;
  conversationId?: string;
  generationId?: string;
  modelId?: string;
  /** sha256 hex of canonical JSON of raw payload; never store raw secrets. */
  rawDigest?: string;
  /** Client-supplied display email under raw only — stored as metadata, never as userId. */
  displayEmail?: string;
}

/**
 * Write one harness.hook receipt. Throws when the audit door fails so the
 * ingest route returns 5xx instead of silently dropping governance evidence.
 */
export async function recordHarnessHookAudit(input: HarnessReceiptAuditInput): Promise<string> {
  const id = randomUUID();
  const timestamp = new Date();
  const eventType = `harness.hook.${input.kind}`;
  const severity = input.decision === 'deny' ? 'warn' : 'info';
  const agentId = `harness:${input.source}`;

  const payload: Record<string, unknown> = {
    userId: input.userId,
    accountId: input.accountId,
    source: input.source,
    kind: input.kind,
    enforcementTier: input.enforcementTier,
  };
  if (input.decision !== undefined) payload.decision = input.decision;
  if (input.toolName !== undefined) payload.toolName = input.toolName;
  if (input.conversationId !== undefined) payload.conversationId = input.conversationId;
  if (input.generationId !== undefined) payload.generationId = input.generationId;
  if (input.modelId !== undefined) payload.modelId = input.modelId;
  if (input.rawDigest !== undefined) payload.rawDigest = input.rawDigest;
  // Display-only metadata; never used as auth identity (I-1).
  if (input.displayEmail !== undefined) payload.displayEmail = input.displayEmail;

  try {
    await createAuditStore(getClient()).append({
      id,
      timestamp,
      eventType,
      severity,
      agentId,
      sessionId: input.conversationId ?? undefined,
      payload,
      policyViolations: [],
    });
    recordAuditWriteResult({ ok: true, eventId: id, eventType });
    return id;
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
