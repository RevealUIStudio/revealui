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
