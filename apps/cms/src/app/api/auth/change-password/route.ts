/**
 * Change Password API Route
 *
 * POST /api/auth/change-password
 *
 * Verifies the user's current password, then updates it to a new one.
 * Optionally revokes all other active sessions for security.
 */

import {
  changePassword,
  deleteOtherUserSessions,
  getSession,
  meetsMinimumPasswordRequirements,
} from '@revealui/auth/server';
import { logger } from '@revealui/core/observability/logger';
import { type NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { withRateLimit } from '@/lib/middleware/rate-limit';
import {
  createApplicationErrorResponse,
  createErrorResponse,
  createValidationErrorResponse,
} from '@/lib/utils/error-response';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const ChangePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Current password is required'),
  newPassword: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .max(128, 'Password must be at most 128 characters'),
  revokeOtherSessions: z.boolean().optional().default(true),
});

async function handler(request: NextRequest): Promise<NextResponse> {
  try {
    const sessionData = await getSession(request.headers);
    if (!sessionData) {
      return createApplicationErrorResponse('Unauthorized', 'UNAUTHORIZED', 401);
    }

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return createValidationErrorResponse('Invalid JSON in request body', 'body', null, {});
    }

    const parsed = ChangePasswordSchema.safeParse(body);
    if (!parsed.success) {
      const firstIssue = parsed.error.issues[0];
      return createValidationErrorResponse(
        firstIssue?.message ?? 'Validation failed',
        firstIssue?.path?.join('.') ?? 'body',
        body,
        {
          issues: parsed.error.issues.map((i) => ({
            path: i.path.join('.'),
            message: i.message,
          })),
        },
      );
    }

    const { currentPassword, newPassword, revokeOtherSessions } = parsed.data;

    // Validate new password strength before hitting the DB
    if (!meetsMinimumPasswordRequirements(newPassword)) {
      return createValidationErrorResponse(
        'Password must be at least 8 characters and include uppercase, lowercase, and a number.',
        'newPassword',
        null,
        {},
      );
    }

    const result = await changePassword(sessionData.user.id, currentPassword, newPassword);

    if (!result.success) {
      const error = result.error ?? 'Failed to change password';

      if (error === 'User not found.') {
        return createApplicationErrorResponse(error, 'NOT_FOUND', 404);
      }
      if (error.startsWith('No password is set')) {
        return createApplicationErrorResponse(error, 'NO_PASSWORD_SET', 400);
      }
      if (error === 'Current password is incorrect.') {
        return createApplicationErrorResponse(error, 'INVALID_CREDENTIALS', 400);
      }

      return createApplicationErrorResponse(error, 'INTERNAL_ERROR', 500);
    }

    if (revokeOtherSessions) {
      await deleteOtherUserSessions(sessionData.user.id, sessionData.session.id);
    }

    logger.info('Password changed', {
      userId: sessionData.user.id,
      revokedOtherSessions: revokeOtherSessions,
    });

    return NextResponse.json({ message: 'Password updated successfully.' });
  } catch (error) {
    logger.error(
      'Error changing password',
      error instanceof Error ? error : new Error(String(error)),
    );
    return createErrorResponse(error, {
      endpoint: '/api/auth/change-password',
      operation: 'change_password',
    });
  }
}

export const POST = withRateLimit(handler, {
  maxAttempts: 5,
  windowMs: 15 * 60 * 1000,
  keyPrefix: 'change-password',
  failClosed: true,
});
