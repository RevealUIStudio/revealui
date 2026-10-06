/**
 * Conversation database queries
 */

import { and, count, desc, eq, type SQL, sql } from 'drizzle-orm';
import { z } from 'zod';
import type { Database } from '../client/index.js';
import { CONVERSATION_STATUSES, conversations, messages } from '../schema/agents.js';

const conversationDateSchema = z.union([z.date(), z.iso.datetime()]).nullable().optional();
const conversationIdSchema = z.string().min(1).max(200);
const conversationTitleSchema = z.string().trim().min(1).max(500);

export const createConversationRequestSchema = z
  .object({ title: conversationTitleSchema.optional() })
  .strict();
export const updateConversationTitleRequestSchema = z
  .object({ title: conversationTitleSchema })
  .strict();

export const createConversationInputSchema = z
  .object({
    id: conversationIdSchema,
    userId: conversationIdSchema,
    agentId: conversationIdSchema,
    title: conversationTitleSchema.optional(),
  })
  .strict();
export const updateConversationTitleInputSchema = conversationTitleSchema;

export const createCollectionConversationSchema = z
  .object({
    id: conversationIdSchema.optional(),
    version: z.number().int().positive().optional(),
    userId: conversationIdSchema,
    agentId: conversationIdSchema,
    title: conversationTitleSchema.nullable().optional(),
    status: z.enum(CONVERSATION_STATUSES).optional(),
    deviceId: z.string().nullable().optional(),
    lastSyncedAt: conversationDateSchema,
  })
  .strict();

export const updateCollectionConversationSchema = z
  .object({
    version: z.number().int().positive().optional(),
    title: conversationTitleSchema.nullable().optional(),
    status: z.enum(CONVERSATION_STATUSES).optional(),
    lastSyncedAt: conversationDateSchema,
  })
  .strict();

export type NewCollectionConversation = z.output<typeof createCollectionConversationSchema>;
export type CollectionConversationPatch = z.output<typeof updateCollectionConversationSchema>;

export async function getConversations(
  db: Database,
  userId: string,
  options: { limit?: number; offset?: number } = {},
) {
  const { limit, offset } = z
    .object({
      limit: z.number().int().min(1).max(100).default(50),
      offset: z.number().int().min(0).max(10_000_000).default(0),
    })
    .parse(options);
  return db
    .select()
    .from(conversations)
    .where(and(eq(conversations.userId, userId), eq(conversations.status, 'active')))
    .orderBy(desc(conversations.updatedAt), conversations.id)
    .limit(limit)
    .offset(offset);
}

export async function listConversations(
  db: Database,
  options: { limit: number; offset: number; filter?: SQL; sort?: SQL[] },
) {
  const { limit, offset, filter, sort = [] } = options;
  const rows = await db
    .select()
    .from(conversations)
    .where(filter)
    .orderBy(...sort, desc(conversations.updatedAt), conversations.id)
    .limit(limit)
    .offset(offset);
  const [{ total = 0 } = { total: 0 }] = await db
    .select({ total: count() })
    .from(conversations)
    .where(filter);
  return { rows, total };
}

export async function getConversationById(db: Database, id: string, userId: string) {
  const validatedId = conversationIdSchema.parse(id);
  const validatedUserId = conversationIdSchema.parse(userId);
  const result = await db
    .select()
    .from(conversations)
    .where(and(eq(conversations.id, validatedId), eq(conversations.userId, validatedUserId)))
    .limit(1);
  return result[0] ?? null;
}

export async function createConversation(
  db: Database,
  input: z.input<typeof createConversationInputSchema>,
) {
  const data = createConversationInputSchema.parse(input);
  return createCollectionConversation(db, data);
}

export async function createCollectionConversation(db: Database, input: NewCollectionConversation) {
  const data = createCollectionConversationSchema.parse(input);
  const result = await db
    .insert(conversations)
    .values({
      id: data.id ?? `rvl_${crypto.randomUUID()}`,
      version: data.version ?? 1,
      userId: data.userId,
      agentId: data.agentId,
      title: data.title === undefined ? 'New conversation' : data.title,
      status: data.status ?? 'active',
      deviceId: data.deviceId ?? null,
      lastSyncedAt: dateValue(data.lastSyncedAt),
    })
    .returning();
  return result[0] ?? null;
}

function dateValue(value: Date | string | null | undefined): Date | null {
  if (typeof value === 'string') return new Date(value);
  return value ?? null;
}

export async function updateCollectionConversation(
  db: Database,
  id: string,
  input: CollectionConversationPatch,
  ownerId?: string,
) {
  const validatedId = conversationIdSchema.parse(id);
  const validatedOwnerId = ownerId === undefined ? undefined : conversationIdSchema.parse(ownerId);
  const data = updateCollectionConversationSchema.parse(input);
  const { version, ...patch } = data;
  const result = await db
    .update(conversations)
    .set({
      ...(patch.title !== undefined ? { title: patch.title } : {}),
      ...(patch.status !== undefined ? { status: patch.status } : {}),
      ...(patch.lastSyncedAt !== undefined ? { lastSyncedAt: dateValue(patch.lastSyncedAt) } : {}),
      version: sql`${conversations.version} + 1`,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(conversations.id, validatedId),
        validatedOwnerId ? eq(conversations.userId, validatedOwnerId) : undefined,
        version !== undefined ? eq(conversations.version, version) : undefined,
      ),
    )
    .returning();
  if (result[0]) return result[0];

  const [existing] = await db
    .select({ id: conversations.id })
    .from(conversations)
    .where(
      and(
        eq(conversations.id, validatedId),
        validatedOwnerId ? eq(conversations.userId, validatedOwnerId) : undefined,
      ),
    )
    .limit(1);
  if (existing && version !== undefined) {
    throw Object.assign(new Error(`Conversation ${id} was modified by another request`), {
      statusCode: 409,
    });
  }
  return null;
}

export async function deleteCollectionConversation(db: Database, id: string, ownerId?: string) {
  const validatedId = conversationIdSchema.parse(id);
  const validatedOwnerId = ownerId === undefined ? undefined : conversationIdSchema.parse(ownerId);
  const result = await db
    .delete(conversations)
    .where(
      and(
        eq(conversations.id, validatedId),
        validatedOwnerId ? eq(conversations.userId, validatedOwnerId) : undefined,
      ),
    )
    .returning();
  return result[0] ?? null;
}

export async function updateConversationTitle(
  db: Database,
  id: string,
  userId: string,
  title: string,
) {
  const validatedId = conversationIdSchema.parse(id);
  const validatedUserId = conversationIdSchema.parse(userId);
  const validatedTitle = updateConversationTitleInputSchema.parse(title);
  return updateCollectionConversation(db, validatedId, { title: validatedTitle }, validatedUserId);
}

export async function deleteConversation(db: Database, id: string, userId: string) {
  return deleteCollectionConversation(
    db,
    conversationIdSchema.parse(id),
    conversationIdSchema.parse(userId),
  );
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
