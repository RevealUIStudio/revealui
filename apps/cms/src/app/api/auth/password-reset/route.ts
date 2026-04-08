/**
 * Password Reset API Route
 *
 * POST /api/auth/password-reset
 *
 * Generates a password reset token and sends reset email.
 * PUT /api/auth/password-reset
 *
 * Resets password using a reset token.
 */

import { generatePasswordResetToken, resetPasswordWithToken } from '@revealui/auth/server';
import { PasswordResetRequestContract, PasswordResetTokenContract } from '@revealui/contracts';
import { logger } from '@revealui/utils/logger';
import { type NextRequest, NextResponse } from 'next/server';
import { sendPasswordResetEmail } from '@/lib/email';
import { withRateLimit } from '@/lib/middleware/rate-limit';
import {
  createApplicationErrorResponse,
  createErrorResponse,
  createValidationErrorResponse,
} from '@/lib/utils/error-response';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

async function passwordResetRequestHandler(request: NextRequest): Promise<NextResponse> {
  try {
    let body: unknown;
    try {
      body = await request.json();
    } catch (jsonError) {
      return createValidationErrorResponse('Invalid JSON in request body', 'body', null, {
        parseError: jsonError instanceof Error ? jsonError.message : 'Malformed JSON',
      });
    }

    // Validate request body using contract
    const validationResult = PasswordResetRequestContract.validate(body);

    if (!validationResult.success) {
      // Extract first validation error for user-friendly response
      const firstIssue = validationResult.errors.issues[0];
      return createValidationErrorResponse(
        firstIssue?.message || 'Validation failed',
        firstIssue?.path?.join('.') || 'body',
        body,
        {
          issues: validationResult.errors.issues.map((issue) => ({
            path: issue.path.join('.'),
            message: issue.message,
          })),
        },
      );
    }

    // Contract automatically sanitizes email (lowercase, trim)
    const { email: sanitizedEmail } = validationResult.data;

    const result = await generatePasswordResetToken(sanitizedEmail);

    if (!result.success) {
      return createApplicationErrorResponse(
        result.error || 'Failed to generate reset token',
        'PASSWORD_RESET_TOKEN_GENERATION_FAILED',
        500,
      );
    }

    // Send email with reset link (tokenId is included in the URL for O(1) lookup)
    if (result.token && result.tokenId) {
      const emailResult = await sendPasswordResetEmail(
        sanitizedEmail,
        result.tokenId,
        result.token,
      );

      if (!emailResult.success) {
        // Log error but don't reveal to user (security)
        logger.error(
          'Failed to send password reset email',
          new Error(emailResult.error || 'Unknown email error'),
          { email: sanitizedEmail },
        );
        // Still return success to prevent user enumeration
      }
    }

    // Always return success message (don't reveal if user exists)
    return NextResponse.json({
      message: 'If an account exists with this email, a password reset link has been sent.',
    });
  } catch (error) {
    logger.error(
      'Error generating password reset token',
      error instanceof Error ? error : new Error(String(error)),
    );
    return createErrorResponse(error, {
      endpoint: '/api/auth/password-reset',
      operation: 'password_reset_request',
    });
  }
}

async function passwordResetTokenHandler(request: NextRequest): Promise<NextResponse> {
  try {
    let body: unknown;
    try {
      body = await request.json();
    } catch (jsonError) {
      return createValidationErrorResponse('Invalid JSON in request body', 'body', null, {
        parseError: jsonError instanceof Error ? jsonError.message : 'Malformed JSON',
      });
    }

    // Validate request body using contract
    const validationResult = PasswordResetTokenContract.validate(body);

    if (!validationResult.success) {
      // Extract first validation error for user-friendly response
      const firstIssue = validationResult.errors.issues[0];
      return createValidationErrorResponse(
        firstIssue?.message || 'Validation failed',
        firstIssue?.path?.join('.') || 'body',
        body,
        {
          issues: validationResult.errors.issues.map((issue) => ({
            path: issue.path.join('.'),
            message: issue.message,
          })),
        },
      );
    }

    const { tokenId, token, password } = validationResult.data;

    const result = await resetPasswordWithToken(tokenId, token, password);

    if (!result.success) {
      return createApplicationErrorResponse(
        result.error || 'Failed to reset password',
        'PASSWORD_RESET_FAILED',
        400,
        {
          reason: result.error,
        },
      );
    }

    return NextResponse.json({
      message: 'Password reset successfully',
    });
  } catch (error) {
    logger.error(
      'Error resetting password',
      error instanceof Error ? error : new Error(String(error)),
    );
    return createErrorResponse(error, {
      endpoint: '/api/auth/password-reset',
      operation: 'password_reset_token',
    });
  }
}

// Export rate-limited handlers
export const POST = withRateLimit(passwordResetRequestHandler, {
  maxAttempts: 3,
  windowMs: 60 * 60 * 1000, // 1 hour
  keyPrefix: 'password-reset',
  failClosed: true,
});

export const PUT = withRateLimit(passwordResetTokenHandler, {
  maxAttempts: 5,
  windowMs: 15 * 60 * 1000, // 15 minutes
  keyPrefix: 'password-reset-token',
  failClosed: true,
});
