/**
 * Typed storage for CMS collections that used to be WIRE-UP-PENDING.
 * Maps camelCase collection fields onto Drizzle snake_case columns.
 */

import type {
  RevealCollectionConfig,
  RevealDataObject,
  RevealDocument,
  RevealFindOptions,
  RevealPaginatedResult,
  RevealRequest,
} from '@revealui/core/types';
import {
  cmsListFilter,
  createCategory,
  createContent,
  createEvent,
  createInfo,
  createPrice,
  createSubscription,
  createTag,
  createVideo,
  deleteCategory,
  deleteContent,
  deleteEvent,
  deleteInfo,
  deletePrice,
  deleteSubscription,
  deleteTag,
  deleteVideo,
  getCategoryById,
  getContentById,
  getEventById,
  getInfoById,
  getPriceById,
  getSubscriptionById,
  getTagById,
  getVideoById,
  listCategories,
  listContents,
  listEvents,
  listInfo,
  listPrices,
  listSubscriptions,
  listTags,
  listVideos,
  newId,
  updateCategory,
  updateContent,
  updateEvent,
  updateInfo,
  updatePrice,
  updateSubscription,
  updateTag,
  updateVideo,
} from '@revealui/db/queries/cms-collections';
import { z } from 'zod';
import { getCollectionDatabase } from './collectionReadExecutor';

const collectionPageSchema = z.object({
  limit: z.number().int().min(1).max(500),
  page: z.number().int().min(1).max(1_000_000),
});

type Handler = {
  findByID: (
    collection: RevealCollectionConfig,
    options: { id: string | number },
  ) => Promise<RevealDocument | null | undefined>;
  find: (
    collection: RevealCollectionConfig,
    options: RevealFindOptions,
  ) => Promise<RevealPaginatedResult | undefined>;
  create: (
    collection: RevealCollectionConfig,
    options: { data: RevealDataObject; req?: RevealRequest },
  ) => Promise<RevealDocument | undefined>;
  update: (
    collection: RevealCollectionConfig,
    options: { id: string | number; data: RevealDataObject; req?: RevealRequest },
  ) => Promise<RevealDocument | undefined>;
  delete: (
    collection: RevealCollectionConfig,
    options: { id: string | number; req?: RevealRequest },
  ) => Promise<RevealDocument | undefined>;
};

function asDoc(row: Record<string, unknown>): RevealDocument {
  const out: Record<string, unknown> = { ...row };
  for (const key of Object.keys(out)) {
    const value = out[key];
    if (value instanceof Date) out[key] = value.toISOString();
  }
  return out as RevealDocument;
}

function pageResult(
  docs: RevealDocument[],
  total: number,
  options: RevealFindOptions,
): RevealPaginatedResult {
  const limit = options.limit ?? 10;
  const page = options.page ?? 1;
  const offset = (page - 1) * limit;
  const totalPages = total > 0 ? Math.ceil(total / limit) : 0;
  return {
    docs,
    totalDocs: total,
    limit,
    totalPages,
    page,
    pagingCounter: total > 0 ? offset + 1 : 0,
    hasPrevPage: page > 1,
    hasNextPage: page < totalPages,
    prevPage: page > 1 ? page - 1 : null,
    nextPage: page < totalPages ? page + 1 : null,
  };
}

function relIds(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  const ids: string[] = [];
  for (const entry of value) {
    if (typeof entry === 'string' && entry.length > 0) ids.push(entry);
    else if (typeof entry === 'number') ids.push(String(entry));
    else if (entry && typeof entry === 'object' && 'id' in entry)
      ids.push(String((entry as { id: unknown }).id));
  }
  return ids;
}

function toDate(value: unknown): Date | undefined {
  if (value instanceof Date) return value;
  if (typeof value === 'string' && value.length > 0) {
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? undefined : parsed;
  }
  return undefined;
}

