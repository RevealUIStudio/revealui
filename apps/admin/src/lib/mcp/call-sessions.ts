/**
 * In-memory session registry for streaming MCP tool calls that may request
 * elicitation mid-flight. Lifetime: one entry per active `call-tool-stream`
 * request. Entries are automatically removed when the stream ends (success,
 * error, or client disconnect).
 *
 * A `CallSession` bridges two route handlers:
 *
 *   1. `POST .../call-tool-stream` registers the session, attaches an
 *      `elicitationHandler` that creates a `PendingElicitation` entry, and
 *      writes `{ type: 'elicitation', id, requestedSchema, message }` to
 *      the SSE stream. The handler returns a Promise that resolves once
 *      the admin submits a response.
 *
 *   2. `POST .../elicitation-respond` reads `{ sessionId, elicitationId,
 *      action, content? }` from its body, looks up the matching pending
 *      promise, and resolves it so the tool call can continue.
 *
 * State is process-local and intentionally non-durable — streaming MCP
 * tool calls are ephemeral; if the admin process restarts, in-flight
 * sessions are cancelled.
 *
 * Stage 3.4 of the MCP v1 plan.
 */

import type { ElicitResult } from '@revealui/mcp/client';

interface PendingElicitation {
  id: string;
  resolve: (result: ElicitResult) => void;
}

export interface CallSession {
  sessionId: string;
  userId: string;
  createdAt: number;
  pending: Map<string, PendingElicitation>;
}

const sessions = new Map<string, CallSession>();

export function createCallSession(userId: string): CallSession {
  const sessionId = crypto.randomUUID();
  const session: CallSession = {
    sessionId,
    userId,
    createdAt: Date.now(),
    pending: new Map(),
  };
  sessions.set(sessionId, session);
  return session;
}

export function getCallSession(sessionId: string): CallSession | undefined {
  return sessions.get(sessionId);
}

export function deleteCallSession(sessionId: string): void {
  const session = sessions.get(sessionId);
  if (!session) return;
  // Reject any outstanding elicitation to unblock the MCP call's
  // `elicitationHandler` so it can tear down cleanly.
  for (const pending of session.pending.values()) {
    pending.resolve({ action: 'cancel' });
  }
  sessions.delete(sessionId);
}

/**
 * Register a pending elicitation against an active session. Returns a
 * Promise that resolves when a matching `elicitation-respond` call lands.
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
 * `true` if a matching pending request was found. The caller (the
 * elicitation-respond route) reports 404 on `false`.
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
