/**
 * Working Memory API Routes
 *
 * GET /api/memory/working/:sessionId - Get working memory
 * POST /api/memory/working/:sessionId - Update working memory
 */

import { getSession } from '@revealui/auth/server';
import { logger } from '@revealui/core/observability/logger';
import { getClient } from '@revealui/db/client';
import { aiMemorySessions, eq } from '@revealui/db/schema';
import { type NextRequest, NextResponse } from 'next/server';
import { checkAIMemoryFeatureGate } from '@/lib/middleware/ai-feature-gate';
import { getNodeIdFromSession } from '@/lib/utilities/nodeId';
import { createErrorResponse, createValidationErrorResponse } from '@/lib/utils/error-response';
import { extractRequestContext } from '@/lib/utils/request-context';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * Dynamically import @revealui/ai working memory dependencies.
 * Returns null if the Pro package is not installed.
 */
async function loadWorkingMemoryDeps() {
  const [persistMod, storesMod] = await Promise.all([
    import('@revealui/ai/memory/persistence').catch(() => null),
    import('@revealui/ai/memory/stores').catch(() => null),
  ]);
  if (!(persistMod && storesMod)) return null;
  return {
    CRDTPersistence: persistMod.CRDTPersistence,
    WorkingMemory: storesMod.WorkingMemory,
  };
}

/**
 * GET /api/memory/working/:sessionId
 * Gets working memory for a session.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> },
): Promise<NextResponse> {
  const aiGate = checkAIMemoryFeatureGate();
  if (aiGate) return aiGate;

  let sessionId: string | undefined;

  try {
    const authSession = await getSession(request.headers, extractRequestContext(request));
    if (!authSession) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const paramsResolved = await params;
    sessionId = paramsResolved.sessionId;

    if (!sessionId || typeof sessionId !== 'string' || sessionId.trim().length === 0) {
      return createValidationErrorResponse(
        'Invalid sessionId: must be a non-empty string',
        'sessionId',
        sessionId,
      );
    }

    const db = getClient();

    // Ownership check: verify this session belongs to the authenticated user
    const [sessionRecord] = await db
      .select({ userId: aiMemorySessions.userId })
      .from(aiMemorySessions)
      .where(eq(aiMemorySessions.id, sessionId))
      .limit(1);

    if (!sessionRecord) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 });
    }
    if (sessionRecord.userId !== authSession.user.id && authSession.user.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const deps = await loadWorkingMemoryDeps();
    if (!deps) {
      return NextResponse.json(
        { error: 'AI features require @revealui/ai (Pro)' },
        { status: 503 },
      );
    }

    const persistence = new deps.CRDTPersistence(db);
    const nodeId = await getNodeIdFromSession(sessionId, db);

    const memory = new deps.WorkingMemory(sessionId, nodeId, persistence);
    await memory.load();

    return NextResponse.json({
      sessionId: memory.getSessionId(),
      context: memory.getContext(),
      sessionState: memory.getSessionState(),
      activeAgents: memory.getActiveAgents(),
    });
  } catch (error) {
    logger.error('Error getting working memory', error instanceof Error ? error : undefined, {
      sessionId,
    });
    return createErrorResponse(error, {
      endpoint: '/api/memory/working/:sessionId',
      operation: 'working_memory_get',
      sessionId,
    });
  }
}

/**
 * POST /api/memory/working/:sessionId
 * Updates working memory for a session.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> },
): Promise<NextResponse> {
  const aiGate = checkAIMemoryFeatureGate();
  if (aiGate) return aiGate;

  let sessionId: string | undefined;

  try {
    const authSession = await getSession(request.headers, extractRequestContext(request));
    if (!authSession) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const paramsResolved = await params;
    sessionId = paramsResolved.sessionId;

    if (!sessionId || typeof sessionId !== 'string' || sessionId.trim().length === 0) {
      return createValidationErrorResponse(
        'Invalid sessionId: must be a non-empty string',
        'sessionId',
        sessionId,
      );
    }

    const db = getClient();

    // Ownership: first POST claims the session; subsequent POSTs verify ownership
    const [existingSession] = await db
      .select({ userId: aiMemorySessions.userId })
      .from(aiMemorySessions)
      .where(eq(aiMemorySessions.id, sessionId))
      .limit(1);

    if (existingSession) {
      if (existingSession.userId !== authSession.user.id && authSession.user.role !== 'admin') {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      }
    } else {
      // Claim the session — bind it to this user
      await db.insert(aiMemorySessions).values({ id: sessionId, userId: authSession.user.id });
    }

    let body: unknown;
    try {
      body = await request.json();
    } catch (jsonError) {
      return createValidationErrorResponse('Invalid JSON in request body', 'body', null, {
        parseError: jsonError instanceof Error ? jsonError.message : 'Malformed JSON',
      });
    }

    if (!body || typeof body !== 'object') {
      return createValidationErrorResponse('Request body must be an object', 'body', body);
    }

    const { context, sessionState, activeAgents } = body as {
      context?: unknown;
      sessionState?: unknown;
      activeAgents?: unknown;
    };

    const deps = await loadWorkingMemoryDeps();
    if (!deps) {
      return NextResponse.json(
        { error: 'AI features require @revealui/ai (Pro)' },
        { status: 503 },
      );
    }

    const persistence = new deps.CRDTPersistence(db);
    const nodeId = await getNodeIdFromSession(sessionId, db);

    const memory = new deps.WorkingMemory(sessionId, nodeId, persistence);
    await memory.load();

    // Update context if provided
    if (context !== undefined) {
      if (typeof context === 'object' && context !== null) {
        memory.setContext(context as Record<string, unknown>);
      }
    }

    // Update session state if provided
    if (sessionState !== undefined && sessionState !== null) {
      memory.updateSessionState(sessionState as Record<string, unknown>);
    }

    // Update active agents if provided
    if (Array.isArray(activeAgents)) {
      // Remove all existing agents and add new ones
      // Note: This is a simplified approach. In production, you'd want
      // to merge intelligently rather than replace
      const currentAgents = memory.getActiveAgents();
      for (const agent of currentAgents) {
        // Remove by agent ID
        memory.removeAgentById(agent.id);
      }

      // Add new agents
      for (const agent of activeAgents) {
        memory.addAgent(agent);
      }
    }

    await memory.save();

    return NextResponse.json({
      success: true,
      sessionId: memory.getSessionId(),
      context: memory.getContext(),
      sessionState: memory.getSessionState(),
      activeAgents: memory.getActiveAgents(),
    });
  } catch (error) {
    logger.error('Error updating working memory', error instanceof Error ? error : undefined, {
      sessionId,
    });
    return createErrorResponse(error, {
      endpoint: '/api/memory/working/:sessionId',
      operation: 'working_memory_post',
      sessionId,
    });
  }
}
