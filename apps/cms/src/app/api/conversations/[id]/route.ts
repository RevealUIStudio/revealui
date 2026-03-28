/**
 * Single Conversation API Route
 *
 * GET    /api/conversations/:id — get conversation details
 * PATCH  /api/conversations/:id — update title
 * DELETE /api/conversations/:id — delete conversation
 */

import { getSession } from '@revealui/auth/server';
import { getClient } from '@revealui/db';
import {
  deleteConversation,
  getConversationById,
  updateConversationTitle,
} from '@revealui/db/queries/conversations';
import type { NextRequest } from 'next/server';
import { checkAIFeatureGate } from '@/lib/middleware/ai-feature-gate';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  const session = await getSession(request.headers);
  if (!session) return Response.json({ error: 'Unauthorized' }, { status: 401 });
  const aiGate = checkAIFeatureGate();
  if (aiGate) return aiGate;

  const { id } = await params;
  const db = getClient();
  const conversation = await getConversationById(db, id, session.user.id);

  if (!conversation) return Response.json({ error: 'Not found' }, { status: 404 });
  return Response.json({ conversation });
}

export async function PATCH(request: NextRequest, { params }: RouteParams) {
  const session = await getSession(request.headers);
  if (!session) return Response.json({ error: 'Unauthorized' }, { status: 401 });
  const aiGate = checkAIFeatureGate();
  if (aiGate) return aiGate;

  const { id } = await params;
  const body = (await request.json()) as { title?: string };
  if (!body.title) return Response.json({ error: 'Title required' }, { status: 400 });

  const db = getClient();
  const conversation = await updateConversationTitle(db, id, session.user.id, body.title);

  if (!conversation) return Response.json({ error: 'Not found' }, { status: 404 });
  return Response.json({ conversation });
}

export async function DELETE(request: NextRequest, { params }: RouteParams) {
  const session = await getSession(request.headers);
  if (!session) return Response.json({ error: 'Unauthorized' }, { status: 401 });
  const aiGate = checkAIFeatureGate();
  if (aiGate) return aiGate;

  const { id } = await params;
  const db = getClient();
  const deleted = await deleteConversation(db, id, session.user.id);

  if (!deleted) return Response.json({ error: 'Not found' }, { status: 404 });
  return Response.json({ success: true });
}
