/**
 * Episodic Memory API Routes
 *
 * GET /api/memory/episodic/:userId - Get episodic memories
 * POST /api/memory/episodic/:userId - Add memory
 * DELETE /api/memory/episodic/:userId/:memoryId - Remove memory
 */

import { getSession } from '@revealui/auth/server';
import { AgentMemoryContract } from '@revealui/contracts';
import { getClient } from '@revealui/db/client';
import { logger } from '@revealui/utils/logger';
import { type NextRequest, NextResponse } from 'next/server';
import { checkAIMemoryFeatureGate } from '@/lib/middleware/ai-feature-gate';
import { getNodeIdFromUser } from '@/lib/utilities/nodeId';
import { createErrorResponse, createValidationErrorResponse } from '@/lib/utils/error-response';
import { extractRequestContext } from '@/lib/utils/request-context';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * Dynamically import @revealui/ai episodic memory dependencies.
 * Returns null if the Pro package is not installed.
 */
async function loadEpisodicDeps() {
  const [persistMod, storesMod] = await Promise.all([
    import('@revealui/ai/memory/persistence').catch(() => null),
    import('@revealui/ai/memory/stores').catch(() => null),
  ]);
  if (!(persistMod && storesMod)) return null;
  return {
    CRDTPersistence: persistMod.CRDTPersistence,
    EpisodicMemory: storesMod.EpisodicMemory,
  };
}

/**
 * GET /api/memory/episodic/:userId
 * Gets all episodic memories for a user.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ userId: string }> },
): Promise<NextResponse> {
  const aiGate = checkAIMemoryFeatureGate();
  if (aiGate) return aiGate;

  let userId: string | undefined;

  try {
    const authSession = await getSession(request.headers, extractRequestContext(request));
    if (!authSession) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const paramsResolved = await params;
    userId = paramsResolved.userId;

    if (!userId || typeof userId !== 'string' || userId.trim().length === 0) {
      return createValidationErrorResponse(
        'Invalid userId: must be a non-empty string',
        'userId',
        userId,
      );
    }

    if (authSession.user.id !== userId && authSession.user.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const deps = await loadEpisodicDeps();
    if (!deps) {
      return NextResponse.json(
        { error: 'AI features require @revealui/ai (Pro)' },
        { status: 503 },
      );
    }

    const db = getClient();
    const persistence = new deps.CRDTPersistence(db);
    const nodeId = await getNodeIdFromUser(userId, db);

    const memory = new deps.EpisodicMemory(userId, nodeId, db, persistence);
    await memory.load();

    const memories = await memory.getAll();

    return NextResponse.json({
      userId: memory.getUserId(),
      memories,
      accessCount: memory.getAccessCount(),
    });
  } catch (error) {
    logger.error('Error getting episodic memory', error instanceof Error ? error : undefined, {
      userId,
    });
    return createErrorResponse(error, {
      endpoint: '/api/memory/episodic/:userId',
      operation: 'episodic_memory_get',
      userId,
    });
  }
}

/**
 * POST /api/memory/episodic/:userId
 * Adds a memory to episodic memory.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ userId: string }> },
): Promise<NextResponse> {
  const aiGate = checkAIMemoryFeatureGate();
  if (aiGate) return aiGate;

  let userId: string | undefined;

  try {
    const authSession = await getSession(request.headers, extractRequestContext(request));
    if (!authSession) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const paramsResolved = await params;
    userId = paramsResolved.userId;

    if (!userId || typeof userId !== 'string' || userId.trim().length === 0) {
      return createValidationErrorResponse(
        'Invalid userId: must be a non-empty string',
        'userId',
        userId,
      );
    }

    if (authSession.user.id !== userId && authSession.user.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    let body: unknown;
    try {
      body = await request.json();
    } catch (jsonError) {
      return createValidationErrorResponse('Invalid JSON in request body', 'body', null, {
        parseError: jsonError instanceof Error ? jsonError.message : 'Malformed JSON',
      });
    }

    // Validate request body using contract
    const validationResult = AgentMemoryContract.validate(body);

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

    const memoryData = validationResult.data;

    const deps = await loadEpisodicDeps();
    if (!deps) {
      return NextResponse.json(
        { error: 'AI features require @revealui/ai (Pro)' },
        { status: 503 },
      );
    }

    const db = getClient();
    const persistence = new deps.CRDTPersistence(db);
    const nodeId = await getNodeIdFromUser(userId, db);

    const memory = new deps.EpisodicMemory(userId, nodeId, db, persistence);
    await memory.load();

    const tag = await memory.add(memoryData);
    await memory.save();

    return NextResponse.json({
      success: true,
      tag,
      memoryId: memoryData.id,
    });
  } catch (error) {
    logger.error('Error adding episodic memory', error instanceof Error ? error : undefined, {
      userId,
    });
    return createErrorResponse(error, {
      endpoint: '/api/memory/episodic/:userId',
      operation: 'episodic_memory_post',
      userId,
    });
  }
}
