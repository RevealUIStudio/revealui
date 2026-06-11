/**
 * Shared Memory Sync Mutation Route (by ID)
 *
 * PATCH /api/sync/shared-memories/:id  -  Update a shared memory
 * DELETE /api/sync/shared-memories/:id  -  Delete a shared memory
 *
 * Authenticated. Operates only on agent_memories rows with scope 'shared'
 * or 'reconciled'  -  private memories are managed via
 * /api/sync/agent-memories/:id. ID must be a valid UUID.
 */

import { getSession } from '@revealui/auth/server';
import { getClient } from '@revealui/db';
import { agentMemories } from '@revealui/db/schema';
import { logger } from '@revealui/utils/logger';
import { and, eq, or } from 'drizzle-orm';
import { type NextRequest, NextResponse } from 'next/server';
import { checkAIFeatureGate } from '@/lib/middleware/ai-feature-gate';
import {
  createApplicationErrorResponse,
  createErrorResponse,
  createValidationErrorResponse,
} from '@/lib/utils/error-response';
import { isUuid } from '@/lib/utils/identifier-validation';
import { extractRequestContext } from '@/lib/utils/request-context';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// Mirrors VALID_MEMORY_TYPES in ../route.ts (route files may only export handlers).
const VALID_MEMORY_TYPES = new Set([
  'fact',
  'preference',
  'decision',
  'feedback',
  'example',
  'correction',
  'skill',
  'warning',
]);

/** Restricts writes to shared-scope rows so this route cannot touch private memories. */
function sharedScopeById(id: string) {
  return and(
    eq(agentMemories.id, id),
    or(eq(agentMemories.scope, 'shared'), eq(agentMemories.scope, 'reconciled')),
  );
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
    if (!isUuid(id)) {
      return createValidationErrorResponse('id must be a valid UUID', 'id', id);
    }

    const body = (await request.json()) as {
      content?: string;
      type?: string;
      metadata?: Record<string, unknown>;
    };

    const updates: Record<string, unknown> = {};

    if (body.content !== undefined) {
      if (typeof body.content !== 'string' || body.content.trim().length === 0) {
        return createValidationErrorResponse(
          'content must be a non-empty string',
          'content',
          body.content,
        );
      }
      updates.content = body.content;
    }

    if (body.type !== undefined) {
      if (!VALID_MEMORY_TYPES.has(body.type)) {
        return createValidationErrorResponse(
          `type must be one of: ${[...VALID_MEMORY_TYPES].join(', ')}`,
          'type',
          body.type,
        );
      }
      updates.type = body.type;
    }

    if (body.metadata !== undefined) {
      if (
        typeof body.metadata !== 'object' ||
        body.metadata === null ||
        Array.isArray(body.metadata)
      ) {
        return createValidationErrorResponse(
          'metadata must be an object',
          'metadata',
          body.metadata,
        );
      }
      updates.metadata = body.metadata;
    }

    if (Object.keys(updates).length === 0) {
      return createValidationErrorResponse('No fields to update', 'body', body);
    }

    const db = getClient();
    const [updated] = await db
      .update(agentMemories)
      .set(updates)
      .where(sharedScopeById(id))
      .returning();

    if (!updated) {
      return createApplicationErrorResponse('Shared memory not found', 'NOT_FOUND', 404);
    }

    return NextResponse.json(updated);
  } catch (error) {
    logger.error('Error updating shared memory', { error });
    return createErrorResponse(error, {
      endpoint: '/api/sync/shared-memories/[id]',
      operation: 'update_shared_memory',
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
    if (!isUuid(id)) {
      return createValidationErrorResponse('id must be a valid UUID', 'id', id);
    }

    const db = getClient();
    const [deleted] = await db.delete(agentMemories).where(sharedScopeById(id)).returning();

    if (!deleted) {
      return createApplicationErrorResponse('Shared memory not found', 'NOT_FOUND', 404);
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    logger.error('Error deleting shared memory', { error });
    return createErrorResponse(error, {
      endpoint: '/api/sync/shared-memories/[id]',
      operation: 'delete_shared_memory',
    });
  }
}
