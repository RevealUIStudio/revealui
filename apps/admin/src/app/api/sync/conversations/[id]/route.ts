/**
 * Conversation Sync Mutation Route (by ID)
 *
 * PATCH /api/sync/conversations/:id  -  Update a conversation
 * DELETE /api/sync/conversations/:id  -  Delete a conversation
 *
 * Authenticated. Only the conversation owner can modify it.
 */

import { getSession } from '@revealui/auth/server';
import { getClient } from '@revealui/db';
import {
  deleteCollectionConversation,
  updateCollectionConversation,
  updateCollectionConversationSchema,
} from '@revealui/db/queries/conversations';
import { logger } from '@revealui/utils/logger';
import { type NextRequest, NextResponse } from 'next/server';
import { checkAIFeatureGate } from '@/lib/middleware/ai-feature-gate';
import {
  createApplicationErrorResponse,
  createErrorResponse,
  createValidationErrorResponse,
} from '@/lib/utils/error-response';
import { extractRequestContext } from '@/lib/utils/request-context';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

function isValidUUID(s: string): boolean {
  if (s.length !== 36) return false;
  for (let i = 0; i < 36; i++) {
    if (i === 8 || i === 13 || i === 18 || i === 23) {
      if (s[i] !== '-') return false;
    } else {
      const c = s.charCodeAt(i);
      const isHex =
        (c >= 48 && c <= 57) || // 0-9
        (c >= 65 && c <= 70) || // A-F
        (c >= 97 && c <= 102); // a-f
      if (!isHex) return false;
    }
  }
  return true;
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  try {
    const session = await getSession(request.headers, extractRequestContext(request));
    if (!session) {
      return createApplicationErrorResponse('Unauthorized', 'UNAUTHORIZED', 401);
    }

    const aiGate = await checkAIFeatureGate(session.user.id);
    if (aiGate) return aiGate;

    const { id } = await params;
    if (!isValidUUID(id)) {
      return createValidationErrorResponse('id must be a valid UUID', 'id', id);
    }

    const body = updateCollectionConversationSchema.safeParse(
      await request.json().catch(() => undefined),
    );
    if (!body.success) {
      return createValidationErrorResponse('Invalid conversation update', 'body', undefined);
    }

    const db = getClient();
    const updated = await updateCollectionConversation(db, id, body.data, session.user.id);

    if (!updated) {
      return createApplicationErrorResponse('Conversation not found', 'NOT_FOUND', 404);
    }

    return NextResponse.json(updated);
  } catch (error) {
    logger.error('Error updating conversation', { error });
    return createErrorResponse(error, {
      endpoint: '/api/sync/conversations/[id]',
      operation: 'update_conversation',
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

    const aiGate = await checkAIFeatureGate(session.user.id);
    if (aiGate) return aiGate;

    const { id } = await params;
    if (!isValidUUID(id)) {
      return createValidationErrorResponse('id must be a valid UUID', 'id', id);
    }

    const db = getClient();

    // Only allow deleting conversations owned by the current user
    const deleted = await deleteCollectionConversation(db, id, session.user.id);

    if (!deleted) {
      return createApplicationErrorResponse('Conversation not found', 'NOT_FOUND', 404);
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    logger.error('Error deleting conversation', { error });
    return createErrorResponse(error, {
      endpoint: '/api/sync/conversations/[id]',
      operation: 'delete_conversation',
    });
  }
}
