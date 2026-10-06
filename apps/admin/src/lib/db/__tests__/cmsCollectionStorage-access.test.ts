// @vitest-environment node
import { PGlite } from '@electric-sql/pglite';
import { RevealUICollection } from '@revealui/core';
import type {
  QueryableDatabaseAdapter,
  RevealCollectionConfig,
  RevealFindOptions,
} from '@revealui/core/types';
import { getTableColumns, getTableName } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/pglite';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { Conversations } from '@/lib/collections/Conversations';
import { Orders } from '@/lib/collections/Orders';
import { adminsOrCustomer } from '@/lib/collections/Orders/access/adminsOrCustomer';
import { conversations } from '../../../../../../packages/db/src/schema/agents';
import {
  categories,
  contents,
  events,
  info,
  prices,
  subscriptions,
  tags,
  videos,
} from '../../../../../../packages/db/src/schema/cms-collections';
import { orders } from '../../../../../../packages/db/src/schema/products';
import { cmsCollectionHandlers } from '../cmsCollectionStorage';
import { createTypedCollectionStorage } from '../typedCollectionStorage';

const { getRestClient } = vi.hoisted(() => ({ getRestClient: vi.fn() }));
vi.mock('@revealui/db/client', () => ({ getRestClient }));

function find(
  config: RevealCollectionConfig,
  db: QueryableDatabaseAdapter | null,
  options: RevealFindOptions,
) {
  return new RevealUICollection(config, db).find(options);
}

const client = new PGlite();
const database = drizzle(client);
const query = vi.fn(async () => ({ rows: [], rowCount: 0 }));
const access = vi.fn(() => ({ id: { equals: 'tenant-a' } }));
const collection: RevealCollectionConfig = {
  slug: 'tags',
  fields: [],
  access: { read: access },
};
const ordersReadCollection: RevealCollectionConfig = {
  slug: Orders.slug,
  fields: [],
  access: { read: ({ req }) => adminsOrCustomer({ req }) },
};

beforeAll(async () => {
  for (const table of [
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
  ]) {
    const columns = Object.values(getTableColumns(table)).map(
      (column) => `"${column.name}" ${column.getSQLType()}`,
    );
    await client.exec(`CREATE TABLE "${getTableName(table)}" (${columns.join(', ')})`);
  }
  for (const table of [categories, contents, events, info, subscriptions, videos]) {
    await client.exec(
      `INSERT INTO "${getTableName(table)}" (id) VALUES ('tenant-a'), ('tenant-b')`,
    );
  }
  await client.exec(`
    INSERT INTO tags VALUES ('tenant-a', 'Allowed', 'allowed'), ('tenant-b', 'Private', 'private');
    INSERT INTO prices (id, title, status) VALUES ('published-price', 'Public', 'published'), ('draft-price', 'Private', 'draft');
    INSERT INTO prices (id, title, status, deleted_at) VALUES ('deleted-price', 'Deleted', 'published', now());
    UPDATE prices SET published_on = '2026-01-01T00:00:00Z', stripe_price_id = 'stripe-public' WHERE id = 'published-price';
    UPDATE prices SET published_on = '2026-02-01T00:00:00Z' WHERE id = 'draft-price';
    UPDATE videos SET url = 'https://example.invalid' WHERE id = 'tenant-a';
    UPDATE subscriptions SET quantity = 2, user_id = 'user-a' WHERE id = 'tenant-a';
    UPDATE subscriptions SET user_id = 'user-b' WHERE id = 'tenant-b';
  `);
});
afterAll(async () => {
  await client.close();
});
afterEach(() => {
  vi.unstubAllEnvs();
});
beforeEach(async () => {
  vi.clearAllMocks();
  vi.stubEnv('POSTGRES_URL', 'postgresql://synthetic.invalid/test');
  getRestClient.mockReturnValue(database);
  await client.exec(`
    TRUNCATE conversations, orders;
    INSERT INTO conversations (id, version, user_id, agent_id, title, status, created_at, updated_at)
    VALUES ('conversation-a', 1, 'user-a', 'agent-a', 'Owned', 'active', '2026-01-01', '2026-01-02'),
      ('conversation-a-archived', 1, 'user-a', 'agent-a', 'Archived', 'archived', '2026-01-01', '2026-01-03'),
      ('conversation-b', 1, 'user-b', 'agent-b', 'Private', 'ended', '2026-01-01', '2026-01-04');
    INSERT INTO orders (id, customer_id, status, total_in_cents, currency, items, created_at, updated_at, deleted_at)
    VALUES ('order-a', 'user-a', 'confirmed', 1250, 'usd', '[{"productId":"p-a","title":"Plan","quantity":1,"priceInCents":1250}]', '2026-01-01', '2026-01-02', null),
      ('order-b', 'user-b', 'confirmed', 2500, 'usd', '[{"productId":"p-b","title":"Other","quantity":1,"priceInCents":2500}]', '2026-01-01', '2026-01-03', null),
      ('order-deleted', 'user-a', 'confirmed', 1000, 'usd', '[]', '2026-01-01', '2026-01-04', '2026-01-05');
  `);
});

