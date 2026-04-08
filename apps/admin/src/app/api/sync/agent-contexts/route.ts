/**
 * Agent Contexts Sync Mutation Route
 *
 * POST /api/sync/agent-contexts — Create a new agent context
 *
 * Authenticated. The context is scoped to the current session.
 * ElectricSQL picks up the database change and pushes it to all shape subscribers.
 */

import { getSession } from '@revealui/auth/server';
import { getClient } from '@revealui/db';
import { agentContexts } from '@revealui/db/schema';
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

const AGENT_ID_RE = /^[a-zA-Z0-9_-]+$/;

export async function POST(request: NextRequest): Promise<NextResponse> {
  const aiGate = checkAIFeatureGate();
  if (aiGate) return aiGate;

  try {
    const session = await getSession(request.headers, extractRequestContext(request));
    if (!session) {
      return createApplicationErrorResponse('Unauthorized', 'UNAUTHORIZED', 401);
    }

    const body = (await request.json()) as {
      agent_id?: string;
      context?: Record<string, unknown>;
      priority?: number;
    };

    if (!(body.agent_id && AGENT_ID_RE.test(body.agent_id))) {
      return createValidationErrorResponse(
        'agent_id is required and must be alphanumeric with hyphens/underscores',
        'agent_id',
        body.agent_id,
      );
    }

    if (body.priority !== undefined && (body.priority < 0 || body.priority > 1)) {
      return createValidationErrorResponse(
        'priority must be between 0 and 1',
        'priority',
        body.priority,
      );
    }

    const db = getClient();
    const id = `${session.session.id}:${body.agent_id}`;
    const now = new Date();

    const [created] = await db
      .insert(agentContexts)
      .values({
        id,
        sessionId: session.session.id,
        agentId: body.agent_id,
        context: body.context ?? {},
        priority: body.priority ?? 0.5,
        createdAt: now,
        updatedAt: now,
      })
      .onConflictDoUpdate({
        target: agentContexts.id,
        set: {
          context: body.context ?? {},
          priority: body.priority ?? 0.5,
          updatedAt: now,
        },
      })
      .returning();

    return NextResponse.json(created, { status: 201 });
  } catch (error) {
    logger.error('Error creating agent context', { error });
    return createErrorResponse(error, {
      endpoint: '/api/sync/agent-contexts',
      operation: 'create_agent_context',
    });
  }
}
