/**
 * Current User API Route
 *
 * GET /api/auth/me
 *
 * Returns the current authenticated user.
 */

import { getLinkedProviders, getSession } from '@revealui/auth/server';
import { logger } from '@revealui/utils/logger';
import { type NextRequest, NextResponse } from 'next/server';
import { createApplicationErrorResponse, createErrorResponse } from '@/lib/utils/error-response';
import { extractRequestContext } from '@/lib/utils/request-context';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    const session = await getSession(request.headers, extractRequestContext(request));

    if (!session) {
      return createApplicationErrorResponse('Unauthorized', 'UNAUTHORIZED', 401);
    }

    // Fetch linked OAuth providers for the account settings UI
    let linkedProviders: Array<{
      provider: string;
      providerEmail: string | null;
      providerName: string | null;
    }> = [];
    try {
      linkedProviders = await getLinkedProviders(session.user.id);
    } catch (err) {
      logger.warn('Failed to fetch linked providers', { userId: session.user.id, error: err });
    }

    return NextResponse.json({
      user: {
        id: session.user.id,
        email: session.user.email,
        name: session.user.name,
        avatarUrl: session.user.avatarUrl,
        role: session.user.role,
        status: session.user.status,
        emailVerified: session.user.emailVerified ?? false,
        linkedProviders: linkedProviders.map((lp) => ({
          provider: lp.provider,
          email: lp.providerEmail,
          name: lp.providerName,
        })),
        hasPassword: !!session.user.password,
      },
    });
  } catch (error) {
    logger.error('Error getting current user', { error });
    return createErrorResponse(error, {
      endpoint: '/api/auth/me',
      operation: 'get_current_user',
    });
  }
}
