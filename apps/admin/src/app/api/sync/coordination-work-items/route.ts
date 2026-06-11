/**
 * Coordination Work Items Sync Mutation Route
 *
 * POST /api/sync/coordination-work-items  -  Create a coordination work item
 *
 * Authenticated. Coordination data is workspace-shared (this surface backs
 * the coordination dashboard). owner_session is intentionally not settable
 * here  -  it carries an FK to coordination_sessions and is managed by the
 * session that claims the item. ElectricSQL fans the change out to all
 * shape subscribers.
 */

import crypto from 'node:crypto';
import { getSession } from '@revealui/auth/server';
import { getClient } from '@revealui/db';
import { coordinationWorkItems } from '@revealui/db/schema';
import { logger } from '@revealui/utils/logger';
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

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const session = await getSession(request.headers, extractRequestContext(request));
    if (!session) {
      return createApplicationErrorResponse('Unauthorized', 'UNAUTHORIZED', 401);
    }

    const body = (await request.json()) as {
      title?: string;
      description?: string;
      priority?: number;
      owner_agent?: string;
      parent_id?: string;
      metadata?: Record<string, unknown>;
    };

    if (!body.title || typeof body.title !== 'string' || body.title.trim().length === 0) {
      return createValidationErrorResponse('title is required', 'title', body.title);
    }

    if (body.description !== undefined && typeof body.description !== 'string') {
      return createValidationErrorResponse(
        'description must be a string',
        'description',
        body.description,
      );
    }

    if (body.priority !== undefined && !Number.isInteger(body.priority)) {
      return createValidationErrorResponse(
        'priority must be an integer',
        'priority',
        body.priority,
      );
    }

    if (body.owner_agent !== undefined && !isSyncIdentifier(body.owner_agent)) {
      return createValidationErrorResponse(
        'owner_agent must be alphanumeric with hyphens/underscores',
        'owner_agent',
        body.owner_agent,
      );
    }

    if (body.parent_id !== undefined && !isSyncIdentifier(body.parent_id)) {
      return createValidationErrorResponse(
        'parent_id must be alphanumeric with hyphens/underscores',
        'parent_id',
        body.parent_id,
      );
    }

    if (
      body.metadata !== undefined &&
      (typeof body.metadata !== 'object' || body.metadata === null || Array.isArray(body.metadata))
    ) {
      return createValidationErrorResponse('metadata must be an object', 'metadata', body.metadata);
    }

    const db = getClient();

    const values: typeof coordinationWorkItems.$inferInsert = {
      id: crypto.randomUUID(),
      title: body.title,
    };
    if (body.description !== undefined) values.description = body.description;
    if (body.priority !== undefined) values.priority = body.priority;
    if (body.owner_agent !== undefined) values.ownerAgent = body.owner_agent;
    if (body.parent_id !== undefined) values.parentId = body.parent_id;
    if (body.metadata !== undefined) values.metadata = body.metadata;

    const [created] = await db.insert(coordinationWorkItems).values(values).returning();

    return NextResponse.json(created, { status: 201 });
  } catch (error) {
    logger.error('Error creating coordination work item', { error });
    return createErrorResponse(error, {
      endpoint: '/api/sync/coordination-work-items',
      operation: 'create_coordination_work_item',
    });
  }
}