export const cmsCollectionHandlers: Record<string, Handler> = {
  categories: {
    async findByID(_c, options) {
      const row = await getCategoryById(getCollectionDatabase(), String(options.id));
      return row ? asDoc(row as unknown as Record<string, unknown>) : null;
    },
    async find(_c, options) {
      const limit = options.limit ?? 10;
      const page = options.page ?? 1;
      const filter = cmsListFilter('categories', options.where);
      const { rows, total } = await listCategories(
        getCollectionDatabase(),
        limit,
        (page - 1) * limit,
        filter,
      );
      return pageResult(
        rows.map((row) => asDoc(row as unknown as Record<string, unknown>)),
        total,
        options,
      );
    },
    async create(_c, options) {
      const data = options.data;
      const title = typeof data.title === 'string' ? data.title : '';
      if (!title) throw new Error('categories create requires title');
      const row = await createCategory(getCollectionDatabase(), {
        id: newId(data),
        title,
        slug: typeof data.slug === 'string' ? data.slug : undefined,
        slugLock: typeof data.slugLock === 'boolean' ? data.slugLock : true,
      });
      return row ? asDoc(row as unknown as Record<string, unknown>) : undefined;
    },
    async update(_c, options) {
      const data = options.data;
      const row = await updateCategory(getCollectionDatabase(), String(options.id), {
        ...(typeof data.title === 'string' ? { title: data.title } : {}),
        ...(typeof data.slug === 'string' ? { slug: data.slug } : {}),
        ...(typeof data.slugLock === 'boolean' ? { slugLock: data.slugLock } : {}),
      });
      return row ? asDoc(row as unknown as Record<string, unknown>) : undefined;
    },
    async delete(_c, options) {
      const row = await deleteCategory(getCollectionDatabase(), String(options.id));
      return row ? asDoc(row as unknown as Record<string, unknown>) : undefined;
    },
  },
  events: {
    async findByID(_c, options) {
      const row = await getEventById(getCollectionDatabase(), String(options.id));
      return row ? asDoc(row as unknown as Record<string, unknown>) : null;
    },
    async find(_c, options) {
      const limit = options.limit ?? 10;
      const page = options.page ?? 1;
      const filter = cmsListFilter('events', options.where);
      const { rows, total } = await listEvents(
        getCollectionDatabase(),
        limit,
        (page - 1) * limit,
        filter,
      );
      return pageResult(
        rows.map((row) => asDoc(row as unknown as Record<string, unknown>)),
        total,
        options,
      );
    },
    async create(_c, options) {
      const data = options.data;
      const row = await createEvent(getCollectionDatabase(), {
        id: newId(data),
        title: typeof data.title === 'string' ? data.title : undefined,
        name: typeof data.name === 'string' ? data.name : undefined,
        description: typeof data.description === 'string' ? data.description : undefined,
        image: typeof data.image === 'string' ? data.image : undefined,
        alt: typeof data.alt === 'string' ? data.alt : undefined,
      });
      return row ? asDoc(row as unknown as Record<string, unknown>) : undefined;
    },
    async update(_c, options) {
      const data = options.data;
      const row = await updateEvent(getCollectionDatabase(), String(options.id), {
        ...(typeof data.title === 'string' ? { title: data.title } : {}),
        ...(typeof data.name === 'string' ? { name: data.name } : {}),
        ...(typeof data.description === 'string' ? { description: data.description } : {}),
        ...(typeof data.image === 'string' ? { image: data.image } : {}),
        ...(typeof data.alt === 'string' ? { alt: data.alt } : {}),
      });
      return row ? asDoc(row as unknown as Record<string, unknown>) : undefined;
    },
    async delete(_c, options) {
      const row = await deleteEvent(getCollectionDatabase(), String(options.id));
      return row ? asDoc(row as unknown as Record<string, unknown>) : undefined;
    },
  },
  contents: {
    async findByID(_c, options) {
      const row = await getContentById(getCollectionDatabase(), String(options.id));
      return row ? asDoc(row as unknown as Record<string, unknown>) : null;
    },
    async find(_c, options) {
      const limit = options.limit ?? 10;
      const page = options.page ?? 1;
      const filter = cmsListFilter('contents', options.where);
      const { rows, total } = await listContents(
        getCollectionDatabase(),
        limit,
        (page - 1) * limit,
        filter,
      );
      return pageResult(
        rows.map((row) => asDoc(row as unknown as Record<string, unknown>)),
        total,
        options,
      );
    },
    async create(_c, options) {
      const data = options.data;
      const name = typeof data.name === 'string' ? data.name : '';
      if (!name) throw new Error('contents create requires name');
      const row = await createContent(getCollectionDatabase(), {
        id: newId(data),
        name,
        description: typeof data.description === 'string' ? data.description : undefined,
        image: typeof data.image === 'string' ? data.image : undefined,
        blocks: Array.isArray(data.blocks) ? data.blocks : [],
      });
      return row ? asDoc(row as unknown as Record<string, unknown>) : undefined;
    },
    async update(_c, options) {
      const data = options.data;
      const row = await updateContent(getCollectionDatabase(), String(options.id), {
        ...(typeof data.name === 'string' ? { name: data.name } : {}),
        ...(typeof data.description === 'string' ? { description: data.description } : {}),
        ...(typeof data.image === 'string' ? { image: data.image } : {}),
        ...(Array.isArray(data.blocks) ? { blocks: data.blocks } : {}),
      });
      return row ? asDoc(row as unknown as Record<string, unknown>) : undefined;
    },
    async delete(_c, options) {
      const row = await deleteContent(getCollectionDatabase(), String(options.id));
      return row ? asDoc(row as unknown as Record<string, unknown>) : undefined;
    },
  },
  tags: {
    async findByID(_c, options) {
      const row = await getTagById(getCollectionDatabase(), String(options.id));
      return row ? asDoc(row as unknown as Record<string, unknown>) : null;
    },
    async find(_c, options) {
      const limit = options.limit ?? 10;
      const page = options.page ?? 1;
      const filter = cmsListFilter('tags', options.where);
      const { rows, total } = await listTags(
        getCollectionDatabase(),
        limit,
        (page - 1) * limit,
        filter,
      );
      return pageResult(
        rows.map((row) => asDoc(row as unknown as Record<string, unknown>)),
        total,
        options,
      );
    },
    async create(_c, options) {
      const data = options.data;
      const name = typeof data.name === 'string' ? data.name : '';
      const slug = typeof data.slug === 'string' ? data.slug : '';
      if (!(name && slug)) throw new Error('tags create requires name and slug');
      const row = await createTag(getCollectionDatabase(), { id: newId(data), name, slug });
      return row ? asDoc(row as unknown as Record<string, unknown>) : undefined;
    },
    async update(_c, options) {
      const data = options.data;
      const row = await updateTag(getCollectionDatabase(), String(options.id), {
        ...(typeof data.name === 'string' ? { name: data.name } : {}),
        ...(typeof data.slug === 'string' ? { slug: data.slug } : {}),
      });
      return row ? asDoc(row as unknown as Record<string, unknown>) : undefined;
    },
    async delete(_c, options) {
      const row = await deleteTag(getCollectionDatabase(), String(options.id));
      return row ? asDoc(row as unknown as Record<string, unknown>) : undefined;
    },
  },
  prices: {
    async findByID(_c, options) {
      const row = await getPriceById(getCollectionDatabase(), String(options.id));
      return row ? asDoc(row as unknown as Record<string, unknown>) : null;
    },
    async find(_c, options) {
      const limit = options.limit ?? 10;
      const page = options.page ?? 1;
      const filter = cmsListFilter('prices', options.where);
      const { rows, total } = await listPrices(
        getCollectionDatabase(),
        limit,
        (page - 1) * limit,
        filter,
      );
      return pageResult(
        rows.map((row) => asDoc(row as unknown as Record<string, unknown>)),
        total,
        options,
      );
    },
    async create(_c, options) {
      const data = options.data;
      const title = typeof data.title === 'string' ? data.title : '';
      if (!title) throw new Error('prices create requires title');
      const row = await createPrice(getCollectionDatabase(), {
        id: newId(data),
        title,
        slug: typeof data.slug === 'string' ? data.slug : undefined,
        publishedOn: toDate(data.publishedOn),
        stripePriceId: typeof data.stripePriceID === 'string' ? data.stripePriceID : undefined,
        priceJson: data.priceJSON ?? undefined,
        enablePaywall: typeof data.enablePaywall === 'boolean' ? data.enablePaywall : false,
        layout: Array.isArray(data.layout) ? data.layout : [],
        paywall: Array.isArray(data.paywall) ? data.paywall : [],
        categories: relIds(data.categories),
        relatedPrices: relIds(data.relatedPrices),
        skipSync: typeof data.skipSync === 'boolean' ? data.skipSync : false,
        status: typeof data._status === 'string' ? data._status : 'draft',
      });
      return row
        ? asDoc({
            ...(row as unknown as Record<string, unknown>),
            stripePriceID: row.stripePriceId,
          })
        : undefined;
    },
    async update(_c, options) {
      const data = options.data;
      const row = await updatePrice(getCollectionDatabase(), String(options.id), {
        ...(typeof data.title === 'string' ? { title: data.title } : {}),
        ...(typeof data.slug === 'string' ? { slug: data.slug } : {}),
        ...(toDate(data.publishedOn) ? { publishedOn: toDate(data.publishedOn) } : {}),
        ...(typeof data.stripePriceID === 'string' ? { stripePriceId: data.stripePriceID } : {}),
        ...('priceJSON' in data ? { priceJson: data.priceJSON } : {}),
        ...(typeof data.enablePaywall === 'boolean' ? { enablePaywall: data.enablePaywall } : {}),
        ...(Array.isArray(data.layout) ? { layout: data.layout } : {}),
        ...(Array.isArray(data.paywall) ? { paywall: data.paywall } : {}),
        ...('categories' in data ? { categories: relIds(data.categories) } : {}),
        ...('relatedPrices' in data ? { relatedPrices: relIds(data.relatedPrices) } : {}),
      });
      return row
        ? asDoc({
            ...(row as unknown as Record<string, unknown>),
            stripePriceID: row.stripePriceId,
          })
        : undefined;
    },
    async delete(_c, options) {
      const row = await deletePrice(getCollectionDatabase(), String(options.id));
      return row ? asDoc(row as unknown as Record<string, unknown>) : undefined;
    },
  },
  info: {
    async findByID(_c, options) {
      const row = await getInfoById(getCollectionDatabase(), String(options.id));
      return row ? asDoc(row as unknown as Record<string, unknown>) : null;
    },
    async find(_c, options) {
      const limit = options.limit ?? 10;
      const page = options.page ?? 1;
      const filter = cmsListFilter('info', options.where);
      const { rows, total } = await listInfo(
        getCollectionDatabase(),
        limit,
        (page - 1) * limit,
        filter,
      );
      return pageResult(
        rows.map((row) => asDoc(row as unknown as Record<string, unknown>)),
        total,
        options,
      );
    },
    async create(_c, options) {
      const data = options.data;
      const title = typeof data.title === 'string' ? data.title : '';
      const subtitle = typeof data.subtitle === 'string' ? data.subtitle : '';
      const description = typeof data.description === 'string' ? data.description : '';
      const image = typeof data.image === 'string' ? data.image : '';
      if (!(title && subtitle && description && image)) {
        throw new Error('info create requires title, subtitle, description, and image');
      }
      const row = await createInfo(getCollectionDatabase(), {
        id: newId(data),
        title,
        subtitle,
        description,
        image,
      });
      return row ? asDoc(row as unknown as Record<string, unknown>) : undefined;
    },
    async update(_c, options) {
      const data = options.data;
      const row = await updateInfo(getCollectionDatabase(), String(options.id), {
        ...(typeof data.title === 'string' ? { title: data.title } : {}),
        ...(typeof data.subtitle === 'string' ? { subtitle: data.subtitle } : {}),
        ...(typeof data.description === 'string' ? { description: data.description } : {}),
        ...(typeof data.image === 'string' ? { image: data.image } : {}),
      });
      return row ? asDoc(row as unknown as Record<string, unknown>) : undefined;
    },
    async delete(_c, options) {
      const row = await deleteInfo(getCollectionDatabase(), String(options.id));
      return row ? asDoc(row as unknown as Record<string, unknown>) : undefined;
    },
  },
  videos: {
    async findByID(_c, options) {
      const row = await getVideoById(getCollectionDatabase(), String(options.id));
      return row ? asDoc(row as unknown as Record<string, unknown>) : null;
    },
    async find(_c, options) {
      const limit = options.limit ?? 10;
      const page = options.page ?? 1;
      const filter = cmsListFilter('videos', options.where);
      const { rows, total } = await listVideos(
        getCollectionDatabase(),
        limit,
        (page - 1) * limit,
        filter,
      );
      return pageResult(
        rows.map((row) => asDoc(row as unknown as Record<string, unknown>)),
        total,
        options,
      );
    },
    async create(_c, options) {
      const data = options.data;
      const row = await createVideo(getCollectionDatabase(), {
        id: newId(data),
        url: typeof data.url === 'string' ? data.url : undefined,
      });
      return row ? asDoc(row as unknown as Record<string, unknown>) : undefined;
    },
    async update(_c, options) {
      const data = options.data;
      const row = await updateVideo(getCollectionDatabase(), String(options.id), {
        ...(typeof data.url === 'string' ? { url: data.url } : {}),
      });
      return row ? asDoc(row as unknown as Record<string, unknown>) : undefined;
    },
    async delete(_c, options) {
      const row = await deleteVideo(getCollectionDatabase(), String(options.id));
      return row ? asDoc(row as unknown as Record<string, unknown>) : undefined;
    },
  },
  subscriptions: {
    async findByID(_c, options) {
      const row = await getSubscriptionById(getCollectionDatabase(), String(options.id));
      return row ? asDoc(row as unknown as Record<string, unknown>) : null;
    },
    async find(_c, options) {
      const { limit, page } = collectionPageSchema.parse({
        limit: options.limit ?? 10,
        page: options.page ?? 1,
      });
      const offset = (page - 1) * limit;
      if (!Number.isSafeInteger(offset)) throw new Error('Invalid subscriptions page offset');
      const filter = cmsListFilter('subscriptions', options.where);
      const { rows, total } = await listSubscriptions(
        getCollectionDatabase(),
        limit,
        offset,
        filter,
      );
      return pageResult(
        rows.map((row) => asDoc(row as unknown as Record<string, unknown>)),
        total,
        options,
      );
    },
    async create(_c, options) {
      const data = options.data;
      const id = typeof data.id === 'string' ? data.id : newId(data);
      const userId =
        typeof data.userId === 'string'
          ? data.userId
          : data.userId && typeof data.userId === 'object' && 'id' in data.userId
            ? String((data.userId as { id: unknown }).id)
            : '';
      const status = typeof data.status === 'string' ? data.status : '';
      const priceId = typeof data.priceId === 'string' ? data.priceId : '';
      if (!(userId && status && priceId)) {
        throw new Error('subscriptions create requires userId, status, and priceId');
      }
      const row = await createSubscription(getCollectionDatabase(), {
        id,
        userId,
        status,
        priceId,
        quantity: typeof data.quantity === 'number' ? data.quantity : undefined,
        cancelAt: toDate(data.cancelAt),
        canceledAt: toDate(data.canceledAt),
        currentPeriodStart: toDate(data.currentPeriodStart),
        currentPeriodEnd: toDate(data.currentPeriodEnd),
        trialStart: toDate(data.trialStart),
        trialEnd: toDate(data.trialEnd),
        metadata: data.metadata ?? undefined,
      });
      return row ? asDoc(row as unknown as Record<string, unknown>) : undefined;
    },
    async update(_c, options) {
      const data = options.data;
      const row = await updateSubscription(getCollectionDatabase(), String(options.id), {
        ...(typeof data.status === 'string' ? { status: data.status } : {}),
        ...(typeof data.priceId === 'string' ? { priceId: data.priceId } : {}),
        ...(typeof data.quantity === 'number' ? { quantity: data.quantity } : {}),
      });
      return row ? asDoc(row as unknown as Record<string, unknown>) : undefined;
    },
    async delete(_c, options) {
      const row = await deleteSubscription(getCollectionDatabase(), String(options.id));
      return row ? asDoc(row as unknown as Record<string, unknown>) : undefined;
    },
  },
};
