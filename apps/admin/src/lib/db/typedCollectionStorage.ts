import type {
  RevealCollectionConfig,
  RevealDataObject,
  RevealDocument,
  RevealFindOptions,
  RevealPaginatedResult,
  RevealRequest,
} from '@revealui/core/types';
import { getRestClient } from '@revealui/db/client';
import { createPage, deletePage, getPageById, updatePage } from '@revealui/db/queries/pages';
import { createPost, deletePost, getPostById, updatePost } from '@revealui/db/queries/posts';
import { posts } from '@revealui/db/schema/admin';
import { pages } from '@revealui/db/schema/pages';
import { type Tenant as DbTenant, tenants } from '@revealui/db/schema/tenants';
import { type User as DbUser, users } from '@revealui/db/schema/users';
import { and, asc, count, desc, eq, isNull, or, type SQL, sql } from 'drizzle-orm';

type UserWhereCondition = NonNullable<RevealFindOptions['where']>;
type UserSort = NonNullable<RevealFindOptions['sort']>;

const SUPPORTED_COLLECTION = 'users';

type TypedCollectionHandler = {
  findByID?: (
    collection: RevealCollectionConfig,
    options: { id: string | number },
  ) => Promise<RevealDocument | null | undefined>;
  find?: (
    collection: RevealCollectionConfig,
    options: RevealFindOptions,
  ) => Promise<RevealPaginatedResult | undefined>;
  create?: (
    collection: RevealCollectionConfig,
    options: { data: RevealDataObject; req?: RevealRequest },
  ) => Promise<RevealDocument | undefined>;
  update?: (
    collection: RevealCollectionConfig,
    options: { id: string | number; data: RevealDataObject; req?: RevealRequest },
  ) => Promise<RevealDocument | undefined>;
  delete?: (
    collection: RevealCollectionConfig,
    options: { id: string | number; req?: RevealRequest },
  ) => Promise<RevealDocument | undefined>;
};

type LocalCollectionStorageAdapter = {
  findByID?: (
    collection: RevealCollectionConfig,
    options: { id: string | number },
  ) => Promise<RevealDocument | null | undefined>;
  find?: (
    collection: RevealCollectionConfig,
    options: RevealFindOptions,
  ) => Promise<RevealPaginatedResult | undefined>;
  create?: (
    collection: RevealCollectionConfig,
    options: { data: RevealDataObject; req?: RevealRequest },
  ) => Promise<RevealDocument | undefined>;
  update?: (
    collection: RevealCollectionConfig,
    options: { id: string | number; data: RevealDataObject; req?: RevealRequest },
  ) => Promise<RevealDocument | undefined>;
  delete?: (
    collection: RevealCollectionConfig,
    options: { id: string | number; req?: RevealRequest },
  ) => Promise<RevealDocument | undefined>;
};

function isSqlCondition(value: SQL<unknown> | null | undefined): value is SQL<unknown> {
  return value !== null && value !== undefined;
}

