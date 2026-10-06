/**
 * Conversation database queries
 */

import { and, desc, eq } from 'drizzle-orm';
import type { Database } from '../client/index.js';
import { conversations, messages } from '../schema/agents.js';

export async function getConversations(
  db: Database,
  userId: string,
  options: { limit?: number; offset?: number } = {},
) {
  const { limit = 50, offset = 0 } = options;
  return db
    .select()
    .from(conversations)
    .where(and(eq(conversations.userId, userId), eq(conversations.status, 'active')))
    .orderBy(desc(conversations.updatedAt), conversations.id)
    .limit(limit)
    .offset(offset);
}

export async function getConversationById(db: Database, id: string, userId: string) {
  const result = await db
    .select()
    .from(conversations)
    .where(and(eq(conversations.id, id), eq(conversations.userId, userId)))
    .limit(1);
  return result[0] ?? null;
}

export async function createConversation(
  db: Database,
  data: { id: string; userId: string; agentId: string; title?: string },
) {
  const result = await db
    .insert(conversations)
    .values({
      id: data.id,
      userId: data.userId,
      agentId: data.agentId,
      title: data.title ?? 'New conversation',
      status: 'active',
    })
    .returning();
  return result[0] ?? null;
}

export async function updateConversationTitle(
  db: Database,
  id: string,
  userId: string,
  title: string,
) {
  const result = await db
    .update(conversations)
    .set({ title, updatedAt: new Date() })
    .where(and(eq(conversations.id, id), eq(conversations.userId, userId)))
    .returning();
  return result[0] ?? null;
}

export async function deleteConversation(db: Database, id: string, userId: string) {
  // Messages cascade-delete via FK
  const result = await db
    .delete(conversations)
    .where(and(eq(conversations.id, id), eq(conversations.userId, userId)))
    .returning();
  return result[0] ?? null;
}

export async function getMessages(
  db: Database,
  conversationId: string,
  options: { limit?: number; offset?: number } = {},
) {
  const { limit = 200, offset = 0 } = options;
  return db
    .select()
    .from(messages)
    .where(eq(messages.conversationId, conversationId))
    .orderBy(messages.timestamp, messages.id)
    .limit(limit)
    .offset(offset);
}

// NOTE: NeonDB HTTP driver does not support transactions. The message insert
// and conversation timestamp update below are not atomic  -  a failure between
// them can leave the conversation's updatedAt stale.
export async function addMessage(
  db: Database,
  data: { id: string; conversationId: string; role: string; content: string },
) {
  const result = await db
    .insert(messages)
    .values({
      id: data.id,
      conversationId: data.conversationId,
      role: data.role,
      content: data.content,
    })
    .returning();

  // Touch conversation updatedAt
  await db
    .update(conversations)
    .set({ updatedAt: new Date() })
    .where(eq(conversations.id, data.conversationId));

  return result[0] ?? null;
}
