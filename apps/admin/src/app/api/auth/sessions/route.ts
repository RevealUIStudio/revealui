/**
 * Sessions API Route
 *
 * GET /api/auth/sessions
 *
 * Returns all active sessions for the current user.
 * Marks the calling session as current.
 */

import { getSession } from '@revealui/auth/server';
import { getClient } from '@revealui/db';
import { getActiveSessions } from '@revealui/db/queries/sessions';
import { type NextRequest, NextResponse } from 'next/server';
import { createApplicationErrorResponse, createErrorResponse } from '@/lib/utils/error-response';
import { extractRequestContext } from '@/lib/utils/request-context';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    const sessionData = await getSession(request.headers, extractRequestContext(request));
    if (!sessionData) {
      return createApplicationErrorResponse('Unauthorized', 'UNAUTHORIZED', 401);
    }

    const db = getClient();
    const rows = await getActiveSessions(db, sessionData.user.id);

    return NextResponse.json({
      currentSessionId: sessionData.session.id,
      sessions: rows.map((s) => ({
        ...s,
        isCurrent: s.id === sessionData.session.id,
        lastActivityAt: s.lastActivityAt.toISOString(),
        createdAt: s.createdAt.toISOString(),
        expiresAt: s.expiresAt.toISOString(),
      })),
    });
  } catch (error) {
    return createErrorResponse(error, {
      endpoint: '/api/auth/sessions',
      operation: 'list_sessions',
    });
  }
}
