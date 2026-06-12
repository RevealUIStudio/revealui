/**
 * Sign Out API Route
 *
 * POST /api/auth/sign-out
 *
 * Signs out the current user: best-effort server-side session revocation,
 * then unconditional cookie clearing. Sign-out is idempotent  -  an
 * already-dead session still gets a success response with cleared cookies.
 */

import { deleteSession } from '@revealui/auth/server';
import { logger } from '@revealui/utils/logger';
import { type NextRequest, NextResponse } from 'next/server';
import { withRateLimit } from '@/lib/middleware/rate-limit';
import { clearSessionCookies } from '@/lib/utils/session-cookies';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

async function signOutHandler(request: NextRequest): Promise<NextResponse> {
  // Server-side revocation is best-effort: the cookie clearing below must run
  // even when it fails, or the browser keeps a live session cookie.
  let deleted = false;
  try {
    deleted = await deleteSession(request.headers);
  } catch (error) {
    logger.error('Sign-out: server-side session deletion failed', { error });
  }

  if (!deleted) {
    logger.warn('Sign-out: no session row deleted (missing, unknown, or already-revoked token)');
  }

  const response = NextResponse.json({
    success: true,
  });

  clearSessionCookies(response);

  return response;
}

// Export rate-limited handler
export const POST = withRateLimit(signOutHandler, {
  maxAttempts: 10,
  windowMs: 15 * 60 * 1000, // 15 minutes
  keyPrefix: 'signout',
});