describe('CMS access-scoped lists', () => {
  it('applies the core access filter to both rows and total count', async () => {
    const result = await find(
      collection,
      { query, collectionStorage: createTypedCollectionStorage() },
      { req: {} },
    );
    expect.soft(result.docs.map((doc) => doc.id)).toEqual(['tenant-a']);
    expect.soft(result.totalDocs).toBe(1);
    expect(query).not.toHaveBeenCalled();
  });
  it('intersects caller and access scopes', async () => {
    const result = await find(
      collection,
      { query, collectionStorage: createTypedCollectionStorage() },
      { req: {}, where: { id: { equals: 'tenant-b' } } },
    );
    expect.soft(result.docs).toEqual([]);
    expect.soft(result.totalDocs).toBe(0);
  });
  it('applies the actual core published-only draft predicate', async () => {
    const result = await find(
      { slug: 'prices', fields: [], versions: { drafts: true }, access: { read: () => true } },
      { query, collectionStorage: createTypedCollectionStorage() },
      { req: {} },
    );
    expect.soft(result.docs.map((doc) => doc.id)).toEqual(['published-price']);
    expect.soft(result.totalDocs).toBe(1);
  });
  it('keeps unrestricted lists and pagination', async () => {
    const result = await find(
      { slug: 'tags', fields: [] },
      { query, collectionStorage: createTypedCollectionStorage() },
      { limit: 1 },
    );
    expect.soft(result.docs).toHaveLength(1);
    expect.soft(result.totalDocs).toBe(2);
    expect(result.hasNextPage).toBe(true);
  });
});

describe('normalized order and conversation collection reads', () => {
  it('limits conversation creation to the authenticated owner', async () => {
    const createAccess = Conversations.access?.create;
    if (!createAccess) throw new Error('Missing conversation create access rule');

    expect(
      await createAccess({
        req: { user: { id: 'user-a', email: 'a@example.com' } },
        data: { userId: 'user-a' },
      }),
    ).toBe(true);
    expect(
      await createAccess({
        req: { user: { id: 'user-a', email: 'a@example.com' } },
        data: { userId: 'user-b' },
      }),
    ).toBe(false);
    expect(await createAccess({ req: {}, data: { userId: 'user-a' } })).toBe(false);
  });

  it('applies the authenticated conversation owner predicate to rows and counts', async () => {
    const result = await find(
      Conversations,
      { query, collectionStorage: createTypedCollectionStorage() },
      { req: { user: { id: 'user-a', email: 'a@example.com' } }, limit: 10, page: 1 },
    );
    expect(result.docs.map((doc) => doc.id)).toEqual(['conversation-a-archived', 'conversation-a']);
    expect(result.totalDocs).toBe(2);
    expect(result.docs[0]).toMatchObject({ status: 'archived', userId: 'user-a' });
    expect(result.docs[0]).not.toHaveProperty('session_id');
    expect(query).not.toHaveBeenCalled();
  });

  it('intersects caller filters with order ownership and exposes cents without conversion', async () => {
    const result = await find(
      ordersReadCollection,
      { query, collectionStorage: createTypedCollectionStorage() },
      {
        req: { user: { id: 'user-a', email: 'a@example.com' } },
        where: { status: { equals: 'confirmed' } },
        limit: 10,
        page: 1,
      },
    );
    expect(result.docs).toHaveLength(1);
    expect(result.docs[0]).toMatchObject({
      id: 'order-a',
      customerId: 'user-a',
      totalInCents: 1250,
      currency: 'usd',
      items: [{ productId: 'p-a', quantity: 1, priceInCents: 1250 }],
    });
    expect(result.totalDocs).toBe(1);
    expect(query).not.toHaveBeenCalled();
  });

  it('excludes soft-deleted orders from both lists and detail reads', async () => {
    const db = { query, collectionStorage: createTypedCollectionStorage() };
    const result = await find(ordersReadCollection, db, {
      req: { user: { id: 'user-a', email: 'a@example.com' } },
    });
    const deleted = await new RevealUICollection(ordersReadCollection, db).findByID({
      id: 'order-deleted',
      req: { user: { id: 'user-a', email: 'a@example.com' } },
    });

    expect(result.docs.map((doc) => doc.id)).toEqual(['order-a']);
    expect(result.totalDocs).toBe(1);
    expect(deleted).toBeNull();
  });

  it('rejects malformed filters before acquiring the database client', async () => {
    await expect(
      find(
        ordersReadCollection,
        { query, collectionStorage: createTypedCollectionStorage() },
        {
          req: { user: { id: 'user-a', email: 'a@example.com' } },
          where: { totalInCents: { equals: '1250' } },
        },
      ),
    ).rejects.toThrow();
    expect(getRestClient).not.toHaveBeenCalled();
    expect(query).not.toHaveBeenCalled();
  });

  it('rejects malformed stored order items rather than returning a partial document', async () => {
    await client.exec('UPDATE orders SET items = \'[{"productId":"p-a"}]\' WHERE id = \'order-a\'');
    await expect(
      find(
        ordersReadCollection,
        { query, collectionStorage: createTypedCollectionStorage() },
        {
          req: { user: { id: 'user-a', email: 'a@example.com' } },
        },
      ),
    ).rejects.toThrow();
  });
});

