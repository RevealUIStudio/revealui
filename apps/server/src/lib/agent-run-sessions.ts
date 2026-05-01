/**
 * In-memory session registry for streaming agent runs at
 * `/api/agent-stream` that may trigger MCP `elicitation/create` requests
 * mid-flight. Lifetime: one entry per active agent-stream request. Entries
 * are removed explicitly when the stream ends (success, error, disconnect).
 *
 * Adapted from Stage 3.4's
 * [`apps/admin/src/lib/mcp/call-sessions.ts`](../../../admin/src/lib/mcp/call-sessions.ts) —
 * same design (process-local `Map`, ephemeral, no durability) but scoped
 * to agent-run flows rather than per-`(tenant, server)` tool-invocation
 * flows. Two route handlers bridge via this registry:
 *
 *   1. `POST /api/agent-stream` registers the session on stream start,
 *      attaches an `elicitationHandler` to each connected `McpClient`
 *      that writes an `elicitation_request` SSE chunk and awaits a
 *      matching POST response.
 *   2. `POST /api/agent-stream/elicit` reads `{ sessionId, elicitationId,
 *      action, content? }` from its body, looks up the pending promise,
 *      and resolves it so the MCP server's `elicitation/create` call
 *      returns and the agent turn continues.
 *
 * State is process-local and intentionally non-durable. If the api process
 * restarts, in-flight agent runs are cancelled (any unresolved elicitation
 * handlers reject with `{ action: 'cancel' }`).
 *
 * A.2b of the post-v1 MCP arc.
 */

import type { ElicitResult } from '@revealui/mcp/client';

interface PendingElicitation {
  id: string;
  resolve: (result: ElicitResult) => void;
}

export interface AgentRunSession {
  sessionId: string;
  userId: string;
  createdAt: number;
  pending: Map<string, PendingElicitation>;
}

const sessions = new Map<string, AgentRunSession>();

export function createAgentRunSession(userId: string): AgentRunSession {
  const sessionId = crypto.randomUUID();
  const session: AgentRunSession = {
    sessionId,
    userId,
    createdAt: Date.now(),
    pending: new Map(),
  };
  sessions.set(sessionId, session);
  return session;
}

export function getAgentRunSession(sessionId: string): AgentRunSession | undefined {
  return sessions.get(sessionId);
}

export function deleteAgentRunSession(sessionId: string): void {
  const session = sessions.get(sessionId);
  if (!session) return;
  // Reject any outstanding elicitation so the MCP server's handler
  // unblocks and the client can tear down cleanly.
  for (const pending of session.pending.values()) {
    pending.resolve({ action: 'cancel' });
  }
  sessions.delete(sessionId);
}

/**
 * Register a pending elicitation against an active session. Returns a
 * Promise that resolves when a matching `elicit` POST lands (or when the
 * session is deleted, in which case the promise resolves with
 * `{ action: 'cancel' }`).
 */
export function awaitElicitationResponse(
  sessionId: string,
  elicitationId: string,
): Promise<ElicitResult> {
  const session = sessions.get(sessionId);
  if (!session) {
    return Promise.resolve({ action: 'cancel' });
  }
  return new Promise<ElicitResult>((resolve) => {
    session.pending.set(elicitationId, { id: elicitationId, resolve });
  });
}

/**
 * Resolve a pending elicitation with the admin-supplied response. Returns
 * `true` if a matching pending request was found + resolved. The caller
 * (the `/elicit` route) reports 404 on `false`.
 */
export function resolveElicitation(
  sessionId: string,
  elicitationId: string,
  result: ElicitResult,
): boolean {
  const session = sessions.get(sessionId);
  if (!session) return false;
  const pending = session.pending.get(elicitationId);
  if (!pending) return false;
  session.pending.delete(elicitationId);
  pending.resolve(result);
  return true;
}

/**
 * Test-only. Clears the registry — isolates test-to-test state so
 * neighbor-session data never bleeds across `describe` blocks.
 *
 * Exported at module top-level (rather than behind a guard) because the
 * registry is already process-local + in-memory; there's no production
 * surface where "clear all sessions" is a legitimate operation. Tests
 * that touch the registry should call this in `beforeEach`.
 */
export function _resetAgentRunSessions(): void {
  for (const session of sessions.values()) {
    for (const pending of session.pending.values()) {
      pending.resolve({ action: 'cancel' });
    }
  }
  sessions.clear();
}
