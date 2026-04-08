/**
 * Episodic Memory Update/Delete Route
 *
 * PUT /api/memory/episodic/:userId/:memoryId - Update memory
 * DELETE /api/memory/episodic/:userId/:memoryId - Remove memory
 */

import { getSession } from '@revealui/auth/server';
import type { AgentMemory } from '@revealui/contracts/agents';
import { EmbeddingSchema } from '@revealui/contracts/representation';
import { getClient } from '@revealui/db/client';
import { logger } from '@revealui/utils/logger';
import { type NextRequest, NextResponse } from 'next/server';
import { checkAIMemoryFeatureGate } from '@/lib/middleware/ai-feature-gate';
import { getNodeIdFromUser } from '@/lib/utilities/nodeId';
import {
  createApplicationErrorResponse,
  createErrorResponse,
  createValidationErrorResponse,
} from '@/lib/utils/error-response';
import { extractRequestContext } from '@/lib/utils/request-context';

// Infer Database type from getClient return type
type Database = ReturnType<typeof getClient>;

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
 * PUT /api/memory/episodic/:userId/:memoryId
 * Updates a memory in episodic memory.
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ userId: string; memoryId: string }> },
): Promise<NextResponse> {
  let userId: string | undefined;
  let memoryId: string | undefined;

  try {
    const authSession = await getSession(request.headers, extractRequestContext(request));
    if (!authSession) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const memoryGate = checkAIMemoryFeatureGate();
    if (memoryGate) return memoryGate;

    const paramsResolved = await params;
    userId = paramsResolved.userId;
    memoryId = paramsResolved.memoryId;

    if (!userId || typeof userId !== 'string' || userId.trim().length === 0) {
      return createValidationErrorResponse(
        'Invalid userId: must be a non-empty string',
        'userId',
        userId,
      );
    }

    if (!memoryId || typeof memoryId !== 'string' || memoryId.trim().length === 0) {
      return createValidationErrorResponse(
        'Invalid memoryId: must be a non-empty string',
        'memoryId',
        memoryId,
      );
    }

    if (authSession.user.id !== userId && authSession.user.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Parse request body
    let body: Partial<AgentMemory>;
    try {
      const jsonBody = (await request.json()) as Partial<AgentMemory>;
      body = jsonBody;
    } catch (jsonError) {
      return createValidationErrorResponse('Invalid JSON in request body', 'body', null, {
        parseError: jsonError instanceof Error ? jsonError.message : 'Malformed JSON',
      });
    }

    const deps = await loadEpisodicDeps();
    if (!deps) {
      return NextResponse.json(
        { error: 'AI features require @revealui/ai (Pro)' },
        { status: 503 },
      );
    }

    const db: Database = getClient();
    const persistence = new deps.CRDTPersistence(db);
    const nodeId = await getNodeIdFromUser(userId, db);

    const memory = new deps.EpisodicMemory(userId, nodeId, db, persistence);
    await memory.load();

    // Check if memory exists
    const existingMemory: AgentMemory | null = await memory.get(memoryId);
    if (!existingMemory) {
      return createApplicationErrorResponse('Memory not found', 'MEMORY_NOT_FOUND', 404, {
        userId,
        memoryId,
      });
    }

    // Validate embedding if provided
    if (body.embedding) {
      const validationResult = EmbeddingSchema.safeParse(body.embedding);
      if (!validationResult.success) {
        return createValidationErrorResponse(
          `Invalid embedding structure: ${validationResult.error.message}`,
          'embedding',
          body.embedding,
          {
            validationErrors: validationResult.error.issues,
          },
        );
      }
    }

    // Build update object for EpisodicMemory/VectorMemoryService
    // Use EpisodicMemory's update mechanism which delegates to VectorMemoryService
    const updateData: Partial<AgentMemory> = {};

    if (body.content !== undefined) {
      if (typeof body.content !== 'string' || body.content.trim().length === 0) {
        return createValidationErrorResponse(
          'content must be a non-empty string',
          'content',
          body.content,
        );
      }
      updateData.content = body.content;
    }

    if (body.type !== undefined) {
      updateData.type = body.type;
    }

    if (body.source !== undefined) {
      updateData.source = body.source;
    }

    if (body.embedding !== undefined) {
      updateData.embedding = body.embedding;
    }

    if (body.metadata !== undefined) {
      updateData.metadata = body.metadata;
    }

    if (body.verified !== undefined) {
      updateData.verified = body.verified;
    }

    // Update access count and accessedAt when updating
    updateData.accessedAt = new Date().toISOString();

    const updatedMemory = await memory.update(memoryId, updateData);

    return NextResponse.json({
      success: true,
      memory: updatedMemory,
    });
  } catch (error) {
    logger.error('Error updating episodic memory', error instanceof Error ? error : undefined, {
      userId,
      memoryId,
    });
    return createErrorResponse(error, {
      endpoint: '/api/memory/episodic/:userId/:memoryId',
      operation: 'episodic_memory_update',
      userId,
      memoryId,
    });
  }
}

/**
 * DELETE /api/memory/episodic/:userId/:memoryId
 * Removes a memory from episodic memory.
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ userId: string; memoryId: string }> },
): Promise<NextResponse> {
  const aiGate = checkAIMemoryFeatureGate();
  if (aiGate) return aiGate;

  let userId: string | undefined;
  let memoryId: string | undefined;

  try {
    const authSession = await getSession(request.headers, extractRequestContext(request));
    if (!authSession) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const paramsResolved = await params;
    userId = paramsResolved.userId;
    memoryId = paramsResolved.memoryId;

    if (!userId || typeof userId !== 'string' || userId.trim().length === 0) {
      return createValidationErrorResponse(
        'Invalid userId: must be a non-empty string',
        'userId',
        userId,
      );
    }

    if (!memoryId || typeof memoryId !== 'string' || memoryId.trim().length === 0) {
      return createValidationErrorResponse(
        'Invalid memoryId: must be a non-empty string',
        'memoryId',
        memoryId,
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

    const db: Database = getClient();
    const persistence = new deps.CRDTPersistence(db);
    const nodeId = await getNodeIdFromUser(userId, db);

    const memory = new deps.EpisodicMemory(userId, nodeId, db, persistence);
    await memory.load();

    const count: number = await memory.removeById(memoryId);
    await memory.save();

    return NextResponse.json({
      success: true,
      removed: count > 0,
      count,
    });
  } catch (error) {
    logger.error('Error removing episodic memory', error instanceof Error ? error : undefined, {
      userId,
      memoryId,
    });
    return createErrorResponse(error, {
      endpoint: '/api/memory/episodic/:userId/:memoryId',
      operation: 'episodic_memory_delete',
      userId,
      memoryId,
    });
  }
}
