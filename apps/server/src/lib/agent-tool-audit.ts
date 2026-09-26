/**
 * Agent MCP tool audit writer (GAP-355 Stage 5 S5-2).
 *
 * Maps agent-stream MCP tool-call summaries onto the ONE DOOR
 * (`createAuditStore` → signed `audit_log` rows). Throws when the write
 * fails so the adapter can fail closed after a successful tool RPC.
 */

import { randomUUID } from 'node:crypto';
import { classifyAuditWriteFailure, recordAuditWriteResult } from '@revealui/core/security';
import { getClient } from '@revealui/db';
import type { Database } from '@revealui/db/client';
import { createAuditStore } from './audit-signer.js';

export interface AgentMcpToolAuditInput {
  /** MCP server namespace (tenant server id). */
  namespace: string;
  toolName: string;
  success: boolean;
  durationMs: number;
  error?: string;
  /** Session / run id for the agent stream. */
  sessionId?: string;
  /** Account tenant for Stage 4 anchoring when known. */
  accountId?: string | null;
  /** Authenticated user driving the agent. */
  userId?: string | null;
  agentId?: string;
  taskId?: string;
  db?: Database;
}

/**
 * Append one agent MCP tool receipt. Throws on write failure (fail-closed).
 */
export async function recordAgentMcpToolAudit(input: AgentMcpToolAuditInput): Promise<void> {
  const id = randomUUID();
  const eventType = 'agent:tool:called';
  const severity = input.success ? 'info' : 'warn';
  const agentId = input.agentId ?? `agent-stream:${input.namespace}`;

  const payload: Record<string, unknown> = {
    namespace: input.namespace,
    tool: input.toolName,
    success: input.success,
    durationMs: input.durationMs,
  };
  if (input.error !== undefined) payload.error = input.error;
  if (input.userId !== undefined) payload.userId = input.userId;
  if (input.accountId !== undefined) payload.accountId = input.accountId;

  try {
    await createAuditStore(input.db ?? getClient()).append({
      id,
      timestamp: new Date(),
      eventType,
      severity,
      agentId,
      ...(input.taskId !== undefined ? { taskId: input.taskId } : {}),
      ...(input.sessionId !== undefined ? { sessionId: input.sessionId } : {}),
      payload,
      policyViolations: [],
      tenant: input.accountId ?? null,
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

export interface AgentToolDeniedAuditInput {
  toolName: string;
  reason: string;
  namespace?: string;
  sessionId?: string;
  accountId?: string | null;
  userId?: string | null;
  agentId?: string;
  taskId?: string;
  db?: Database;
  scopeId?: string | null;
  preset?: string | null;
}

/**
 * Append agent:tool:denied (GAP-355 Stage 6 S6-3). Soft-fail path on stream —
 * callers may swallow throw so the model still receives a deny ToolResult.
 */
export async function recordAgentToolDenied(input: AgentToolDeniedAuditInput): Promise<void> {
  const id = randomUUID();
  const eventType = 'agent:tool:denied';
  const agentId = input.agentId ?? 'agent-stream';

  const payload: Record<string, unknown> = {
    tool: input.toolName,
    reason: input.reason,
    success: false,
  };
  if (input.namespace !== undefined) payload.namespace = input.namespace;
  if (input.userId !== undefined) payload.userId = input.userId;
  if (input.accountId !== undefined) payload.accountId = input.accountId;
  if (input.scopeId) payload.scopeId = input.scopeId;
  if (input.preset) payload.preset = input.preset;

  try {
    await createAuditStore(input.db ?? getClient()).append({
      id,
      timestamp: new Date(),
      eventType,
      severity: 'warn',
      agentId,
      ...(input.taskId !== undefined ? { taskId: input.taskId } : {}),
      ...(input.sessionId !== undefined ? { sessionId: input.sessionId } : {}),
      payload,
      policyViolations: [input.reason],
      tenant: input.accountId ?? null,
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

interface TrustAuditCommon {
  accountId?: string | null;
  userId?: string | null;
  agentId?: string;
  sessionId?: string;
  taskId?: string;
  db?: Database;
  principalKind?: string;
  preset?: string;
  scopeId?: string | null;
  source?: string;
}

async function appendTrustAudit(
  eventType: string,
  severity: 'info' | 'warn',
  payload: Record<string, unknown>,
  input: TrustAuditCommon,
  policyViolations: string[] = [],
): Promise<void> {
  const id = randomUUID();
  const agentId = input.agentId ?? 'agent-stream';
  if (input.userId !== undefined) payload.userId = input.userId;
  if (input.accountId !== undefined) payload.accountId = input.accountId;
  if (input.principalKind !== undefined) payload.principalKind = input.principalKind;
  if (input.preset !== undefined) payload.preset = input.preset;
  if (input.scopeId) payload.scopeId = input.scopeId;
  if (input.source !== undefined) payload.source = input.source;

  try {
    await createAuditStore(input.db ?? getClient()).append({
      id,
      timestamp: new Date(),
      eventType,
      severity,
      agentId,
      ...(input.taskId !== undefined ? { taskId: input.taskId } : {}),
      ...(input.sessionId !== undefined ? { sessionId: input.sessionId } : {}),
      payload,
      policyViolations,
      tenant: input.accountId ?? null,
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

export async function recordAgentTrustPresetApplied(
  input: TrustAuditCommon & { scope: unknown; sources: readonly string[] },
): Promise<void> {
  await appendTrustAudit(
    'agent:trust:preset_applied',
    'info',
    { scope: input.scope, sources: [...input.sources] },
    input,
  );
}

export async function recordAgentTrustResolveFailed(
  input: TrustAuditCommon & { reason: string; sources: readonly string[] },
): Promise<void> {
  await appendTrustAudit(
    'agent:trust:resolve_failed',
    'warn',
    { reason: input.reason, sources: [...input.sources] },
    input,
    [input.reason],
  );
}

export async function recordAgentTrustWouldDeny(
  input: TrustAuditCommon & { toolName: string; reason: string },
): Promise<void> {
  await appendTrustAudit(
    'agent:trust:would_deny',
    'warn',
    { tool: input.toolName, reason: input.reason },
    input,
    [input.reason],
  );
}

export async function recordAgentTrustOutputCapped(
  input: TrustAuditCommon & { bytes: number; limit: number },
): Promise<void> {
  await appendTrustAudit(
    'agent:trust:output_capped',
    'warn',
    { bytes: input.bytes, limit: input.limit },
    input,
    ['low_trust_output_too_large'],
  );
}

export async function recordAgentToolAllowedByGrant(
  input: TrustAuditCommon & {
    toolName: string;
    className: string | null;
    grantResource: string;
    expiresAt?: string | null;
  },
): Promise<void> {
  await appendTrustAudit(
    'agent:tool:allowed_by_grant',
    'info',
    {
      tool: input.toolName,
      class: input.className,
      grantResource: input.grantResource,
      expiresAt: input.expiresAt ?? null,
    },
    input,
  );
}
