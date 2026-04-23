/**
 * MCP elicitation response — POST /api/mcp/remote-servers/[server]/elicitation-respond
 *
 * Resolves a pending elicitation request on an active `call-tool-stream`
 * session. The streaming invoker emits an `{ type: 'elicitation', id, … }`
 * event when the remote server calls `elicitation/create`; the admin UI
 * renders a form, collects the user's response, and POSTs back here.
 *
 * Body:
 * ```
 * {
 *   sessionId: string,
 *   elicitationId: string,
 *   action: 'accept' | 'decline' | 'cancel',
 *   content?: Record<string, unknown>
 * }
 * ```
 *
 * Returns 200 on success; 404 if no matching pending elicitation exists
 * (stale sessionId, or the admin responded twice, or the stream already
 * ended).
 *
 * Stage 3.4 of the MCP v1 plan.
 */

import { getSession } from '@revealui/auth/server';
import type { ElicitResult } from '@revealui/mcp/client';
import { type NextRequest, NextResponse } from 'next/server';
import { getCallSession, resolveElicitation } from '@/lib/mcp/call-sessions';
import { extractRequestContext } from '@/lib/utils/request-context';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function POST(
  request: NextRequest,
): Promise<NextResponse<{ resolved: true } | { error: string; detail?: string }>> {
  const authSession = await getSession(request.headers, extractRequestContext(request));
  if (!authSession) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  if (authSession.user.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  let body: {
    sessionId?: unknown;
    elicitationId?: unknown;
    action?: unknown;
    content?: unknown;
  };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: 'Request body must be JSON' }, { status: 400 });
  }

  const { sessionId, elicitationId, action } = body;
  if (typeof sessionId !== 'string' || !UUID_RE.test(sessionId)) {
    return NextResponse.json({ error: 'body.sessionId must be a UUID' }, { status: 400 });
  }
  if (typeof elicitationId !== 'string' || !UUID_RE.test(elicitationId)) {
    return NextResponse.json({ error: 'body.elicitationId must be a UUID' }, { status: 400 });
  }
  if (action !== 'accept' && action !== 'decline' && action !== 'cancel') {
    return NextResponse.json(
      { error: "body.action must be 'accept' | 'decline' | 'cancel'" },
      { status: 400 },
    );
  }

  // Bind responses to the session owner. Prevents a different admin from
  // closing out another admin's open elicitation.
  const session = getCallSession(sessionId);
  if (!session) {
    return NextResponse.json(
      { error: 'session_expired', detail: 'The streaming session is no longer active.' },
      { status: 404 },
    );
  }
  if (session.userId !== authSession.user.id) {
    return NextResponse.json({ error: 'session_owner_mismatch' }, { status: 403 });
  }

  let result: ElicitResult;
  if (action === 'accept') {
    const rawContent = body.content;
    if (typeof rawContent !== 'object' || rawContent === null || Array.isArray(rawContent)) {
      return NextResponse.json(
        { error: "body.content must be a plain object when action === 'accept'" },
        { status: 400 },
      );
    }
    result = {
      action: 'accept',
      content: rawContent as Record<string, string | number | boolean | string[]>,
    };
  } else {
    result = { action };
  }

  const resolved = resolveElicitation(sessionId, elicitationId, result);
  if (!resolved) {
    return NextResponse.json(
      { error: 'unknown_elicitation', detail: 'No matching pending elicitation.' },
      { status: 404 },
    );
  }

  return NextResponse.json({ resolved: true });
}
