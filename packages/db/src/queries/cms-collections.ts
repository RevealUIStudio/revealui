/**
 * CRUD for CMS collections added in the WIRE-UP-PENDING cutover.
 */

import {
  and,
  asc,
  count,
  desc,
  eq,
  getTableColumns,
  gt,
  inArray,
  isNotNull,
  isNull,
  lt,
  ne,
  notInArray,
  or,
  type SQL,
} from 'drizzle-orm';
import type { PgColumn } from 'drizzle-orm/pg-core';
import { z } from 'zod';
import type { Database } from '../client/index.js';
import { conversations } from '../schema/agents.js';
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
import { orders } from '../schema/products.js';

const cmsTables = {
  categories,
  contents,
  conversations,
  events,
  info,
  orders,
  prices,
  subscriptions,
  tags,
  videos,
};
const listFields = {
  conversations: [
    'id',
    'version',
    'userId',
    'agentId',
    'title',
    'status',
    'deviceId',
    'lastSyncedAt',
    'createdAt',
    'updatedAt',
  ],
  orders: [
    'id',
    'customerId',
    'status',
    'totalInCents',
    'currency',
    'stripePaymentIntentId',
    'stripeCheckoutSessionId',
    'createdAt',
    'updatedAt',
  ],
} as const;
const filterRecord = z.record(z.string(), z.unknown());

function allowedListFields(collection: keyof typeof cmsTables) {
  if (collection === 'conversations') return listFields.conversations;
  if (collection === 'orders') return listFields.orders;
  return undefined;
}

// These values cross the caller/access-rule boundary. `unknown` is intentional:
// RevealWhere is only a compile-time promise and cannot establish runtime shape.
// Validate each bounded node before constructing SQL; never assert its type.
function readFilterRecord(input: unknown) {
  if (input === null || typeof input !== 'object' || Array.isArray(input)) {
    throw new Error('Invalid CMS list filter: expected an object');
  }
  const prototype = Object.getPrototypeOf(input);
  if (prototype !== Object.prototype && prototype !== null) {
    throw new Error('Invalid CMS list filter: expected a plain object');
  }
  if (Reflect.ownKeys(input).length > 100 || Object.getOwnPropertySymbols(input).length > 0) {
    throw new Error('Invalid CMS list filter: too many or unsupported keys');
  }
  for (const [key, descriptor] of Object.entries(Object.getOwnPropertyDescriptors(input))) {
    if (!('value' in descriptor && descriptor.enumerable) || key === '__proto__') {
      throw new Error('Invalid CMS list filter: expected enumerable data properties');
    }
  }
  return filterRecord.parse(input);
}

// Read descriptor values only: schema iteration of raw arrays could invoke a
// getter before validation. The contents remain opaque until their node/scalar
// validator runs; an asserted element type would prematurely trust the input.
function readFilterArray(input: unknown, minimum = 0): unknown[] {
  if (!Array.isArray(input) || Object.getPrototypeOf(input) !== Array.prototype) {
    throw new Error('Invalid CMS list filter: expected an ordinary array');
  }
  const lengthDescriptor = Object.getOwnPropertyDescriptor(input, 'length');
  if (!(lengthDescriptor && 'value' in lengthDescriptor)) {
    throw new Error('Invalid CMS list filter array length');
  }
  const length = z.number().int().min(minimum).max(100).parse(lengthDescriptor.value);
  if (
    Reflect.ownKeys(input).length !== length + 1 ||
    Object.getOwnPropertySymbols(input).length > 0
  ) {
    throw new Error('Invalid CMS list filter: expected dense array elements only');
  }
  const values: unknown[] = [];
  for (let index = 0; index < length; index++) {
    const descriptor = Object.getOwnPropertyDescriptor(input, String(index));
    if (!(descriptor && 'value' in descriptor && descriptor.enumerable)) {
      throw new Error('Invalid CMS list filter: expected own array data elements');
    }
    values.push(descriptor.value);
  }
  return values;
}

