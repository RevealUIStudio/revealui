/**
 * Agent Memory Sync Mutation Route (by ID)
 *
 * PATCH /api/sync/agent-memories/:id  -  Update an agent memory
 * DELETE /api/sync/agent-memories/:id  -  Delete an agent memory
 *
 * Authenticated. ID must be a valid UUID.
 */

import { getSession } from '@revealui/auth/server';
import { getClient } from '@revealui/db';
import { agentMemories } from '@revealui/db/schema';
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
      content?: string;
      type?: string;
      metadata?: Record<string, unknown>;
      expires_at?: string | null;
    };

    const db = getClient();
    const updates: Record<string, unknown> = {};
    if (body.content !== undefined) updates.content = body.content;
    if (body.type !== undefined) updates.type = body.type;
    if (body.metadata !== undefined) updates.metadata = body.metadata;
    if (body.expires_at !== undefined) {
      updates.expiresAt = body.expires_at ? new Date(body.expires_at) : null;
    }

    if (Object.keys(updates).length === 0) {
      return createValidationErrorResponse('No fields to update', 'body', body);
    }

    const [updated] = await db
      .update(agentMemories)
      .set(updates)
      .where(eq(agentMemories.id, id))
      .returning();

    if (!updated) {
      return createApplicationErrorResponse('Memory not found', 'NOT_FOUND', 404);
    }

    return NextResponse.json(updated);
  } catch (error) {
    logger.error('Error updating agent memory', { error });
    return createErrorResponse(error, {
      endpoint: '/api/sync/agent-memories/[id]',
      operation: 'update_agent_memory',
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
    const [deleted] = await db.delete(agentMemories).where(eq(agentMemories.id, id)).returning();

    if (!deleted) {
      return createApplicationErrorResponse('Memory not found', 'NOT_FOUND', 404);
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    logger.error('Error deleting agent memory', { error });
    return createErrorResponse(error, {
      endpoint: '/api/sync/agent-memories/[id]',
      operation: 'delete_agent_memory',
    });
  }
}
