/**
 * Coordination Work Item Sync Mutation Route (by ID)
 *
 * PATCH /api/sync/coordination-work-items/:id  -  Update a work item
 * DELETE /api/sync/coordination-work-items/:id  -  Delete a work item
 *
 * Authenticated. Coordination data is workspace-shared (this surface backs
 * the coordination dashboard), so rows are not scoped to one auth session.
 * completed_at tracks the status transition  -  the published update input
 * has no completed_at field, so this route manages it: entering 'done' sets
 * it, leaving 'done' clears it.
 */

import { getSession } from '@revealui/auth/server';
import { getClient } from '@revealui/db';
import { coordinationWorkItems } from '@revealui/db/schema';
import { logger } from '@revealui/utils/logger';
import { eq } from 'drizzle-orm';
import { type NextRequest, NextResponse } from 'next/server';
import {
  createApplicationErrorResponse,
  createErrorResponse,
  createValidationErrorResponse,
} from '@/lib/utils/error-response';
import { isSyncIdentifier } from '@/lib/utils/identifier-validation';
import { extractRequestContext } from '@/lib/utils/request-context';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const VALID_WORK_ITEM_STATUSES = new Set(['open', 'claimed', 'done', 'cancelled']);

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  try {
    const session = await getSession(request.headers, extractRequestContext(request));
    if (!session) {
      return createApplicationErrorResponse('Unauthorized', 'UNAUTHORIZED', 401);
    }

    const { id } = await params;
    if (!isSyncIdentifier(id)) {
      return createValidationErrorResponse(
        'id must be alphanumeric with hyphens/underscores',
        'id',
        id,
      );
    }

    const body = (await request.json()) as {
      title?: string;
      description?: string;
      status?: string;
      priority?: number;
      owner_agent?: string;
      metadata?: Record<string, unknown>;
    };

    const updates: Record<string, unknown> = {};

    if (body.title !== undefined) {
      if (typeof body.title !== 'string' || body.title.trim().length === 0) {
        return createValidationErrorResponse(
          'title must be a non-empty string',
          'title',
          body.title,
        );
      }
      updates.title = body.title;
    }

    if (body.description !== undefined) {
      if (typeof body.description !== 'string') {
        return createValidationErrorResponse(
          'description must be a string',
          'description',
          body.description,
        );
      }
      updates.description = body.description;
    }

    if (body.status !== undefined) {
      if (!VALID_WORK_ITEM_STATUSES.has(body.status)) {
        return createValidationErrorResponse(
          `status must be one of: ${[...VALID_WORK_ITEM_STATUSES].join(', ')}`,
          'status',
          body.status,
        );
      }
      updates.status = body.status;
      updates.completedAt = body.status === 'done' ? new Date() : null;
    }

    if (body.priority !== undefined) {
      if (!Number.isInteger(body.priority)) {
        return createValidationErrorResponse(
          'priority must be an integer',
          'priority',
          body.priority,
        );
      }
      updates.priority = body.priority;
    }

    if (body.owner_agent !== undefined) {
      if (!isSyncIdentifier(body.owner_agent)) {
        return createValidationErrorResponse(
          'owner_agent must be alphanumeric with hyphens/underscores',
          'owner_agent',
          body.owner_agent,
        );
      }
      updates.ownerAgent = body.owner_agent;
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
      .update(coordinationWorkItems)
      .set(updates)
      .where(eq(coordinationWorkItems.id, id))
      .returning();

    if (!updated) {
      return createApplicationErrorResponse('Work item not found', 'NOT_FOUND', 404);
    }

    return NextResponse.json(updated);
  } catch (error) {
    logger.error('Error updating coordination work item', { error });
    return createErrorResponse(error, {
      endpoint: '/api/sync/coordination-work-items/[id]',
      operation: 'update_coordination_work_item',
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

    const { id } = await params;
    if (!isSyncIdentifier(id)) {
      return createValidationErrorResponse(
        'id must be alphanumeric with hyphens/underscores',
        'id',
        id,
      );
    }

    const db = getClient();
    const [deleted] = await db
      .delete(coordinationWorkItems)
      .where(eq(coordinationWorkItems.id, id))
      .returning();

    if (!deleted) {
      return createApplicationErrorResponse('Work item not found', 'NOT_FOUND', 404);
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    logger.error('Error deleting coordination work item', { error });
    return createErrorResponse(error, {
      endpoint: '/api/sync/coordination-work-items/[id]',
      operation: 'delete_coordination_work_item',
    });
  }
}
