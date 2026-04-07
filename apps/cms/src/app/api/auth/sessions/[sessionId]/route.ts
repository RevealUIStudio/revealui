/**
 * Session Revocation API Route
 *
 * DELETE /api/auth/sessions/[sessionId]
 *
 * Revokes a specific session. Users may only revoke their own sessions.
 * The current session cannot be revoked via this endpoint (use sign-out instead).
 */

import { auditSessionRevoked, getSession } from '@revealui/auth/server';
import { getClient } from '@revealui/db';
import { and, eq, isNull, sessions } from '@revealui/db/schema';
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

    // Soft-delete session — userId check ensures ownership without a separate fetch
    const result = await db
      .update(sessions)
      .set({ deletedAt: new Date() })
      .where(
        and(
          eq(sessions.id, sessionId),
          eq(sessions.userId, sessionData.user.id),
          isNull(sessions.deletedAt),
        ),
      )
      .returning();

    if (result.length === 0) {
      return createApplicationErrorResponse('Session not found', 'NOT_FOUND', 404);
    }

    void auditSessionRevoked(
      sessionData.user.id,
      sessionId,
      request.headers.get('x-real-ip') ??
        request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
        '',
    );
    return NextResponse.json({ message: 'Session revoked.' });
  } catch (error) {
    return createErrorResponse(error, {
      endpoint: '/api/auth/sessions/[sessionId]',
      operation: 'revoke_session',
    });
  }
}
