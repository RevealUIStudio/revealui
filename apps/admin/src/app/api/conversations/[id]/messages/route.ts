/**
 * Conversation Messages API Route
 *
 * GET  /api/conversations/:id/messages  -  list messages
 * POST /api/conversations/:id/messages  -  add a message
 */

import { getSession } from '@revealui/auth/server';
import { getClient } from '@revealui/db';
import { addMessage, getConversationById, getMessages } from '@revealui/db/queries/conversations';
import type { NextRequest } from 'next/server';
import { checkAIFeatureGate } from '@/lib/middleware/ai-feature-gate';
import { extractRequestContext } from '@/lib/utils/request-context';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  const session = await getSession(request.headers, extractRequestContext(request));
  if (!session) return Response.json({ error: 'Unauthorized' }, { status: 401 });
  const aiGate = checkAIFeatureGate();
  if (aiGate) return aiGate;

  const { id } = await params;
  const db = getClient();

  // Verify ownership
  const conversation = await getConversationById(db, id, session.user.id);
  if (!conversation) return Response.json({ error: 'Not found' }, { status: 404 });

  const limit = Number(request.nextUrl.searchParams.get('limit') ?? '200');
  const result = await getMessages(db, id, { limit: Math.min(limit, 500) });

  return Response.json({ messages: result });
}

export async function POST(request: NextRequest, { params }: RouteParams) {
  const session = await getSession(request.headers, extractRequestContext(request));
  if (!session) return Response.json({ error: 'Unauthorized' }, { status: 401 });
  const aiGate = checkAIFeatureGate();
  if (aiGate) return aiGate;

  const { id } = await params;
  const body = (await request.json()) as { role: string; content: string };

  if (!(body.role && body.content)) {
    return Response.json({ error: 'role and content required' }, { status: 400 });
  }

  const db = getClient();

  // Verify ownership
  const conversation = await getConversationById(db, id, session.user.id);
  if (!conversation) return Response.json({ error: 'Not found' }, { status: 404 });

  const message = await addMessage(db, {
    id: crypto.randomUUID(),
    conversationId: id,
    role: body.role,
    content: body.content,
  });

  return Response.json({ message }, { status: 201 });
}
