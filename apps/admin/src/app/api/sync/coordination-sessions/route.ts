/**
 * Coordination Sessions Sync Mutation Route
 *
 * POST /api/sync/coordination-sessions  -  Register a coordination session
 *
 * Authenticated. Upserts the coordination_agents identity first (session
 * rows carry a NOT NULL FK to the agent and no other writer exists on this
 * surface), then inserts the session. coordination_agents.env is NOT NULL
 * and the hook input has no env field, so an optional metadata.env hint is
 * honored with an 'unknown' fallback. ElectricSQL fans the change out to
 * all shape subscribers.
 */

import crypto from 'node:crypto';
import { getSession } from '@revealui/auth/server';
import { getClient } from '@revealui/db';
import { coordinationAgents, coordinationSessions } from '@revealui/db/schema';
import { logger } from '@revealui/utils/logger';
import { sql } from 'drizzle-orm';
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
      agent_id?: string;
      task?: string;
      pid?: number;
      metadata?: Record<string, unknown>;
    };

    if (!(body.agent_id && isSyncIdentifier(body.agent_id))) {
      return createValidationErrorResponse(
        'agent_id is required and must be alphanumeric with hyphens/underscores',
        'agent_id',
        body.agent_id,
      );
    }

    if (
      body.task !== undefined &&
      (typeof body.task !== 'string' || body.task.trim().length === 0)
    ) {
      return createValidationErrorResponse('task must be a non-empty string', 'task', body.task);
    }

    if (body.pid !== undefined && (!Number.isInteger(body.pid) || body.pid <= 0)) {
      return createValidationErrorResponse('pid must be a positive integer', 'pid', body.pid);
    }

    if (
      body.metadata !== undefined &&
      (typeof body.metadata !== 'object' || body.metadata === null || Array.isArray(body.metadata))
    ) {
      return createValidationErrorResponse('metadata must be an object', 'metadata', body.metadata);
    }

    const db = getClient();
    const now = new Date();

    const metadataEnv = body.metadata?.env;
    const env =
      typeof metadataEnv === 'string' && metadataEnv.trim().length > 0 ? metadataEnv : 'unknown';

    await db
      .insert(coordinationAgents)
      .values({ id: body.agent_id, env, firstSeen: now, lastSeen: now, totalSessions: 1 })
      .onConflictDoUpdate({
        target: coordinationAgents.id,
        set: {
          lastSeen: now,
          totalSessions: sql`${coordinationAgents.totalSessions} + 1`,
        },
      });

    const values: typeof coordinationSessions.$inferInsert = {
      id: crypto.randomUUID(),
      agentId: body.agent_id,
    };
    if (body.task !== undefined) values.task = body.task;
    if (body.pid !== undefined) values.pid = body.pid;
    if (body.metadata !== undefined) values.metadata = body.metadata;

    const [created] = await db.insert(coordinationSessions).values(values).returning();

    return NextResponse.json(created, { status: 201 });
  } catch (error) {
    logger.error('Error creating coordination session', { error });
    return createErrorResponse(error, {
      endpoint: '/api/sync/coordination-sessions',
      operation: 'create_coordination_session',
    });
  }
}
