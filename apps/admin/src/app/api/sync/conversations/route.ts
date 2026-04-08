/**
 * Conversations Sync Mutation Route
 *
 * POST /api/sync/conversations — Create a new conversation
 *
 * Authenticated. Conversations are scoped to the current user.
 * ElectricSQL picks up the database change and pushes it to all shape subscribers.
 */

import crypto from 'node:crypto';
import { getSession } from '@revealui/auth/server';
import { getClient } from '@revealui/db';
import { conversations } from '@revealui/db/schema';
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

const AGENT_ID_RE = /^[a-zA-Z0-9_-]+$/;

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const session = await getSession(request.headers, extractRequestContext(request));
    if (!session) {
      return createApplicationErrorResponse('Unauthorized', 'UNAUTHORIZED', 401);
    }

    const body = (await request.json()) as {
      agent_id?: string;
      title?: string;
      device_id?: string;
    };

    if (!(body.agent_id && AGENT_ID_RE.test(body.agent_id))) {
      return createValidationErrorResponse(
        'agent_id is required and must be alphanumeric with hyphens/underscores',
        'agent_id',
        body.agent_id,
      );
    }

    const db = getClient();
    const id = crypto.randomUUID();
    const now = new Date();

    const [created] = await db
      .insert(conversations)
      .values({
        id,
        userId: session.user.id,
        agentId: body.agent_id,
        title: body.title ?? null,
        deviceId: body.device_id ?? null,
        createdAt: now,
        updatedAt: now,
      })
      .returning();

    return NextResponse.json(created, { status: 201 });
  } catch (error) {
    logger.error('Error creating conversation', { error });
    return createErrorResponse(error, {
      endpoint: '/api/sync/conversations',
      operation: 'create_conversation',
    });
  }
}
