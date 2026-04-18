/**
 * Shared Facts Sync Mutation Route
 *
 * POST /api/sync/shared-facts - Publish a new shared fact
 *
 * Authenticated. Facts are scoped by coordination session_id.
 * ElectricSQL picks up the database change and pushes it to all shape subscribers.
 */

import crypto from 'node:crypto';
import { getSession } from '@revealui/auth/server';
import { getClient } from '@revealui/db';
import { sharedFacts } from '@revealui/db/schema';
import { logger } from '@revealui/utils/logger';
import { type NextRequest, NextResponse } from 'next/server';
import { checkAIFeatureGate } from '@/lib/middleware/ai-feature-gate';
import {
  createApplicationErrorResponse,
  createErrorResponse,
  createValidationErrorResponse,
} from '@/lib/utils/error-response';
import { extractRequestContext } from '@/lib/utils/request-context';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const SESSION_ID_RE = /^[a-zA-Z0-9_-]+$/;
const AGENT_ID_RE = /^[a-zA-Z0-9_-]+$/;
const VALID_FACT_TYPES = new Set(['discovery', 'bug', 'decision', 'warning', 'question', 'answer']);

export async function POST(request: NextRequest): Promise<NextResponse> {
  const aiGate = checkAIFeatureGate();
  if (aiGate) return aiGate;

  try {
    const session = await getSession(request.headers, extractRequestContext(request));
    if (!session) {
      return createApplicationErrorResponse('Unauthorized', 'UNAUTHORIZED', 401);
    }

    const body = (await request.json()) as {
      session_id?: string;
      agent_id?: string;
      content?: string;
      fact_type?: string;
      confidence?: number;
      tags?: string[];
      source_ref?: Record<string, unknown>;
    };

    if (!(body.session_id && SESSION_ID_RE.test(body.session_id))) {
      return createValidationErrorResponse(
        'session_id is required and must be alphanumeric with hyphens/underscores',
        'session_id',
        body.session_id,
      );
    }

    if (!(body.agent_id && AGENT_ID_RE.test(body.agent_id))) {
      return createValidationErrorResponse(
        'agent_id is required and must be alphanumeric with hyphens/underscores',
        'agent_id',
        body.agent_id,
      );
    }

    if (!body.content || body.content.trim().length === 0) {
      return createValidationErrorResponse('content is required', 'content', body.content);
    }

    if (!(body.fact_type && VALID_FACT_TYPES.has(body.fact_type))) {
      return createValidationErrorResponse(
        `fact_type must be one of: ${[...VALID_FACT_TYPES].join(', ')}`,
        'fact_type',
        body.fact_type,
      );
    }

    if (body.confidence !== undefined && (body.confidence < 0 || body.confidence > 1)) {
      return createValidationErrorResponse(
        'confidence must be between 0 and 1',
        'confidence',
        body.confidence,
      );
    }

    const db = getClient();
    const id = crypto.randomUUID();

    const [created] = await db
      .insert(sharedFacts)
      .values({
        id,
        sessionId: body.session_id,
        agentId: body.agent_id,
        content: body.content,
        factType: body.fact_type,
        confidence: body.confidence ?? 1.0,
        tags: body.tags ?? [],
        sourceRef: body.source_ref,
      })
      .returning();

    return NextResponse.json(created, { status: 201 });
  } catch (error) {
    logger.error('Error creating shared fact', { error });
    return createErrorResponse(error, {
      endpoint: '/api/sync/shared-facts',
      operation: 'create_shared_fact',
    });
  }
}