describe('CMS validated list contract', () => {
  for (const [slug, handler] of Object.entries(cmsCollectionHandlers)) {
    const expected = slug === 'prices' ? 'published-price' : 'tenant-a';
    it(`${slug} filters rows and count before pagination`, async () => {
      const result = await handler.find(
        { slug, fields: [] },
        { where: { id: { equals: expected } } },
      );
      expect(result?.docs.map((doc) => doc.id)).toEqual([expected]);
      expect(result?.totalDocs).toBe(1);
      const next = await handler.find(
        { slug, fields: [] },
        { where: { id: { equals: expected } }, limit: 1, page: 2 },
      );
      expect(next?.docs).toEqual([]);
      expect(next?.totalDocs).toBe(1);
    });
    it(`${slug} retains unfiltered scope and rejects unsupported filters before database acquisition`, async () => {
      const result = await handler.find({ slug, fields: [] }, {});
      expect(result?.docs).toHaveLength(2);
      expect(result?.totalDocs).toBe(2);
      getRestClient.mockClear();
      await expect(
        handler.find({ slug, fields: [] }, { where: { id: { contains: 'tenant' } } }),
      ).rejects.toThrow('Unsupported CMS list filter');
      expect(getRestClient).not.toHaveBeenCalled();
    });
  }

  async function readTags(options: Parameters<typeof find>[2]) {
    return find(
      { slug: 'tags', fields: [] },
      { query, collectionStorage: createTypedCollectionStorage() },
      options,
    );
  }
  it('supports nested AND/OR without dropping sibling restrictions', async () => {
    const result = await readTags({
      where: {
        and: [
          { or: [{ id: { equals: 'tenant-a' } }, { id: { equals: 'tenant-b' } }] },
          { id: { not_equals: 'tenant-b' } },
        ],
      },
    });
    expect(result.docs.map((doc) => doc.id)).toEqual(['tenant-a']);
    expect(result.totalDocs).toBe(1);
  });
  it('binds hostile scalar values as data', async () => {
    const result = await readTags({ where: { id: { equals: "tenant-a' OR TRUE --" } } });
    expect(result.docs).toEqual([]);
    expect(result.totalDocs).toBe(0);
  });
  it('supports membership, including empty lists', async () => {
    expect((await readTags({ where: { id: { in: ['tenant-a'] } } })).totalDocs).toBe(1);
    expect((await readTags({ where: { id: { not_in: ['tenant-a'] } } })).totalDocs).toBe(1);
    expect((await readTags({ where: { id: { in: [] } } })).totalDocs).toBe(0);
    expect((await readTags({ where: { id: { not_in: [] } } })).totalDocs).toBe(2);
  });
  it('keeps draft relaxation separate from access restrictions and soft deletion', async () => {
    const config: RevealCollectionConfig = {
      slug: 'prices',
      fields: [],
      versions: { drafts: true },
      access: { read: () => ({ _status: { equals: 'published' } }) },
    };
    const db = { query, collectionStorage: createTypedCollectionStorage() };
    const result = await find(config, db, { req: {}, draft: true });
    expect(result.docs.map((doc) => doc.id)).toEqual(['published-price']);
    expect(result.totalDocs).toBe(1);
    expect(
      (await find({ ...config, access: { read: () => true } }, db, { req: {}, draft: true }))
        .totalDocs,
    ).toBe(2);
  });
  it('maps actual Prices scalar fields and validates dates', async () => {
    const handler = cmsCollectionHandlers.prices;
    if (!handler) throw new Error('Missing prices handler');
    const result = await handler.find(
      { slug: 'prices', fields: [] },
      {
        where: {
          publishedOn: { less_than: '2026-01-15T00:00:00Z' },
          stripePriceID: { equals: 'stripe-public' },
        },
      },
    );
    expect(result?.docs.map((doc) => doc.id)).toEqual(['published-price']);
    expect(result?.totalDocs).toBe(1);
    await expect(
      handler.find(
        { slug: 'prices', fields: [] },
        { where: { publishedOn: { equals: 'not-a-date' } } },
      ),
    ).rejects.toThrow();
  });
  it('validates typed comparisons and null predicates', async () => {
    const subscriptionHandler = cmsCollectionHandlers.subscriptions;
    const videoHandler = cmsCollectionHandlers.videos;
    if (!(subscriptionHandler && videoHandler)) throw new Error('Missing handler');
    expect(
      (
        await subscriptionHandler.find(
          { slug: 'subscriptions', fields: [] },
          { where: { quantity: { greater_than: 1 } } },
        )
      )?.totalDocs,
    ).toBe(1);
    await expect(
      subscriptionHandler.find(
        { slug: 'subscriptions', fields: [] },
        { where: { quantity: { equals: '2' } } },
      ),
    ).rejects.toThrow();
    expect(
      (
        await videoHandler.find(
          { slug: 'videos', fields: [] },
          { where: { url: { equals: null } } },
        )
      )?.totalDocs,
    ).toBe(1);
    expect(
      (
        await videoHandler.find(
          { slug: 'videos', fields: [] },
          { where: { url: { exists: true } } },
        )
      )?.totalDocs,
    ).toBe(1);
    expect(
      (
        await videoHandler.find(
          { slug: 'videos', fields: [] },
          { where: { url: { not_equals: null } } },
        )
      )?.totalDocs,
    ).toBe(1);
  });
  for (const [index, where] of [
    null,
    false,
    0,
    '',
    [],
    new Date(),
    { id: {} },
    { and: [] },
    { id: { equals: undefined } },
    { id: { equals: 3 } },
    { id: { equals: 'tenant-a', bad: 1 } },
    { missing: { equals: 'tenant-a' } },
    { constructor: { equals: 'tenant-a' } },
    { id: { near: 'tenant-a' } },
    { id: { in: [null] } },
    { id: { exists: 'true' } },
    { and: Array.from({ length: 101 }, () => ({ id: { equals: 'tenant-a' } })) },
  ].entries()) {
    it(`rejects malformed or unsupported input before database acquisition: ${index}`, async () => {
      const handler = cmsCollectionHandlers.tags;
      if (!handler) throw new Error('Missing tags handler');
      const options: RevealFindOptions = {};
      Reflect.set(options, 'where', where);
      await expect(handler.find({ slug: 'tags', fields: [] }, options)).rejects.toThrow();
      expect(getRestClient).not.toHaveBeenCalled();
    });
  }
  it('rejects cyclic and accessor input without evaluating accessors', async () => {
    const handler = cmsCollectionHandlers.tags;
    if (!handler) throw new Error('Missing tags handler');
    const where = {};
    Reflect.set(where, 'and', [where]);
    const options: RevealFindOptions = {};
    Reflect.set(options, 'where', where);
    await expect(handler.find({ slug: 'tags', fields: [] }, options)).rejects.toThrow(
      'complexity limit',
    );
    const getter = vi.fn(() => ({ equals: 'tenant-a' }));
    Object.defineProperty(options, 'where', {
      value: Object.defineProperty({}, 'id', { enumerable: true, get: getter }),
    });
    await expect(handler.find({ slug: 'tags', fields: [] }, options)).rejects.toThrow();
    expect(getter).not.toHaveBeenCalled();
    expect(getRestClient).not.toHaveBeenCalled();
  });
  for (const operator of ['and', 'or', 'in', 'not_in']) {
    for (const shape of [
      'getter',
      'sparse',
      'prototype',
      'extra',
      'symbol',
      'nonenumerable',
      'oversized',
    ]) {
      it(`rejects ${shape} arrays in ${operator} before reading elements or acquiring a database`, async () => {
        const handler = cmsCollectionHandlers.tags;
        if (!handler) throw new Error('Missing tags handler');
        const values =
          operator === 'and' || operator === 'or' ? [{ id: { equals: 'tenant-a' } }] : ['tenant-a'];
        const element = values[0];
        const getter = vi.fn(() => element);
        if (shape === 'getter')
          Object.defineProperty(values, '0', { get: getter, enumerable: true });
        if (shape === 'oversized') {
          values.length = 101;
          Object.defineProperty(values, '0', { get: getter, enumerable: true });
        }
        if (shape === 'sparse') Reflect.deleteProperty(values, '0');
        if (shape === 'prototype') Object.setPrototypeOf(values, Object.create(Array.prototype));
        if (shape === 'extra') Reflect.set(values, 'extra', true);
        if (shape === 'symbol') Reflect.set(values, Symbol('extra'), true);
        if (shape === 'nonenumerable') Object.defineProperty(values, '0', { enumerable: false });
        const predicate = {};
        Reflect.set(predicate, operator, values);
        const options: RevealFindOptions = {};
        Reflect.set(
          options,
          'where',
          operator === 'and' || operator === 'or' ? predicate : { id: predicate },
        );
        await expect(handler.find({ slug: 'tags', fields: [] }, options)).rejects.toThrow();
        expect(getter).not.toHaveBeenCalled();
        expect(getRestClient).not.toHaveBeenCalled();
      });
    }
  }
  it('composes an empty caller where with access and draft restrictions', async () => {
    const db = { query, collectionStorage: createTypedCollectionStorage() };
    const scoped = await find(collection, db, { req: {}, where: {} });
    expect(scoped.docs.map((doc) => doc.id)).toEqual(['tenant-a']);
    expect(scoped.totalDocs).toBe(1);
    const published = await find({ slug: 'prices', fields: [], versions: { drafts: true } }, db, {
      where: {},
    });
    expect(published.docs.map((doc) => doc.id)).toEqual(['published-price']);
    expect(published.totalDocs).toBe(1);
    const grouped = await readTags({ where: { or: [{}, { id: { equals: 'tenant-a' } }] } });
    expect(grouped.docs.map((doc) => doc.id)).toEqual(['tenant-a']);
    expect(grouped.totalDocs).toBe(1);
    for (const where of [{ and: [{}] }, { or: [{}, {}] }]) {
      const allEmpty = await find(collection, db, { req: {}, where });
      expect(allEmpty.docs.map((doc) => doc.id)).toEqual(['tenant-a']);
      expect(allEmpty.totalDocs).toBe(1);
    }
    expect((await readTags({ where: { or: [{}, {}] } })).totalDocs).toBe(2);
  });
  it('scopes subscriptions by canonical userId and rejects undeclared user fields', async () => {
    const config: RevealCollectionConfig = { slug: 'subscriptions', fields: [] };
    const db = { query, collectionStorage: createTypedCollectionStorage() };
    const scoped = await find(config, db, { where: { userId: { equals: 'user-a' } } });
    expect(scoped.docs.map((doc) => doc.id)).toEqual(['tenant-a']);
    expect(scoped.totalDocs).toBe(1);
    const handler = cmsCollectionHandlers.subscriptions;
    if (!handler) throw new Error('Missing subscriptions handler');
    try {
      // Deleting exactly the scoped result leaves the other user untouched.
      for (const doc of scoped.docs) await handler.delete(config, { id: doc.id });
      const remaining = await find(config, db, {});
      expect(remaining.docs.map((doc) => doc.id)).toEqual(['tenant-b']);
      expect(remaining.totalDocs).toBe(1);
    } finally {
      await client.exec(
        "INSERT INTO subscriptions (id, user_id, quantity) VALUES ('tenant-a', 'user-a', 2)",
      );
    }
    getRestClient.mockClear();
    await expect(handler.find(config, { where: { user: { equals: 'user-a' } } })).rejects.toThrow(
      'Unsupported CMS list filter field',
    );
    expect(getRestClient).not.toHaveBeenCalled();
  });
  it('allows an empty root where and preserves unsupported collection fallback', async () => {
    expect((await readTags({ where: {} })).totalDocs).toBe(2);
    const storage = createTypedCollectionStorage();
    expect(
      await storage?.find?.(
        { slug: 'media', fields: [] },
        { where: { id: { equals: 'tenant-a' } } },
      ),
    ).toBeUndefined();
    getRestClient.mockClear();
    const result = await find(
      { ...collection, slug: 'media' },
      { query, collectionStorage: storage },
      { req: {} },
    );
    expect(result.docs).toEqual([]);
    expect(query).toHaveBeenCalledTimes(2);
    expect(query.mock.calls[0]).toContainEqual(['tenant-a']);
    expect(getRestClient).not.toHaveBeenCalled();
  });
});