function readColumnValue(column: PgColumn, input: unknown) {
  switch (column.dataType) {
    case 'string':
      return z.string().max(10_000).parse(input);
    case 'number':
      return z.number().int().parse(input);
    case 'boolean':
      return z.boolean().parse(input);
    case 'date':
      return z
        .union([z.date(), z.iso.datetime({ offset: true }).transform((value) => new Date(value))])
        .parse(input);
    default:
      throw new Error('Unsupported CMS list filter column type');
  }
}

/** Compile supported CMS scalar predicates; every unsupported node fails closed.
 * The result is a trusted Drizzle expression consumed by both rows and counts.
 */
export function cmsListFilter(collection: keyof typeof cmsTables, input: unknown): SQL | undefined {
  if (input === undefined) return undefined;
  const columns: Record<string, PgColumn> = getTableColumns(cmsTables[collection]);
  let remaining = 100;
  function visit(node: unknown, depth: number): SQL | undefined {
    if (depth > 10 || --remaining < 0) throw new Error('CMS list filter exceeds complexity limit');
    const entries = Object.entries(readFilterRecord(node));
    // Core composes an empty caller where with access/draft restrictions.
    // Empty objects contribute no predicate, including inside logical groups.
    const predicates: SQL[] = [];
    for (const [field, condition] of entries) {
      if (--remaining < 0) throw new Error('CMS list filter exceeds complexity limit');
      if (field === 'and' || field === 'or') {
        const children = readFilterArray(condition, 1).map((child) => visit(child, depth + 1));
        const predicate = field === 'and' ? and(...children) : or(...children);
        if (predicate) predicates.push(predicate);
        continue;
      }
      const key =
        collection === 'prices' && field === '_status'
          ? 'status'
          : collection === 'prices' && field === 'stripePriceID'
            ? 'stripePriceId'
            : field;
      const allowedFields = allowedListFields(collection);
      if (allowedFields && !allowedFields.some((allowedField) => allowedField === key)) {
        throw new Error('Unsupported CMS list filter field');
      }
      const column = Object.hasOwn(columns, key) ? columns[key] : undefined;
      if (!column || column.dataType === 'json')
        throw new Error('Unsupported CMS list filter field');
      const operators = Object.entries(readFilterRecord(condition));
      if (operators.length === 0) throw new Error('Invalid empty CMS list filter condition');
      for (const [operator, operand] of operators) {
        if (--remaining < 0) throw new Error('CMS list filter exceeds complexity limit');
        if (operator === 'exists') {
          predicates.push(z.boolean().parse(operand) ? isNotNull(column) : isNull(column));
        } else if (operator === 'equals' || operator === 'not_equals') {
          predicates.push(
            operand === null
              ? operator === 'equals'
                ? isNull(column)
                : isNotNull(column)
              : operator === 'equals'
                ? eq(column, readColumnValue(column, operand))
                : ne(column, readColumnValue(column, operand)),
          );
        } else if (operator === 'in' || operator === 'not_in') {
          const values = readFilterArray(operand).map((value) => readColumnValue(column, value));
          predicates.push(operator === 'in' ? inArray(column, values) : notInArray(column, values));
        } else if (operator === 'greater_than' || operator === 'less_than') {
          if (column.dataType === 'boolean') throw new Error('Unsupported CMS list comparison');
          const value = readColumnValue(column, operand);
          predicates.push(operator === 'greater_than' ? gt(column, value) : lt(column, value));
        } else {
          throw new Error('Unsupported CMS list filter operator');
        }
      }
    }
    return and(...predicates);
  }
  return visit(input, 0);
}

