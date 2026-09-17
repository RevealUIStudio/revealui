/**
 * CRUD for CMS collections added in the WIRE-UP-PENDING cutover.
 */

import { and, count, desc, eq, isNull, type SQL } from 'drizzle-orm';
import type { Database } from '../client/index.js';
import {
  type Category,
  type ContentRow,
  categories,
  contents,
  type EventRow,
  events,
  type InfoRow,
  info,
  type NewCategory,
  type NewContent,
  type NewEvent,
  type NewInfo,
  type NewPrice,
  type NewSubscription,
  type NewTag,
  type NewVideo,
  type PriceRow,
  prices,
  type SubscriptionRow,
  subscriptions,
  type TagRow,
  tags,
  type VideoRow,
  videos,
} from '../schema/cms-collections.js';

function newId(data: { id?: unknown }): string {
  return typeof data.id === 'string' && data.id.length > 0 ? data.id : `rvl_${crypto.randomUUID()}`;
}

export async function getCategoryById(db: Database, id: string): Promise<Category | null> {
  const [row] = await db.select().from(categories).where(eq(categories.id, id)).limit(1);
  return row ?? null;
}

export async function listCategories(db: Database, limit = 20, offset = 0) {
  const rows = await db
    .select()
    .from(categories)
    .orderBy(desc(categories.createdAt))
    .limit(limit)
    .offset(offset);
  const [{ value: total = 0 } = { value: 0 }] = await db
    .select({ value: count() })
    .from(categories);
  return { rows, total };
}

export async function createCategory(db: Database, data: NewCategory): Promise<Category | null> {
  const [row] = await db.insert(categories).values(data).returning();
  return row ?? null;
}

export async function updateCategory(
  db: Database,
  id: string,
  data: Partial<NewCategory>,
): Promise<Category | null> {
  const [row] = await db
    .update(categories)
    .set({ ...data, updatedAt: new Date() })
    .where(eq(categories.id, id))
    .returning();
  return row ?? null;
}

export async function deleteCategory(db: Database, id: string): Promise<Category | null> {
  const existing = await getCategoryById(db, id);
  if (!existing) return null;
  await db.delete(categories).where(eq(categories.id, id));
  return existing;
}

export async function getEventById(db: Database, id: string): Promise<EventRow | null> {
  const [row] = await db.select().from(events).where(eq(events.id, id)).limit(1);
  return row ?? null;
}

export async function listEvents(db: Database, limit = 20, offset = 0) {
  const rows = await db
    .select()
    .from(events)
    .orderBy(desc(events.createdAt))
    .limit(limit)
    .offset(offset);
  const [{ value: total = 0 } = { value: 0 }] = await db.select({ value: count() }).from(events);
  return { rows, total };
}

export async function createEvent(db: Database, data: NewEvent): Promise<EventRow | null> {
  const [row] = await db.insert(events).values(data).returning();
  return row ?? null;
}

export async function updateEvent(
  db: Database,
  id: string,
  data: Partial<NewEvent>,
): Promise<EventRow | null> {
  const [row] = await db
    .update(events)
    .set({ ...data, updatedAt: new Date() })
    .where(eq(events.id, id))
    .returning();
  return row ?? null;
}

export async function deleteEvent(db: Database, id: string): Promise<EventRow | null> {
  const existing = await getEventById(db, id);
  if (!existing) return null;
  await db.delete(events).where(eq(events.id, id));
  return existing;
}

export async function getContentById(db: Database, id: string): Promise<ContentRow | null> {
  const [row] = await db.select().from(contents).where(eq(contents.id, id)).limit(1);
  return row ?? null;
}

export async function listContents(db: Database, limit = 20, offset = 0) {
  const rows = await db
    .select()
    .from(contents)
    .orderBy(desc(contents.createdAt))
    .limit(limit)
    .offset(offset);
  const [{ value: total = 0 } = { value: 0 }] = await db.select({ value: count() }).from(contents);
  return { rows, total };
}

export async function createContent(db: Database, data: NewContent): Promise<ContentRow | null> {
  const [row] = await db.insert(contents).values(data).returning();
  return row ?? null;
}

export async function updateContent(
  db: Database,
  id: string,
  data: Partial<NewContent>,
): Promise<ContentRow | null> {
  const [row] = await db
    .update(contents)
    .set({ ...data, updatedAt: new Date() })
    .where(eq(contents.id, id))
    .returning();
  return row ?? null;
}

export async function deleteContent(db: Database, id: string): Promise<ContentRow | null> {
  const existing = await getContentById(db, id);
  if (!existing) return null;
  await db.delete(contents).where(eq(contents.id, id));
  return existing;
}

export async function getTagById(db: Database, id: string): Promise<TagRow | null> {
  const [row] = await db.select().from(tags).where(eq(tags.id, id)).limit(1);
  return row ?? null;
}

export async function listTags(db: Database, limit = 20, offset = 0) {
  const rows = await db.select().from(tags).limit(limit).offset(offset);
  const [{ value: total = 0 } = { value: 0 }] = await db.select({ value: count() }).from(tags);
  return { rows, total };
}

export async function createTag(db: Database, data: NewTag): Promise<TagRow | null> {
  const [row] = await db.insert(tags).values(data).returning();
  return row ?? null;
}

export async function updateTag(
  db: Database,
  id: string,
  data: Partial<NewTag>,
): Promise<TagRow | null> {
  const [row] = await db.update(tags).set(data).where(eq(tags.id, id)).returning();
  return row ?? null;
}

