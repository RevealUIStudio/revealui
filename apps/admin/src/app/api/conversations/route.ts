/**
 * Conversations API Route
 *
 * GET  /api/conversations  -  list user's conversations
 * POST /api/conversations  -  create a new conversation
 */

import { getSession } from '@revealui/auth/server';
import { getClient } from '@revealui/db';
import { createConversation, getConversations } from '@revealui/db/queries/conversations';
import type { NextRequest } from 'next/server';
import { checkAIFeatureGate } from '@/lib/middleware/ai-feature-gate';
import { extractRequestContext } from '@/lib/utils/request-context';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  const session = await getSession(request.headers, extractRequestContext(request));
  if (!session) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const aiGate = checkAIFeatureGate();
  if (aiGate) return aiGate;

  const db = getClient();
  const limit = Number(request.nextUrl.searchParams.get('limit') ?? '50');
  const offset = Number(request.nextUrl.searchParams.get('offset') ?? '0');

  const result = await getConversations(db, session.user.id, {
    limit: Math.min(limit, 100),
    offset: Math.max(offset, 0),
  });

  return Response.json({ conversations: result });
}

export async function POST(request: NextRequest) {
  const session = await getSession(request.headers, extractRequestContext(request));
  if (!session) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const aiGate = checkAIFeatureGate();
  if (aiGate) return aiGate;

  const body = (await request.json()) as { title?: string };
  const db = getClient();
  const id = crypto.randomUUID();

  const conversation = await createConversation(db, {
    id,
    userId: session.user.id,
    agentId: 'admin-assistant',
    title: body.title,
  });

  return Response.json({ conversation }, { status: 201 });
}
