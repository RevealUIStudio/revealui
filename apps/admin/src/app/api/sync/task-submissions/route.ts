/**
 * Task Submissions Sync Mutation Route
 *
 * POST /api/sync/task-submissions  -  Submit an unmatched marketplace task
 *
 * Authenticated. Inserts a 'pending' submission owned by the current user.
 * Agent matching, pricing, and the x402 payment gate live in the server's
 * revmarket API (POST /api/revmarket/tasks)  -  this surface never assigns
 * an agent or sets billing fields, so it cannot bypass that gate.
 */

import crypto from 'node:crypto';
import { getSession } from '@revealui/auth/server';
import { getClient } from '@revealui/db';
import { taskSubmissions } from '@revealui/db/schema';
import { logger } from '@revealui/utils/logger';
import { type NextRequest, NextResponse } from 'next/server';
import {
  createApplicationErrorResponse,
  createErrorResponse,
  createValidationErrorResponse,
} from '@/lib/utils/error-response';
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
      skill_name?: string;
      input?: Record<string, unknown>;
      priority?: number;
    };

    if (
      !body.skill_name ||
      typeof body.skill_name !== 'string' ||
      body.skill_name.trim().length === 0
    ) {
      return createValidationErrorResponse('skill_name is required', 'skill_name', body.skill_name);
    }

    if (!body.input || typeof body.input !== 'object' || Array.isArray(body.input)) {
      return createValidationErrorResponse(
        'input is required and must be an object',
        'input',
        body.input,
      );
    }

    if (
      body.priority !== undefined &&
      (!Number.isInteger(body.priority) || body.priority < 1 || body.priority > 5)
    ) {
      return createValidationErrorResponse(
        'priority must be an integer between 1 and 5',
        'priority',
        body.priority,
      );
    }

    const db = getClient();

    const values: typeof taskSubmissions.$inferInsert = {
      id: crypto.randomUUID(),
      submitterId: session.user.id,
      skillName: body.skill_name,
      input: body.input,
    };
    if (body.priority !== undefined) values.priority = body.priority;

    const [created] = await db.insert(taskSubmissions).values(values).returning();

    return NextResponse.json(created, { status: 201 });
  } catch (error) {
    logger.error('Error creating task submission', { error });
    return createErrorResponse(error, {
      endpoint: '/api/sync/task-submissions',
      operation: 'create_task_submission',
    });
  }
}