export async function deleteTag(db: Database, id: string): Promise<TagRow | null> {
  const existing = await getTagById(db, id);
  if (!existing) return null;
  await db.delete(tags).where(eq(tags.id, id));
  return existing;
}

export async function getPriceById(db: Database, id: string): Promise<PriceRow | null> {
  const [row] = await db
    .select()
    .from(prices)
    .where(and(eq(prices.id, id), isNull(prices.deletedAt)))
    .limit(1);
  return row ?? null;
}

export async function listPrices(db: Database, limit = 20, offset = 0) {
  const where: SQL = isNull(prices.deletedAt);
  const rows = await db
    .select()
    .from(prices)
    .where(where)
    .orderBy(desc(prices.createdAt))
    .limit(limit)
    .offset(offset);
  const [{ value: total = 0 } = { value: 0 }] = await db
    .select({ value: count() })
    .from(prices)
    .where(where);
  return { rows, total };
}

export async function createPrice(db: Database, data: NewPrice): Promise<PriceRow | null> {
  const [row] = await db.insert(prices).values(data).returning();
  return row ?? null;
}

export async function updatePrice(
  db: Database,
  id: string,
  data: Partial<NewPrice>,
): Promise<PriceRow | null> {
  const [row] = await db
    .update(prices)
    .set({ ...data, updatedAt: new Date() })
    .where(and(eq(prices.id, id), isNull(prices.deletedAt)))
    .returning();
  return row ?? null;
}

export async function deletePrice(db: Database, id: string): Promise<PriceRow | null> {
  const existing = await getPriceById(db, id);
  if (!existing) return null;
  await db
    .update(prices)
    .set({ deletedAt: new Date(), updatedAt: new Date() })
    .where(eq(prices.id, id));
  return existing;
}

export async function getInfoById(db: Database, id: string): Promise<InfoRow | null> {
  const [row] = await db.select().from(info).where(eq(info.id, id)).limit(1);
  return row ?? null;
}

export async function listInfo(db: Database, limit = 20, offset = 0) {
  const rows = await db
    .select()
    .from(info)
    .orderBy(desc(info.createdAt))
    .limit(limit)
    .offset(offset);
  const [{ value: total = 0 } = { value: 0 }] = await db.select({ value: count() }).from(info);
  return { rows, total };
}

export async function createInfo(db: Database, data: NewInfo): Promise<InfoRow | null> {
  const [row] = await db.insert(info).values(data).returning();
  return row ?? null;
}

export async function updateInfo(
  db: Database,
  id: string,
  data: Partial<NewInfo>,
): Promise<InfoRow | null> {
  const [row] = await db
    .update(info)
    .set({ ...data, updatedAt: new Date() })
    .where(eq(info.id, id))
    .returning();
  return row ?? null;
}

export async function deleteInfo(db: Database, id: string): Promise<InfoRow | null> {
  const existing = await getInfoById(db, id);
  if (!existing) return null;
  await db.delete(info).where(eq(info.id, id));
  return existing;
}

export async function getVideoById(db: Database, id: string): Promise<VideoRow | null> {
  const [row] = await db.select().from(videos).where(eq(videos.id, id)).limit(1);
  return row ?? null;
}

export async function listVideos(db: Database, limit = 20, offset = 0) {
  const rows = await db
    .select()
    .from(videos)
    .orderBy(desc(videos.createdAt))
    .limit(limit)
    .offset(offset);
  const [{ value: total = 0 } = { value: 0 }] = await db.select({ value: count() }).from(videos);
  return { rows, total };
}

export async function createVideo(db: Database, data: NewVideo): Promise<VideoRow | null> {
  const [row] = await db.insert(videos).values(data).returning();
  return row ?? null;
}

export async function updateVideo(
  db: Database,
  id: string,
  data: Partial<NewVideo>,
): Promise<VideoRow | null> {
  const [row] = await db
    .update(videos)
    .set({ ...data, updatedAt: new Date() })
    .where(eq(videos.id, id))
    .returning();
  return row ?? null;
}

export async function deleteVideo(db: Database, id: string): Promise<VideoRow | null> {
  const existing = await getVideoById(db, id);
  if (!existing) return null;
  await db.delete(videos).where(eq(videos.id, id));
  return existing;
}

export async function getSubscriptionById(
  db: Database,
  id: string,
): Promise<SubscriptionRow | null> {
  const [row] = await db.select().from(subscriptions).where(eq(subscriptions.id, id)).limit(1);
  return row ?? null;
}

export async function listSubscriptions(db: Database, limit = 20, offset = 0) {
  const rows = await db
    .select()
    .from(subscriptions)
    .orderBy(desc(subscriptions.createdAt))
    .limit(limit)
    .offset(offset);
  const [{ value: total = 0 } = { value: 0 }] = await db
    .select({ value: count() })
    .from(subscriptions);
  return { rows, total };
}

export async function createSubscription(
  db: Database,
  data: NewSubscription,
): Promise<SubscriptionRow | null> {
  const [row] = await db.insert(subscriptions).values(data).returning();
  return row ?? null;
}

export async function updateSubscription(
  db: Database,
  id: string,
  data: Partial<NewSubscription>,
): Promise<SubscriptionRow | null> {
  const [row] = await db
    .update(subscriptions)
    .set({ ...data, updatedAt: new Date() })
    .where(eq(subscriptions.id, id))
    .returning();
  return row ?? null;
}

export async function deleteSubscription(
  db: Database,
  id: string,
): Promise<SubscriptionRow | null> {
  const existing = await getSubscriptionById(db, id);
  if (!existing) return null;
  await db.delete(subscriptions).where(eq(subscriptions.id, id));
  return existing;
}

export { newId };
