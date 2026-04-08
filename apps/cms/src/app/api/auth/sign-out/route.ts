/**
 * Sign Out API Route
 *
 * POST /api/auth/sign-out
 *
 * Signs out the current user by deleting their session.
 */

import { deleteSession } from '@revealui/auth/server';
import { logger } from '@revealui/utils/logger';
import { type NextRequest, NextResponse } from 'next/server';
import { withRateLimit } from '@/lib/middleware/rate-limit';
import { createErrorResponse } from '@/lib/utils/error-response';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

async function signOutHandler(request: NextRequest): Promise<NextResponse> {
  try {
    await deleteSession(request.headers);

    // Create response
    const response = NextResponse.json({
      success: true,
    });

    // Clear session and role cookies
    response.cookies.delete('revealui-session');
    response.cookies.delete('revealui-role');

    return response;
  } catch (error) {
    logger.error('Error signing out', { error });
    return createErrorResponse(error, {
      endpoint: '/api/auth/sign-out',
      operation: 'sign_out',
    });
  }
}

// Export rate-limited handler
export const POST = withRateLimit(signOutHandler, {
  maxAttempts: 10,
  windowMs: 15 * 60 * 1000, // 15 minutes
  keyPrefix: 'signout',
});