function hasTypedCollectionDatabase(): boolean {
  return Boolean(process.env.POSTGRES_URL || process.env.DATABASE_URL);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

interface JsonBackedRow {
  _json?: unknown;
}

function getJsonFields(row: JsonBackedRow): Record<string, unknown> {
  return isRecord(row._json) ? row._json : {};
}

function splitName(name: string): { firstName?: string; lastName?: string } {
  const trimmed = name.trim();
  if (!trimmed) return {};

  const parts = trimmed.split(/\s+/);
  if (parts.length === 1) {
    return { firstName: parts[0] };
  }

  return {
    firstName: parts[0],
    lastName: parts.slice(1).join(' '),
  };
}

function mapUserDocument(row: DbUser): RevealDocument {
  const json = getJsonFields(row);
  const fallbackNames = splitName(row.name || '');

  return {
    ...json,
    id: row.id,
    name: row.name,
    email: row.email,
    role: row.role,
    status: row.status,
    type: row.type,
    stripeCustomerId: row.stripeCustomerId,
    avatarUrl: row.avatarUrl,
    emailVerified: row.emailVerified,
    emailVerifiedAt: row.emailVerifiedAt,
    tosAcceptedAt: row.tosAcceptedAt,
    tosVersion: row.tosVersion,
    lastActiveAt: row.lastActiveAt,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    firstName:
      typeof json.firstName === 'string' ? json.firstName : (fallbackNames.firstName ?? undefined),
    lastName:
      typeof json.lastName === 'string' ? json.lastName : (fallbackNames.lastName ?? undefined),
  };
}

function mapTenantDocument(row: DbTenant): RevealDocument {
  const json = getJsonFields(row);

  return {
    ...json,
    id: row.id,
    name: row.name,
    email: row.email,
    password: row.password,
    roles: row.roles,
    domains: row.domains,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function buildDomainConditions(values: string[]) {
  const normalized = values.filter((value) => typeof value === 'string' && value.length > 0);
  if (normalized.length === 0) {
    return null;
  }

  const clauses = normalized.map((value) => {
    return sql`${tenants.domains} @> ${JSON.stringify([{ domain: value }])}::jsonb`;
  });

  return clauses.length === 1 ? clauses[0] : or(...clauses);
}

function buildUsersWhere(where: RevealFindOptions['where']) {
  if (!where) return undefined;
  if (!isRecord(where)) return null;

  const conditions = Object.entries(where as UserWhereCondition).map(([field, condition]) => {
    if (!(isRecord(condition) && 'equals' in condition)) {
      return null;
    }

    const value = condition.equals;

    switch (field) {
      case 'id':
        return eq(users.id, String(value));
      case 'email':
        return typeof value === 'string' ? eq(users.email, value) : null;
      case 'status':
        return typeof value === 'string' ? eq(users.status, value) : null;
      default:
        return null;
    }
  });

  if (conditions.some((condition) => condition === null)) {
    return null;
  }

  if (conditions.length === 0) {
    return undefined;
  }

  if (conditions.length === 1) {
    return conditions[0] ?? undefined;
  }

  const validConditions = conditions.filter(isSqlCondition);
  return and(...validConditions);
}

function buildUsersOrderBy(sort: RevealFindOptions['sort']) {
  if (!sort) return [];
  if (!isRecord(sort)) return null;

  const orderBy = Object.entries(sort as UserSort).map(([field, direction]) => {
    switch (field) {
      case 'email':
        return direction === '-1' ? desc(users.email) : asc(users.email);
      case 'createdAt':
        return direction === '-1' ? desc(users.createdAt) : asc(users.createdAt);
      case 'updatedAt':
        return direction === '-1' ? desc(users.updatedAt) : asc(users.updatedAt);
      default:
        return null;
    }
  });

  return orderBy.some((entry) => entry === null) ? null : orderBy.filter(isSqlCondition);
}

function buildTenantsWhere(where: RevealFindOptions['where']) {
  if (!where) return undefined;
  if (!isRecord(where)) return null;

  const conditions = Object.entries(where).map(([field, condition]) => {
    if (!isRecord(condition)) {
      return null;
    }

    switch (field) {
      case 'id':
        return 'equals' in condition ? eq(tenants.id, String(condition.equals)) : null;
      case 'email':
        return typeof condition.equals === 'string' ? eq(tenants.email, condition.equals) : null;
      case 'domains.domain':
        if (typeof condition.equals === 'string') {
          return buildDomainConditions([condition.equals]);
        }
        if (Array.isArray(condition.in)) {
          return buildDomainConditions(
            condition.in.filter((value): value is string => typeof value === 'string'),
          );
        }
        return null;
      default:
        return null;
    }
  });

  if (conditions.some((condition) => condition === null)) {
    return null;
  }

  if (conditions.length === 0) {
    return undefined;
  }

  if (conditions.length === 1) {
    return conditions[0] ?? undefined;
  }

  const validConditions = conditions.filter(isSqlCondition);
  return and(...validConditions);
}

function buildTenantsOrderBy(sort: RevealFindOptions['sort']) {
  if (!sort) return [];
  if (!isRecord(sort)) return null;

  const orderBy = Object.entries(sort).map(([field, direction]) => {
    switch (field) {
      case 'name':
        return direction === '-1' ? desc(tenants.name) : asc(tenants.name);
      case 'email':
        return direction === '-1' ? desc(tenants.email) : asc(tenants.email);
      case 'createdAt':
        return direction === '-1' ? desc(tenants.createdAt) : asc(tenants.createdAt);
      case 'updatedAt':
        return direction === '-1' ? desc(tenants.updatedAt) : asc(tenants.updatedAt);
      default:
        return null;
    }
  });

  return orderBy.some((entry) => entry === null) ? null : orderBy.filter(isSqlCondition);
}

async function findTypedUserByID(
  collection: RevealCollectionConfig,
  options: { id: string | number },
): Promise<RevealDocument | null | undefined> {
  if (collection.slug !== SUPPORTED_COLLECTION) {
    return undefined;
  }

  const db = getRestClient();
  const row = await db.query.users.findFirst({
    where: eq(users.id, String(options.id)),
  });

  return row ? mapUserDocument(row) : null;
}

async function findTypedUsers(
  collection: RevealCollectionConfig,
  options: RevealFindOptions,
): Promise<RevealPaginatedResult | undefined> {
  if (collection.slug !== SUPPORTED_COLLECTION) {
    return undefined;
  }

  const where = buildUsersWhere(options.where);
  if (where === null) {
    return undefined;
  }

  const orderBy = buildUsersOrderBy(options.sort);
  if (orderBy === null) {
    return undefined;
  }

  const db = getRestClient();
  const limit = options.limit ?? 10;
  const page = options.page ?? 1;
  const offset = (page - 1) * limit;

  const rows = await db.query.users.findMany({
    where,
    orderBy,
    limit,
    offset,
  });
  const [{ value: totalDocs = 0 } = { value: 0 }] = await db
    .select({ value: count() })
    .from(users)
    .where(where);

  const totalPages = totalDocs > 0 ? Math.ceil(totalDocs / limit) : 0;

  return {
    docs: rows.map(mapUserDocument),
    totalDocs,
    limit,
    totalPages,
    page,
    pagingCounter: totalDocs > 0 ? offset + 1 : 0,
    hasPrevPage: page > 1,
    hasNextPage: page < totalPages,
    prevPage: page > 1 ? page - 1 : null,
    nextPage: page < totalPages ? page + 1 : null,
  };
}

async function findTypedTenantByID(
  collection: RevealCollectionConfig,
  options: { id: string | number },
): Promise<RevealDocument | null | undefined> {
  if (collection.slug !== 'tenants') {
    return undefined;
  }

  const db = getRestClient();
  const row = await db.query.tenants.findFirst({
    where: eq(tenants.id, String(options.id)),
  });

  return row ? mapTenantDocument(row) : null;
}

async function findTypedTenants(
  collection: RevealCollectionConfig,
  options: RevealFindOptions,
): Promise<RevealPaginatedResult | undefined> {
  if (collection.slug !== 'tenants') {
    return undefined;
  }

  const where = buildTenantsWhere(options.where);
  if (where === null) {
    return undefined;
  }

  const orderBy = buildTenantsOrderBy(options.sort);
  if (orderBy === null) {
    return undefined;
  }

  const db = getRestClient();
  const limit = options.limit ?? 10;
  const page = options.page ?? 1;
  const offset = (page - 1) * limit;

  const rows = await db.query.tenants.findMany({
    where,
    orderBy,
    limit,
    offset,
  });
  const [{ value: totalDocs = 0 } = { value: 0 }] = await db
    .select({ value: count() })
    .from(tenants)
    .where(where);

  const totalPages = totalDocs > 0 ? Math.ceil(totalDocs / limit) : 0;

  return {
    docs: rows.map(mapTenantDocument),
    totalDocs,
    limit,
    totalPages,
    page,
    pagingCounter: totalDocs > 0 ? offset + 1 : 0,
    hasPrevPage: page > 1,
    hasNextPage: page < totalPages,
    prevPage: page > 1 ? page - 1 : null,
    nextPage: page < totalPages ? page + 1 : null,
  };
}

// ─── Pages (canonical site-scoped model — READ + WRITE bridge) ──────────────

type DbPage = typeof pages.$inferSelect;
type NewPage = typeof pages.$inferInsert;

/**
 * Site every CMS-authored page belongs to until the dashboard grows a site
 * picker. The canonical `pages` table requires a NOT NULL site_id; the
 * dynamic-SQL engine path can never satisfy it — pages writes are ONLY viable
 * through this bridge.
 */
const DEFAULT_PAGE_SITE_ID = 'fleet-marketing';

function pagePathFromSlug(slug: string): string {
  return slug === 'home' ? '/' : `/${slug}`;
}

/**
 * Map a canonical row to the collection document shape. `_status` mirrors the
 * `status` column so the collection's `authenticatedOrPublished` access rule,
 * the drafts UI, and the revalidate hook keep their existing contract.
 */
function mapPageDocument(row: DbPage): RevealDocument {
  return {
    id: row.id,
    title: row.title,
    slug: row.slug,
    path: row.path,
    siteId: row.siteId,
    blocks: Array.isArray(row.blocks) ? (row.blocks as RevealDocument['blocks' & string][]) : [],
    seo: isRecord(row.seo) ? row.seo : undefined,
    status: row.status,
    _status: row.status,
    publishedAt: row.publishedAt,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  } as unknown as RevealDocument;
}

/**
 * Flatten a find `where` into `[field, condition]` entries. The access-merged
 * where arrives as `{ and: [userWhere, accessWhere] }` (see core find.ts), so
 * `and` arrays are flattened recursively. Returns null for any shape this
 * handler cannot faithfully express (`or`, non-equals operators) — the caller
 * then signals not-handled and the engine falls through.
 */
function flattenWhereEntries(
  where: RevealFindOptions['where'],
): Array<[string, unknown]> | null | undefined {
  if (!where) return undefined;
  if (!isRecord(where)) return null;

  const entries: Array<[string, unknown]> = [];
  for (const [key, value] of Object.entries(where)) {
    if (key === 'and') {
      if (!Array.isArray(value)) return null;
      for (const nested of value) {
        const nestedEntries = flattenWhereEntries(nested as RevealFindOptions['where']);
        if (nestedEntries === null) return null;
        if (nestedEntries) entries.push(...nestedEntries);
      }
      continue;
    }
    if (key === 'or') {
      return null;
    }
    entries.push([key, value]);
  }
  return entries;
}

function buildPagesWhere(where: RevealFindOptions['where']) {
  const entries = flattenWhereEntries(where);
  if (entries === null) return null;

  const conditions: (SQL<unknown> | null)[] = [isNull(pages.deletedAt)];
  for (const [field, condition] of entries ?? []) {
    if (!(isRecord(condition) && 'equals' in condition)) {
      return null;
    }
    const value = condition.equals;
    switch (field) {
      case 'id':
        conditions.push(eq(pages.id, String(value)));
        break;
      case 'slug':
        conditions.push(typeof value === 'string' ? eq(pages.slug, value) : null);
        break;
      case 'path':
        conditions.push(typeof value === 'string' ? eq(pages.path, value) : null);
        break;
      case 'siteId':
        conditions.push(typeof value === 'string' ? eq(pages.siteId, value) : null);
        break;
      case 'status':
      case '_status':
        conditions.push(typeof value === 'string' ? eq(pages.status, value) : null);
        break;
      default:
        return null;
    }
  }

  if (conditions.some((entry) => entry === null)) {
    return null;
  }
  const validConditions = conditions.filter(isSqlCondition);
  return validConditions.length === 1 ? validConditions[0] : and(...validConditions);
}

function buildPagesOrderBy(sort: RevealFindOptions['sort']) {
  if (!sort) return [];
  if (!isRecord(sort)) return null;

  const orderBy = Object.entries(sort).map(([field, direction]) => {
    switch (field) {
      case 'title':
        return direction === '-1' ? desc(pages.title) : asc(pages.title);
      case 'slug':
        return direction === '-1' ? desc(pages.slug) : asc(pages.slug);
      case 'path':
        return direction === '-1' ? desc(pages.path) : asc(pages.path);
      case 'publishedAt':
        return direction === '-1' ? desc(pages.publishedAt) : asc(pages.publishedAt);
      case 'createdAt':
        return direction === '-1' ? desc(pages.createdAt) : asc(pages.createdAt);
      case 'updatedAt':
        return direction === '-1' ? desc(pages.updatedAt) : asc(pages.updatedAt);
      default:
        return null;
    }
  });

  return orderBy.some((entry) => entry === null) ? null : orderBy.filter(isSqlCondition);
}

function toDateOrNull(value: unknown): Date | null {
  if (value instanceof Date) return value;
  if (typeof value === 'string' && value.length > 0) {
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }
  return null;
}

function pageStatusFromData(data: RevealDataObject): string | undefined {
  const raw = data._status ?? data.status;
  return typeof raw === 'string' && raw.length > 0 ? raw : undefined;
}

async function findTypedPageByID(
  collection: RevealCollectionConfig,
  options: { id: string | number },
): Promise<RevealDocument | null | undefined> {
  if (collection.slug !== 'pages') {
    return undefined;
  }

  const db = getRestClient();
  const row = await getPageById(db, String(options.id));
  return row ? mapPageDocument(row) : null;
}

async function findTypedPages(
  collection: RevealCollectionConfig,
  options: RevealFindOptions,
): Promise<RevealPaginatedResult | undefined> {
  if (collection.slug !== 'pages') {
    return undefined;
  }

  const where = buildPagesWhere(options.where);
  if (where === null) {
    return undefined;
  }

  const orderBy = buildPagesOrderBy(options.sort);
  if (orderBy === null) {
    return undefined;
  }

  const db = getRestClient();
  const limit = options.limit ?? 10;
  const page = options.page ?? 1;
  const offset = (page - 1) * limit;

  const rows = await db
    .select()
    .from(pages)
    .where(where)
    .orderBy(...(orderBy.length > 0 ? orderBy : [asc(pages.path)]))
    .limit(limit)
    .offset(offset);
  const [{ value: totalDocs = 0 } = { value: 0 }] = await db
    .select({ value: count() })
    .from(pages)
    .where(where);

  const totalPages = totalDocs > 0 ? Math.ceil(totalDocs / limit) : 0;

  return {
    docs: rows.map(mapPageDocument),
    totalDocs,
    limit,
    totalPages,
    page,
    pagingCounter: totalDocs > 0 ? offset + 1 : 0,
    hasPrevPage: page > 1,
    hasNextPage: page < totalPages,
    prevPage: page > 1 ? page - 1 : null,
    nextPage: page < totalPages ? page + 1 : null,
  };
}

async function createTypedPage(
  collection: RevealCollectionConfig,
  options: { data: RevealDataObject; req?: RevealRequest },
): Promise<RevealDocument | undefined> {
  if (collection.slug !== 'pages') {
    return undefined;
  }

  const { data } = options;
  const slug = typeof data.slug === 'string' && data.slug.length > 0 ? data.slug : undefined;
  const title = typeof data.title === 'string' && data.title.length > 0 ? data.title : undefined;
  if (!(slug && title)) {
    // Collection validation runs before this seam; a missing slug/title here
    // is a programming error, not a user error — fail loudly, never row-less.
    throw new Error('pages create requires a non-empty title and slug');
  }

  const blocks = Array.isArray(data.blocks) ? data.blocks : [];
  const values: NewPage = {
    id: typeof data.id === 'string' && data.id.length > 0 ? data.id : `rvl_${crypto.randomUUID()}`,
    siteId:
      typeof data.siteId === 'string' && data.siteId.length > 0
        ? data.siteId
        : DEFAULT_PAGE_SITE_ID,
    title,
    slug,
    path:
      typeof data.path === 'string' && data.path.length > 0 ? data.path : pagePathFromSlug(slug),
    status: pageStatusFromData(data) ?? 'draft',
    blocks,
    blockCount: blocks.length,
    seo: isRecord(data.seo) ? data.seo : null,
    publishedAt: toDateOrNull(data.publishedAt),
  };

  const db = getRestClient();
  const row = await createPage(db, values);
  if (!row) {
    throw new Error('pages create failed: no row returned');
  }
  return mapPageDocument(row);
}

async function updateTypedPage(
  collection: RevealCollectionConfig,
  options: { id: string | number; data: RevealDataObject; req?: RevealRequest },
): Promise<RevealDocument | undefined> {
  if (collection.slug !== 'pages') {
    return undefined;
  }

  const db = getRestClient();
  const id = String(options.id);

  // getPageById filters soft-deleted rows; updatePage alone would resurrect
  // them. Handled-but-not-found throws per the seam contract.
  const existing = await getPageById(db, id);
  if (!existing) {
    throw new Error(`pages update: page not found: ${id}`);
  }

  const { data } = options;
  const patch: Partial<NewPage> = {};

  if (typeof data.title === 'string' && data.title.length > 0) {
    patch.title = data.title;
  }
  if (typeof data.slug === 'string' && data.slug.length > 0) {
    patch.slug = data.slug;
    // Keep path in lockstep with slug unless the caller pins it explicitly.
    patch.path =
      typeof data.path === 'string' && data.path.length > 0
        ? data.path
        : pagePathFromSlug(data.slug);
  } else if (typeof data.path === 'string' && data.path.length > 0) {
    patch.path = data.path;
  }
  if (typeof data.siteId === 'string' && data.siteId.length > 0) {
    patch.siteId = data.siteId;
  }
  if (Array.isArray(data.blocks)) {
    patch.blocks = data.blocks;
    patch.blockCount = data.blocks.length;
  }
  if ('seo' in data) {
    patch.seo = isRecord(data.seo) ? data.seo : null;
  }
  const status = pageStatusFromData(data);
  if (status) {
    patch.status = status;
  }
  if ('publishedAt' in data) {
    patch.publishedAt = toDateOrNull(data.publishedAt);
  }

  const row = await updatePage(db, id, patch);
  if (!row) {
    throw new Error(`pages update: page not found: ${id}`);
  }
  return mapPageDocument(row);
}

async function deleteTypedPage(
  collection: RevealCollectionConfig,
  options: { id: string | number; req?: RevealRequest },
): Promise<RevealDocument | undefined> {
  if (collection.slug !== 'pages') {
    return undefined;
  }

  const db = getRestClient();
  const id = String(options.id);
  const existing = await getPageById(db, id);
  if (!existing) {
    throw new Error(`pages delete: page not found: ${id}`);
  }

  await deletePage(db, id);
  return mapPageDocument(existing);
}

// ─── Posts (blog model — READ + WRITE bridge) ──────────────────────────────

type DbPost = typeof posts.$inferSelect;
type NewPost = typeof posts.$inferInsert;

/**
 * The admin `posts` collection field set (hasMany `authors`, camelCase
 * `publishedAt`/`featuredImageId`, relationship `categories`) does not line up
 * with the snake_case `posts` columns. The engine's dynamic-SQL write path
 * emits the camelCase field names verbatim as column identifiers, so those
 * writes never reach the real columns (the camelCase-column trap). Routing
 * posts through this typed bridge maps every field to its Drizzle column so
 * the edit path persists correctly — the posts twin of the pages bridge.
 */

function normalizeCategoryIds(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  const ids: string[] = [];
  for (const entry of value) {
    if (typeof entry === 'string' && entry.length > 0) {
      ids.push(entry);
    } else if (typeof entry === 'number') {
      ids.push(String(entry));
    } else if (isRecord(entry) && (typeof entry.id === 'string' || typeof entry.id === 'number')) {
      ids.push(String(entry.id));
    }
  }
  return ids;
}

/**
 * The collection models `authors` as hasMany, but the `posts` table stores a
 * single `author_id` FK. Persist the first author; the remainder cannot be
 * held by this table (a pre-existing data-model limitation, not introduced
 * here). `mapPostDocument` reflects the stored author back as a one-element
 * array so `populateAuthors` keeps its contract.
 */
function firstAuthorId(value: unknown): string | null {
  if (!Array.isArray(value) || value.length === 0) return null;
  const [first] = value;
  if (typeof first === 'string' && first.length > 0) return first;
  if (typeof first === 'number') return String(first);
  if (isRecord(first) && (typeof first.id === 'string' || typeof first.id === 'number')) {
    return String(first.id);
  }
  return null;
}

function postStatusFromData(data: RevealDataObject): string | undefined {
  const raw = data._status ?? data.status;
  return typeof raw === 'string' && raw.length > 0 ? raw : undefined;
}

/**
 * Map a canonical `posts` row to the collection document shape. `_status`
 * mirrors the `status` column so `authenticatedOrPublished`, the drafts UI,
 * and `revalidatePost` keep their existing contract; `authors` reflects the
 * single stored FK as a one-element array for `populateAuthors`.
 */
function mapPostDocument(row: DbPost): RevealDocument {
  return {
    id: row.id,
    title: row.title,
    slug: row.slug,
    excerpt: row.excerpt,
    content: row.content,
    featuredImageId: row.featuredImageId,
    authorId: row.authorId,
    authors: row.authorId ? [row.authorId] : [],
    categories: Array.isArray(row.categories) ? row.categories : [],
    meta: isRecord(row.meta) ? row.meta : undefined,
    status: row.status,
    _status: row.status,
    published: row.published,
    publishedAt: row.publishedAt,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  } as unknown as RevealDocument;
}

function buildPostsWhere(where: RevealFindOptions['where']) {
  const entries = flattenWhereEntries(where);
  if (entries === null) return null;

  const conditions: (SQL<unknown> | null)[] = [isNull(posts.deletedAt)];
  for (const [field, condition] of entries ?? []) {
    if (!(isRecord(condition) && 'equals' in condition)) {
      return null;
    }
    const value = condition.equals;
    switch (field) {
      case 'id':
        conditions.push(eq(posts.id, String(value)));
        break;
      case 'slug':
        conditions.push(typeof value === 'string' ? eq(posts.slug, value) : null);
        break;
      case 'authorId':
        conditions.push(typeof value === 'string' ? eq(posts.authorId, value) : null);
        break;
      case 'status':
      case '_status':
        conditions.push(typeof value === 'string' ? eq(posts.status, value) : null);
        break;
      default:
        return null;
    }
  }

  if (conditions.some((entry) => entry === null)) {
    return null;
  }
  const validConditions = conditions.filter(isSqlCondition);
  return validConditions.length === 1 ? validConditions[0] : and(...validConditions);
}

function buildPostsOrderBy(sort: RevealFindOptions['sort']) {
  if (!sort) return [];
  if (!isRecord(sort)) return null;

  const orderBy = Object.entries(sort).map(([field, direction]) => {
    switch (field) {
      case 'title':
        return direction === '-1' ? desc(posts.title) : asc(posts.title);
      case 'slug':
        return direction === '-1' ? desc(posts.slug) : asc(posts.slug);
      case 'publishedAt':
        return direction === '-1' ? desc(posts.publishedAt) : asc(posts.publishedAt);
      case 'createdAt':
        return direction === '-1' ? desc(posts.createdAt) : asc(posts.createdAt);
      case 'updatedAt':
        return direction === '-1' ? desc(posts.updatedAt) : asc(posts.updatedAt);
      default:
        return null;
    }
  });

  return orderBy.some((entry) => entry === null) ? null : orderBy.filter(isSqlCondition);
}

async function findTypedPostByID(
  collection: RevealCollectionConfig,
  options: { id: string | number },
): Promise<RevealDocument | null | undefined> {
  if (collection.slug !== 'posts') {
    return undefined;
  }

  const db = getRestClient();
  const row = await getPostById(db, String(options.id));
  return row ? mapPostDocument(row) : null;
}

async function findTypedPosts(
  collection: RevealCollectionConfig,
  options: RevealFindOptions,
): Promise<RevealPaginatedResult | undefined> {
  if (collection.slug !== 'posts') {
    return undefined;
  }

  const where = buildPostsWhere(options.where);
  if (where === null) {
    return undefined;
  }

  const orderBy = buildPostsOrderBy(options.sort);
  if (orderBy === null) {
    return undefined;
  }

  const db = getRestClient();
  const limit = options.limit ?? 10;
  const page = options.page ?? 1;
  const offset = (page - 1) * limit;

  const rows = await db
    .select()
    .from(posts)
    .where(where)
    .orderBy(...(orderBy.length > 0 ? orderBy : [desc(posts.createdAt)]))
    .limit(limit)
    .offset(offset);
  const [{ value: totalDocs = 0 } = { value: 0 }] = await db
    .select({ value: count() })
    .from(posts)
    .where(where);

  const totalPages = totalDocs > 0 ? Math.ceil(totalDocs / limit) : 0;

  return {
    docs: rows.map(mapPostDocument),
    totalDocs,
    limit,
    totalPages,
    page,
    pagingCounter: totalDocs > 0 ? offset + 1 : 0,
    hasPrevPage: page > 1,
    hasNextPage: page < totalPages,
    prevPage: page > 1 ? page - 1 : null,
    nextPage: page < totalPages ? page + 1 : null,
  };
}

async function createTypedPost(
  collection: RevealCollectionConfig,
  options: { data: RevealDataObject; req?: RevealRequest },
): Promise<RevealDocument | undefined> {
  if (collection.slug !== 'posts') {
    return undefined;
  }

  const { data } = options;
  const slug = typeof data.slug === 'string' && data.slug.length > 0 ? data.slug : undefined;
  const title = typeof data.title === 'string' && data.title.length > 0 ? data.title : undefined;
  if (!(slug && title)) {
    // Collection validation runs before this seam; a missing slug/title here
    // is a programming error, not a user error — fail loudly, never row-less.
    throw new Error('posts create requires a non-empty title and slug');
  }

  const status = postStatusFromData(data) ?? 'draft';
  const values: NewPost = {
    id: typeof data.id === 'string' && data.id.length > 0 ? data.id : `rvl_${crypto.randomUUID()}`,
    title,
    slug,
    excerpt: typeof data.excerpt === 'string' ? data.excerpt : null,
    content: data.content ?? null,
    featuredImageId:
      typeof data.featuredImageId === 'string' && data.featuredImageId.length > 0
        ? data.featuredImageId
        : null,
    authorId: firstAuthorId(data.authors),
    status,
    published: status === 'published',
    meta: isRecord(data.meta) ? data.meta : null,
    categories: normalizeCategoryIds(data.categories),
    publishedAt: toDateOrNull(data.publishedAt),
  };

  const db = getRestClient();
  const row = await createPost(db, values);
  if (!row) {
    throw new Error('posts create failed: no row returned');
  }
  return mapPostDocument(row);
}

async function updateTypedPost(
  collection: RevealCollectionConfig,
  options: { id: string | number; data: RevealDataObject; req?: RevealRequest },
): Promise<RevealDocument | undefined> {
  if (collection.slug !== 'posts') {
    return undefined;
  }

  const db = getRestClient();
  const id = String(options.id);

  // getPostById filters soft-deleted rows; updatePost alone would resurrect
  // them. Handled-but-not-found throws per the seam contract.
  const existing = await getPostById(db, id);
  if (!existing) {
    throw new Error(`posts update: post not found: ${id}`);
  }

  const { data } = options;
  const patch: Partial<NewPost> = {};

  if (typeof data.title === 'string' && data.title.length > 0) {
    patch.title = data.title;
  }
  if (typeof data.slug === 'string' && data.slug.length > 0) {
    patch.slug = data.slug;
  }
  if ('excerpt' in data) {
    patch.excerpt = typeof data.excerpt === 'string' ? data.excerpt : null;
  }
  if ('content' in data) {
    patch.content = data.content ?? null;
  }
  if ('featuredImageId' in data) {
    patch.featuredImageId =
      typeof data.featuredImageId === 'string' && data.featuredImageId.length > 0
        ? data.featuredImageId
        : null;
  }
  if ('authors' in data) {
    patch.authorId = firstAuthorId(data.authors);
  }
  if ('categories' in data) {
    patch.categories = normalizeCategoryIds(data.categories);
  }
  if ('meta' in data) {
    patch.meta = isRecord(data.meta) ? data.meta : null;
  }
  const status = postStatusFromData(data);
  if (status) {
    patch.status = status;
    patch.published = status === 'published';
  }
  if ('publishedAt' in data) {
    patch.publishedAt = toDateOrNull(data.publishedAt);
  }

  const row = await updatePost(db, id, patch);
  if (!row) {
    throw new Error(`posts update: post not found: ${id}`);
  }
  return mapPostDocument(row);
}

async function deleteTypedPost(
  collection: RevealCollectionConfig,
  options: { id: string | number; req?: RevealRequest },
): Promise<RevealDocument | undefined> {
  if (collection.slug !== 'posts') {
    return undefined;
  }

  const db = getRestClient();
  const id = String(options.id);
  const existing = await getPostById(db, id);
  if (!existing) {
    throw new Error(`posts delete: post not found: ${id}`);
  }

  await deletePost(db, id);
  return mapPostDocument(existing);
}

const typedCollectionHandlers: Record<string, TypedCollectionHandler> = {
  pages: {
    findByID: findTypedPageByID,
    find: findTypedPages,
    create: createTypedPage,
    update: updateTypedPage,
    delete: deleteTypedPage,
  },
  posts: {
    findByID: findTypedPostByID,
    find: findTypedPosts,
    create: createTypedPost,
    update: updateTypedPost,
    delete: deleteTypedPost,
  },
  tenants: {
    findByID: findTypedTenantByID,
    find: findTypedTenants,
  },
  users: {
    findByID: findTypedUserByID,
    find: findTypedUsers,
  },
};

export function createTypedCollectionStorage(): LocalCollectionStorageAdapter | undefined {
  if (!hasTypedCollectionDatabase()) {
    return undefined;
  }

  return {
    findByID(
      collection: RevealCollectionConfig,
      options: { id: string | number },
    ): Promise<RevealDocument | null | undefined> {
      const handler = typedCollectionHandlers[collection.slug]?.findByID;
      return handler ? handler(collection, options) : Promise.resolve(undefined);
    },
    find(
      collection: RevealCollectionConfig,
      options: RevealFindOptions,
    ): Promise<RevealPaginatedResult | undefined> {
      const handler = typedCollectionHandlers[collection.slug]?.find;
      return handler ? handler(collection, options) : Promise.resolve(undefined);
    },
    create(
      collection: RevealCollectionConfig,
      options: { data: RevealDataObject; req?: RevealRequest },
    ): Promise<RevealDocument | undefined> {
      const handler = typedCollectionHandlers[collection.slug]?.create;
      return handler ? handler(collection, options) : Promise.resolve(undefined);
    },
    update(
      collection: RevealCollectionConfig,
      options: { id: string | number; data: RevealDataObject; req?: RevealRequest },
    ): Promise<RevealDocument | undefined> {
      const handler = typedCollectionHandlers[collection.slug]?.update;
      return handler ? handler(collection, options) : Promise.resolve(undefined);
    },
    delete(
      collection: RevealCollectionConfig,
      options: { id: string | number; req?: RevealRequest },
    ): Promise<RevealDocument | undefined> {
      const handler = typedCollectionHandlers[collection.slug]?.delete;
      return handler ? handler(collection, options) : Promise.resolve(undefined);
    },
  };
}
