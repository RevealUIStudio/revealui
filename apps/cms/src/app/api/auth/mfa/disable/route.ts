/**
 * MFA Disable API Route
 *
 * POST /api/auth/mfa/disable
 *
 * Disables MFA on the authenticated user's account.
 * Requires re-authentication via password or passkey.
 */

import { disableMFA, getSession } from '@revealui/auth/server';
import { MFADisableRequestContract } from '@revealui/contracts';
import { logger } from '@revealui/core/utils/logger';
import { type NextRequest, NextResponse } from 'next/server';
import {
  createApplicationErrorResponse,
  createErrorResponse,
  createValidationErrorResponse,
} from '@/lib/utils/error-response';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const session = await getSession(request.headers);

    if (!session) {
      return createApplicationErrorResponse('Unauthorized', 'UNAUTHORIZED', 401);
    }

    let body: unknown;
    try {
      body = await request.json();
    } catch (jsonError) {
      return createValidationErrorResponse('Invalid JSON in request body', 'body', null, {
        parseError: jsonError instanceof Error ? jsonError.message : 'Malformed JSON',
      });
    }

    const validationResult = MFADisableRequestContract.validate(body);

    if (!validationResult.success) {
      const firstIssue = validationResult.errors.issues[0];
      return createValidationErrorResponse(
        firstIssue?.message ?? 'Validation failed',
        firstIssue?.path?.join('.') ?? 'body',
        body,
        {
          issues: validationResult.errors.issues.map((issue) => ({
            path: issue.path.join('.'),
            message: issue.message,
          })),
        },
      );
    }

    const data = validationResult.data;

    // Map contract schema to MFADisableProof type
    const proof =
      data.method === 'password'
        ? { method: 'password' as const, password: data.password }
        : { method: 'passkey' as const, verified: true as const };

    const result = await disableMFA(session.user.id, proof);

    if (!result.success) {
      return createApplicationErrorResponse(
        result.error ?? 'Failed to disable MFA',
        'MFA_DISABLE_FAILED',
        400,
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    logger.error('Error disabling MFA', { error });
    return createErrorResponse(error, {
      endpoint: '/api/auth/mfa/disable',
      operation: 'mfa_disable',
    });
  }
}
