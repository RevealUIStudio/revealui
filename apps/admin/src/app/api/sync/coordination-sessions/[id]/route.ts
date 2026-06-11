/**
 * Coordination Session Sync Mutation Route (by ID)
 *
 * PATCH /api/sync/coordination-sessions/:id  -  Update a coordination session
 * DELETE /api/sync/coordination-sessions/:id  -  Delete a coordination session
 *
 * Authenticated. Coordination data is workspace-shared (this surface backs
 * the agent-activity dashboard), so rows are not scoped to one auth session.
 * Deleting a session that coordination events or work items still reference
 * returns 409 (those FKs have no cascade).
 */

import { getSession } from '@revealui/auth/server';
import { getClient } from '@revealui/db';
import { coordinationSessions } from '@revealui/db/schema';
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

const VALID_SESSION_STATUSES = new Set(['active', 'ended', 'crashed']);
const PG_FOREIGN_KEY_VIOLATION = '23503';

function hasErrorCode(value: unknown, code: string): boolean {
  return typeof value === 'object' && value !== null && (value as { code?: unknown }).code === code;
}

function isForeignKeyViolation(error: unknown): boolean {
  if (hasErrorCode(error, PG_FOREIGN_KEY_VIOLATION)) return true;
  const cause = (error as { cause?: unknown } | null)?.cause;
  return hasErrorCode(cause, PG_FOREIGN_KEY_VIOLATION);
}

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
      task?: string;
      status?: string;
      ended_at?: string;
      tools?: Record<string, number>;
      metadata?: Record<string, unknown>;
    };

    const updates: Record<string, unknown> = {};

    if (body.task !== undefined) {
      if (typeof body.task !== 'string' || body.task.trim().length === 0) {
        return createValidationErrorResponse('task must be a non-empty string', 'task', body.task);
      }
      updates.task = body.task;
    }

    if (body.status !== undefined) {
      if (!VALID_SESSION_STATUSES.has(body.status)) {
        return createValidationErrorResponse(
          `status must be one of: ${[...VALID_SESSION_STATUSES].join(', ')}`,
          'status',
          body.status,
        );
      }
      updates.status = body.status;
    }

    if (body.ended_at !== undefined) {
      if (typeof body.ended_at !== 'string' || Number.isNaN(Date.parse(body.ended_at))) {
        return createValidationErrorResponse(
          'ended_at must be an ISO 8601 date string',
          'ended_at',
          body.ended_at,
        );
      }
      updates.endedAt = new Date(body.ended_at);
    }

    if (body.tools !== undefined) {
      if (
        typeof body.tools !== 'object' ||
        body.tools === null ||
        Array.isArray(body.tools) ||
        !Object.values(body.tools).every((value) => typeof value === 'number')
      ) {
        return createValidationErrorResponse(
          'tools must be a record of numbers',
          'tools',
          body.tools,
        );
      }
      updates.tools = body.tools;
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
      .update(coordinationSessions)
      .set(updates)
      .where(eq(coordinationSessions.id, id))
      .returning();

    if (!updated) {
      return createApplicationErrorResponse('Session not found', 'NOT_FOUND', 404);
    }

    return NextResponse.json(updated);
  } catch (error) {
    logger.error('Error updating coordination session', { error });
    return createErrorResponse(error, {
      endpoint: '/api/sync/coordination-sessions/[id]',
      operation: 'update_coordination_session',
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
      .delete(coordinationSessions)
      .where(eq(coordinationSessions.id, id))
      .returning();

    if (!deleted) {
      return createApplicationErrorResponse('Session not found', 'NOT_FOUND', 404);
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    if (isForeignKeyViolation(error)) {
      return createApplicationErrorResponse(
        'Session is still referenced by coordination events or work items',
        'CONFLICT',
        409,
      );
    }
    logger.error('Error deleting coordination session', { error });
    return createErrorResponse(error, {
      endpoint: '/api/sync/coordination-sessions/[id]',
      operation: 'delete_coordination_session',
    });
  }
}