/** Compile a validated sort object for one of the existing typed collection tables. */
export function cmsListSort(collection: keyof typeof cmsTables, input: unknown): SQL[] {
  if (input === undefined) return [];
  const entries = Object.entries(readFilterRecord(input));
  if (entries.length > 10) throw new Error('CMS list sort exceeds complexity limit');
  const columns: Record<string, PgColumn> = getTableColumns(cmsTables[collection]);
  return entries.map(([field, direction]) => {
    const allowedFields = allowedListFields(collection);
    if (allowedFields && !allowedFields.some((allowedField) => allowedField === field)) {
      throw new Error('Unsupported CMS list sort field');
    }
    const column = Object.hasOwn(columns, field) ? columns[field] : undefined;
    if (!column || column.dataType === 'json') throw new Error('Unsupported CMS list sort field');
    const parsedDirection = z.enum(['1', '-1']).parse(direction);
    return parsedDirection === '-1' ? desc(column) : asc(column);
  });
}

function newId(data: { id?: unknown }): string {
  return typeof data.id === 'string' && data.id.length > 0 ? data.id : `rvl_${crypto.randomUUID()}`;
}

export async function getCategoryById(db: Database, id: string): Promise<Category | null> {
  const [row] = await db.select().from(categories).where(eq(categories.id, id)).limit(1);
  return row ?? null;
}

export async function listCategories(db: Database, limit = 20, offset = 0, filter?: SQL) {
  const rows = await db
    .select()
    .from(categories)
    .where(filter)
    .orderBy(desc(categories.createdAt))
    .limit(limit)
    .offset(offset);
  const [{ value: total = 0 } = { value: 0 }] = await db
    .select({ value: count() })
    .from(categories)
    .where(filter);
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

export async function listEvents(db: Database, limit = 20, offset = 0, filter?: SQL) {
  const rows = await db
    .select()
    .from(events)
    .where(filter)
    .orderBy(desc(events.createdAt))
    .limit(limit)
    .offset(offset);
  const [{ value: total = 0 } = { value: 0 }] = await db
    .select({ value: count() })
    .from(events)
    .where(filter);
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

export async function listContents(db: Database, limit = 20, offset = 0, filter?: SQL) {
  const rows = await db
    .select()
    .from(contents)
    .where(filter)
    .orderBy(desc(contents.createdAt))
    .limit(limit)
    .offset(offset);
  const [{ value: total = 0 } = { value: 0 }] = await db
    .select({ value: count() })
    .from(contents)
    .where(filter);
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

export async function listTags(db: Database, limit = 20, offset = 0, filter?: SQL) {
  const rows = await db.select().from(tags).where(filter).limit(limit).offset(offset);
  const [{ value: total = 0 } = { value: 0 }] = await db
    .select({ value: count() })
    .from(tags)
    .where(filter);
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

export async function listPrices(db: Database, limit = 20, offset = 0, filter?: SQL) {
  const where = and(isNull(prices.deletedAt), filter);
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

export async function listInfo(db: Database, limit = 20, offset = 0, filter?: SQL) {
  const rows = await db
    .select()
    .from(info)
    .where(filter)
    .orderBy(desc(info.createdAt))
    .limit(limit)
    .offset(offset);
  const [{ value: total = 0 } = { value: 0 }] = await db
    .select({ value: count() })
    .from(info)
    .where(filter);
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

export async function listVideos(db: Database, limit = 20, offset = 0, filter?: SQL) {
  const rows = await db
    .select()
    .from(videos)
    .where(filter)
    .orderBy(desc(videos.createdAt))
    .limit(limit)
    .offset(offset);
  const [{ value: total = 0 } = { value: 0 }] = await db
    .select({ value: count() })
    .from(videos)
    .where(filter);
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

export async function listSubscriptions(db: Database, limit = 20, offset = 0, filter?: SQL) {
  const rows = await db
    .select()
    .from(subscriptions)
    .where(filter)
    .orderBy(desc(subscriptions.createdAt))
    .limit(limit)
    .offset(offset);
  const [{ value: total = 0 } = { value: 0 }] = await db
    .select({ value: count() })
    .from(subscriptions)
    .where(filter);
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
