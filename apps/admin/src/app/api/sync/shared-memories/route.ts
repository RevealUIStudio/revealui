/**
 * Shared Memories Sync Mutation Route
 *
 * POST /api/sync/shared-memories - Create a shared memory
 *
 * Authenticated. Creates an agent_memories row with scope='shared'
 * and the given session_scope. Electric fans out to all subscribers.
 */

import crypto from 'node:crypto';
import { getSession } from '@revealui/auth/server';
import { getClient } from '@revealui/db';
import { agentMemories, eq, sites } from '@revealui/db/schema';
import { logger } from '@revealui/utils/logger';
import { and, desc, or } from 'drizzle-orm';
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

const AGENT_ID_RE = /^[a-zA-Z0-9_-]+$/;
const SESSION_SCOPE_RE = /^[a-zA-Z0-9_-]+$/;

export async function GET(request: NextRequest): Promise<NextResponse> {
  const aiGate = checkAIFeatureGate();
  if (aiGate) return aiGate;
  try {
    const session = await getSession(request.headers, extractRequestContext(request));
    if (!session) {
      return createApplicationErrorResponse('Unauthorized', 'UNAUTHORIZED', 401);
    }
    const sessionScope = request.nextUrl.searchParams.get('session_scope');
    if (!(sessionScope && SESSION_SCOPE_RE.test(sessionScope))) {
      return createValidationErrorResponse(
        'session_scope query param is required',
        'session_scope',
        sessionScope,
      );
    }
    const limit = Math.min(
      Number.parseInt(request.nextUrl.searchParams.get('limit') ?? '100', 10),
      500,
    );
    const db = getClient();
    const rows = await db
      .select()
      .from(agentMemories)
      .where(
        and(
          eq(agentMemories.sessionScope, sessionScope),
          or(eq(agentMemories.scope, 'shared'), eq(agentMemories.scope, 'reconciled')),
        ),
      )
      .orderBy(desc(agentMemories.createdAt))
      .limit(limit);
    return NextResponse.json(rows);
  } catch (error) {
    logger.error('Error listing shared memories', { error });
    return createErrorResponse(error, {
      endpoint: '/api/sync/shared-memories',
      operation: 'list_shared_memories',
    });
  }
}
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

export async function POST(request: NextRequest): Promise<NextResponse> {
  const aiGate = checkAIFeatureGate();
  if (aiGate) return aiGate;

  try {
    const session = await getSession(request.headers, extractRequestContext(request));
    if (!session) {
      return createApplicationErrorResponse('Unauthorized', 'UNAUTHORIZED', 401);
    }

    const body = (await request.json()) as {
      agent_id?: string;
      site_id?: string;
      session_scope?: string;
      content?: string;
      type?: string;
      source?: Record<string, unknown>;
      metadata?: Record<string, unknown>;
      source_facts?: string[];
    };

    if (!(body.session_scope && SESSION_SCOPE_RE.test(body.session_scope))) {
      return createValidationErrorResponse(
        'session_scope is required and must be alphanumeric with hyphens/underscores',
        'session_scope',
        body.session_scope,
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

    if (!(body.type && VALID_MEMORY_TYPES.has(body.type))) {
      return createValidationErrorResponse(
        `type must be one of: ${[...VALID_MEMORY_TYPES].join(', ')}`,
        'type',
        body.type,
      );
    }

    if (!body.source || typeof body.source !== 'object') {
      return createValidationErrorResponse(
        'source is required and must be an object',
        'source',
        body.source,
      );
    }

    if (!body.site_id || body.site_id.trim().length === 0) {
      return createValidationErrorResponse('site_id is required', 'site_id', body.site_id);
    }

    const db = getClient();

    // Validate site ownership for non-admins
    if (session.user.role !== 'admin') {
      const [site] = await db
        .select({ ownerId: sites.ownerId })
        .from(sites)
        .where(eq(sites.id, body.site_id))
        .limit(1);
      if (!site || site.ownerId !== session.user.id) {
        return createApplicationErrorResponse(
          'Access denied: you do not own this site',
          'FORBIDDEN',
          403,
        );
      }
    }

    const id = crypto.randomUUID();

    const [created] = await db
      .insert(agentMemories)
      .values({
        id,
        agentId: body.agent_id,
        siteId: body.site_id,
        content: body.content,
        type: body.type,
        source: body.source,
        metadata: body.metadata ?? {},
        scope: 'shared',
        sessionScope: body.session_scope,
        sourceFacts: body.source_facts ?? [],
      })
      .returning();

    return NextResponse.json(created, { status: 201 });
  } catch (error) {
    logger.error('Error creating shared memory', { error });
    return createErrorResponse(error, {
      endpoint: '/api/sync/shared-memories',
      operation: 'create_shared_memory',
    });
  }
}
