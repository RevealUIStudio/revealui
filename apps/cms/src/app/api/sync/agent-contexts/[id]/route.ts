/**
 * Agent Context Sync Mutation Route (by ID)
 *
 * PATCH /api/sync/agent-contexts/:id — Update an agent context
 * DELETE /api/sync/agent-contexts/:id — Delete an agent context
 *
 * Authenticated. Only the session owner can modify their contexts.
 */

import { getSession } from '@revealui/auth/server';
import { logger } from '@revealui/core/utils/logger';
import { getClient } from '@revealui/db';
import { agentContexts, and, eq } from '@revealui/db/schema';
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
    const body = (await request.json()) as {
      context?: Record<string, unknown>;
      priority?: number;
    };

    if (body.priority !== undefined && (body.priority < 0 || body.priority > 1)) {
      return createValidationErrorResponse(
        'priority must be between 0 and 1',
        'priority',
        body.priority,
      );
    }

    const db = getClient();

    // Only allow updating contexts that belong to the current session
    const updates: Record<string, unknown> = { updatedAt: new Date() };
    if (body.context !== undefined) updates.context = body.context;
    if (body.priority !== undefined) updates.priority = body.priority;

    const [updated] = await db
      .update(agentContexts)
      .set(updates)
      .where(and(eq(agentContexts.id, id), eq(agentContexts.sessionId, session.session.id)))
      .returning();

    if (!updated) {
      return createApplicationErrorResponse('Context not found', 'NOT_FOUND', 404);
    }

    return NextResponse.json(updated);
  } catch (error) {
    logger.error('Error updating agent context', { error });
    return createErrorResponse(error, {
      endpoint: '/api/sync/agent-contexts/[id]',
      operation: 'update_agent_context',
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
    const db = getClient();

    // Only allow deleting contexts that belong to the current session
    const [deleted] = await db
      .delete(agentContexts)
      .where(and(eq(agentContexts.id, id), eq(agentContexts.sessionId, session.session.id)))
      .returning();

    if (!deleted) {
      return createApplicationErrorResponse('Context not found', 'NOT_FOUND', 404);
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    logger.error('Error deleting agent context', { error });
    return createErrorResponse(error, {
      endpoint: '/api/sync/agent-contexts/[id]',
      operation: 'delete_agent_context',
    });
  }
}
