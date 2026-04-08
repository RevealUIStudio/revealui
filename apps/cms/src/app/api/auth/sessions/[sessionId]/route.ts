/**
 * Session Revocation API Route
 *
 * DELETE /api/auth/sessions/[sessionId]
 *
 * Revokes a specific session. Users may only revoke their own sessions.
 * The current session cannot be revoked via this endpoint (use sign-out instead).
 */

import { getSession } from '@revealui/auth/server';
import { getClient } from '@revealui/db';
import { revokeSession } from '@revealui/db/queries/sessions';
import { type NextRequest, NextResponse } from 'next/server';
import { createApplicationErrorResponse, createErrorResponse } from '@/lib/utils/error-response';
import { extractRequestContext } from '@/lib/utils/request-context';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> },
): Promise<NextResponse> {
  try {
    const sessionData = await getSession(request.headers, extractRequestContext(request));
    if (!sessionData) {
      return createApplicationErrorResponse('Unauthorized', 'UNAUTHORIZED', 401);
    }

    const { sessionId } = await params;

    if (!sessionId) {
      return createApplicationErrorResponse('Session ID is required', 'INVALID_REQUEST', 400);
    }

    // Prevent revoking the current session (use sign-out for that)
    if (sessionId === sessionData.session.id) {
      return createApplicationErrorResponse(
        'Cannot revoke your current session. Use sign out instead.',
        'INVALID_REQUEST',
        400,
      );
    }

    const db = getClient();
    const revoked = await revokeSession(db, sessionId, sessionData.user.id);

    if (!revoked) {
      return createApplicationErrorResponse('Session not found', 'NOT_FOUND', 404);
    }

    return NextResponse.json({ message: 'Session revoked.' });
  } catch (error) {
    return createErrorResponse(error, {
      endpoint: '/api/auth/sessions/[sessionId]',
      operation: 'revoke_session',
    });
  }
}
