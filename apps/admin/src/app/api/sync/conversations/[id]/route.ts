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
import { conversations } from '@revealui/db/schema';
import { logger } from '@revealui/utils/logger';
import { and, eq } from 'drizzle-orm';
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
  const aiGate = checkAIFeatureGate();
  if (aiGate) return aiGate;

  try {
    const session = await getSession(request.headers, extractRequestContext(request));
    if (!session) {
      return createApplicationErrorResponse('Unauthorized', 'UNAUTHORIZED', 401);
    }

    const { id } = await params;
    if (!isValidUUID(id)) {
      return createValidationErrorResponse('id must be a valid UUID', 'id', id);
    }

    const body = (await request.json()) as {
      title?: string;
      status?: string;
    };

    const updates: Record<string, unknown> = { updatedAt: new Date() };
    if (body.title !== undefined) updates.title = body.title;
    if (body.status !== undefined) updates.status = body.status;

    const db = getClient();

    // Only allow updating conversations owned by the current user
    const [updated] = await db
      .update(conversations)
      .set(updates)
      .where(and(eq(conversations.id, id), eq(conversations.userId, session.user.id)))
      .returning();

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
  const aiGate = checkAIFeatureGate();
  if (aiGate) return aiGate;

  try {
    const session = await getSession(request.headers, extractRequestContext(request));
    if (!session) {
      return createApplicationErrorResponse('Unauthorized', 'UNAUTHORIZED', 401);
    }

    const { id } = await params;
    if (!isValidUUID(id)) {
      return createValidationErrorResponse('id must be a valid UUID', 'id', id);
    }

    const db = getClient();

    // Only allow deleting conversations owned by the current user
    const [deleted] = await db
      .delete(conversations)
      .where(and(eq(conversations.id, id), eq(conversations.userId, session.user.id)))
      .returning();

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
