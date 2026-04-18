/**
 * Shared Facts Sync Mutation Route (by ID)
 *
 * PATCH /api/sync/shared-facts/:id - Update a shared fact
 * DELETE /api/sync/shared-facts/:id - Delete a shared fact
 *
 * Authenticated. ID must be a valid UUID.
 */

import { getSession } from '@revealui/auth/server';
import { getClient } from '@revealui/db';
import { sharedFacts } from '@revealui/db/schema';
import { logger } from '@revealui/utils/logger';
import { eq } from 'drizzle-orm';
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

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

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
    if (!UUID_RE.test(id)) {
      return createValidationErrorResponse('id must be a valid UUID', 'id', id);
    }

    const body = (await request.json()) as {
      confidence?: number;
      tags?: string[];
      superseded_by?: string;
    };

    const updates: Record<string, unknown> = {};
    if (body.confidence !== undefined) {
      if (body.confidence < 0 || body.confidence > 1) {
        return createValidationErrorResponse(
          'confidence must be between 0 and 1',
          'confidence',
          body.confidence,
        );
      }
      updates.confidence = body.confidence;
    }
    if (body.tags !== undefined) updates.tags = body.tags;
    if (body.superseded_by !== undefined) {
      if (body.superseded_by !== null && !UUID_RE.test(body.superseded_by)) {
        return createValidationErrorResponse(
          'superseded_by must be a valid UUID or null',
          'superseded_by',
          body.superseded_by,
        );
      }
      updates.supersededBy = body.superseded_by;
    }

    if (Object.keys(updates).length === 0) {
      return createValidationErrorResponse('No fields to update', 'body', body);
    }

    const db = getClient();
    const [updated] = await db
      .update(sharedFacts)
      .set(updates)
      .where(eq(sharedFacts.id, id))
      .returning();

    if (!updated) {
      return createApplicationErrorResponse('Shared fact not found', 'NOT_FOUND', 404);
    }

    return NextResponse.json(updated);
  } catch (error) {
    logger.error('Error updating shared fact', { error });
    return createErrorResponse(error, {
      endpoint: '/api/sync/shared-facts/[id]',
      operation: 'update_shared_fact',
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
    if (!UUID_RE.test(id)) {
      return createValidationErrorResponse('id must be a valid UUID', 'id', id);
    }

    const db = getClient();
    const [deleted] = await db.delete(sharedFacts).where(eq(sharedFacts.id, id)).returning();

    if (!deleted) {
      return createApplicationErrorResponse('Shared fact not found', 'NOT_FOUND', 404);
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    logger.error('Error deleting shared fact', { error });
    return createErrorResponse(error, {
      endpoint: '/api/sync/shared-facts/[id]',
      operation: 'delete_shared_fact',
    });
  }
}
