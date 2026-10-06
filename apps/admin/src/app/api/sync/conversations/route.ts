/**
 * Conversations Sync Mutation Route
 *
 * POST /api/sync/conversations  -  Create a new conversation
 *
 * Authenticated. Conversations are scoped to the current user.
 * ElectricSQL picks up the database change and pushes it to all shape subscribers.
 */

import { getSession } from '@revealui/auth/server';
import { getClient } from '@revealui/db';
import { createCollectionConversation } from '@revealui/db/queries/conversations';
import { logger } from '@revealui/utils/logger';
import { type NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { checkAIFeatureGate } from '@/lib/middleware/ai-feature-gate';
import {
  createApplicationErrorResponse,
  createErrorResponse,
  createValidationErrorResponse,
} from '@/lib/utils/error-response';
import { extractRequestContext } from '@/lib/utils/request-context';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

function isValidAgentId(id: string): boolean {
  if (id.length === 0) return false;
  for (let i = 0; i < id.length; i++) {
    const c = id.charCodeAt(i);
    const isAlphaNum =
      (c >= 48 && c <= 57) || // 0-9
      (c >= 65 && c <= 90) || // A-Z
      (c >= 97 && c <= 122); // a-z
    if (!(isAlphaNum || c === 95 || c === 45)) return false; // _ or -
  }
  return true;
}

const createSyncConversationBodySchema = z
  .object({
    agent_id: z.string().min(1).max(200).refine(isValidAgentId),
    title: z.string().trim().min(1).max(500).nullable().optional(),
    device_id: z.string().min(1).max(200).nullable().optional(),
  })
  .strict();

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const session = await getSession(request.headers, extractRequestContext(request));
    if (!session) {
      return createApplicationErrorResponse('Unauthorized', 'UNAUTHORIZED', 401);
    }

    const aiGate = await checkAIFeatureGate(session.user.id);
    if (aiGate) return aiGate;

    const body = createSyncConversationBodySchema.safeParse(
      await request.json().catch(() => undefined),
    );
    if (!body.success) {
      return createValidationErrorResponse(
        'agent_id is required and must be alphanumeric with hyphens/underscores',
        'agent_id',
        undefined,
      );
    }

    const db = getClient();
    const created = await createCollectionConversation(db, {
      userId: session.user.id,
      agentId: body.data.agent_id,
      title: body.data.title ?? null,
      deviceId: body.data.device_id ?? null,
    });
    if (!created) throw new Error('Conversation create failed: no row returned');

    return NextResponse.json(created, { status: 201 });
  } catch (error) {
    logger.error('Error creating conversation', { error });
    return createErrorResponse(error, {
      endpoint: '/api/sync/conversations',
      operation: 'create_conversation',
    });
  }
}
