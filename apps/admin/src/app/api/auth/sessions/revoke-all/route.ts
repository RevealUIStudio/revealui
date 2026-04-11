/**
 * Revoke All Other Sessions API Route
 *
 * POST /api/auth/sessions/revoke-all
 *
 * Deletes all sessions for the current user EXCEPT the calling session.
 * Returns the count of revoked sessions.
 */

import { deleteOtherUserSessions, getSession } from '@revealui/auth/server';
import { type NextRequest, NextResponse } from 'next/server';
import { withRateLimit } from '@/lib/middleware/rate-limit';
import { createApplicationErrorResponse, createErrorResponse } from '@/lib/utils/error-response';
import { extractRequestContext } from '@/lib/utils/request-context';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

async function revokeAllHandler(request: NextRequest): Promise<NextResponse> {
  try {
    const sessionData = await getSession(request.headers, extractRequestContext(request));
    if (!sessionData) {
      return createApplicationErrorResponse('Unauthorized', 'UNAUTHORIZED', 401);
    }

    const revoked = await deleteOtherUserSessions(sessionData.user.id, sessionData.session.id);

    return NextResponse.json({ success: true, revoked });
  } catch (error) {
    return createErrorResponse(error, {
      endpoint: '/api/auth/sessions/revoke-all',
      operation: 'revoke_all_sessions',
    });
  }
}

// Export rate-limited handler  -  same window as sign-out
export const POST = withRateLimit(revokeAllHandler, {
  maxAttempts: 10,
  windowMs: 15 * 60 * 1000, // 15 minutes
  keyPrefix: 'revoke-all',
});
