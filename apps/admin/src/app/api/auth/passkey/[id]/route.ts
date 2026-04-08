/**
 * Passkey [id] API Route
 *
 * PATCH /api/auth/passkey/:id — Rename a passkey
 * DELETE /api/auth/passkey/:id — Delete a passkey
 */

import { deletePasskey, getSession, renamePasskey } from '@revealui/auth/server';
import { PasskeyUpdateRequestSchema } from '@revealui/contracts';
import { logger } from '@revealui/utils/logger';
import { type NextRequest, NextResponse } from 'next/server';
import {
  createApplicationErrorResponse,
  createErrorResponse,
  createValidationErrorResponse,
} from '@/lib/utils/error-response';
import { extractRequestContext } from '@/lib/utils/request-context';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  try {
    const session = await getSession(request.headers, extractRequestContext(request));

    if (!session) {
      return createApplicationErrorResponse('Unauthorized', 'UNAUTHORIZED', 401);
    }

    const { id: passkeyId } = await params;

    let body: unknown;
    try {
      body = await request.json();
    } catch (jsonError) {
      return createValidationErrorResponse('Invalid JSON in request body', 'body', null, {
        parseError: jsonError instanceof Error ? jsonError.message : 'Malformed JSON',
      });
    }

    const result = PasskeyUpdateRequestSchema.safeParse(body);

    if (!result.success) {
      const firstIssue = result.error.issues[0];
      return createValidationErrorResponse(
        firstIssue?.message ?? 'Validation failed',
        firstIssue?.path?.join('.') ?? 'body',
        body,
        {
          issues: result.error.issues.map((issue) => ({
            path: issue.path.join('.'),
            message: issue.message,
          })),
        },
      );
    }

    await renamePasskey(session.user.id, passkeyId, result.data.deviceName);

    return NextResponse.json({ success: true });
  } catch (error) {
    logger.error('Error renaming passkey', { error });
    return createErrorResponse(error, {
      endpoint: '/api/auth/passkey/[id]',
      operation: 'passkey_rename',
    });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  try {
    const session = await getSession(request.headers, extractRequestContext(request));

    if (!session) {
      return createApplicationErrorResponse('Unauthorized', 'UNAUTHORIZED', 401);
    }

    const { id: passkeyId } = await params;

    try {
      await deletePasskey(session.user.id, passkeyId);
    } catch (deleteError) {
      if (
        deleteError instanceof Error &&
        deleteError.message.includes('Cannot delete last sign-in method')
      ) {
        return createApplicationErrorResponse(
          'Cannot delete last sign-in method',
          'PASSKEY_DELETE_BLOCKED',
          400,
        );
      }
      throw deleteError;
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    logger.error('Error deleting passkey', { error });
    return createErrorResponse(error, {
      endpoint: '/api/auth/passkey/[id]',
      operation: 'passkey_delete',
    });
  }
}
