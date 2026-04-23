/**
 * Recovery Request API Route
 *
 * POST /api/auth/recovery/request
 *
 * Initiates account recovery by generating a magic link token.
 * Always returns success to prevent user enumeration.
 */

import { createMagicLink } from '@revealui/auth/server';
import { RecoveryRequestSchema } from '@revealui/contracts';
import { getClient } from '@revealui/db';
import { getUserByEmail } from '@revealui/db/queries/users';
import { logger } from '@revealui/utils/logger';
import { type NextRequest, NextResponse } from 'next/server';
import { sendRecoveryEmail } from '@/lib/email';
import { withRateLimit } from '@/lib/middleware/rate-limit';
import { createErrorResponse, createValidationErrorResponse } from '@/lib/utils/error-response';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

async function requestHandler(request: NextRequest): Promise<NextResponse> {
  try {
    let body: unknown;
    try {
      body = await request.json();
    } catch (jsonError) {
      return createValidationErrorResponse('Invalid JSON in request body', 'body', null, {
        parseError: jsonError instanceof Error ? jsonError.message : 'Malformed JSON',
      });
    }

    const result = RecoveryRequestSchema.safeParse(body);

    if (!result.success) {
      const firstIssue = result.error.issues[0];
      return createValidationErrorResponse(
        firstIssue?.message ?? 'Validation failed',
        firstIssue?.path?.join('.') ?? 'email',
        body,
        {
          issues: result.error.issues.map((issue) => ({
            path: issue.path.join('.'),
            message: issue.message,
          })),
        },
      );
    }

    const { email } = result.data;

    // Look up user by email
    const db = getClient();
    const user = await getUserByEmail(db, email);

    if (user) {
      const { token } = await createMagicLink(user.id);

      // Send recovery email via Gmail REST API (or mock in dev without creds)
      const emailResult = await sendRecoveryEmail(email, token);

      if (!emailResult.success) {
        // Log error but don't reveal to user (prevents enumeration)
        logger.error('Failed to send recovery email', {
          email,
          error: emailResult.error,
        });
      }

      // Also log in development for easy debugging
      if (process.env.NODE_ENV !== 'production') {
        logger.info('Recovery link generated (dev only)', {
          email,
          recoveryUrl: `${process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:4000'}/auth/recovery/verify?token=${token}`,
        });
      }
    }

    // Always return success to prevent user enumeration
    return NextResponse.json({ success: true });
  } catch (error) {
    logger.error('Error processing recovery request', { error });
    return createErrorResponse(error, {
      endpoint: '/api/auth/recovery/request',
      operation: 'recovery_request',
    });
  }
}

// Rate limit: 3 requests per hour per IP
export const POST = withRateLimit(requestHandler, {
  maxAttempts: 3,
  windowMs: 60 * 60 * 1000,
  keyPrefix: 'recovery-request',
});
