import type {
  RevealCollectionConfig,
  RevealDocument,
  RevealFindOptions,
  RevealPaginatedResult,
} from '@revealui/core/types';
import { getRestClient } from '@revealui/db/client';
import { and, asc, count, desc, eq, or, sql } from '@revealui/db/schema';
import { type Tenant as DbTenant, tenants } from '@revealui/db/schema/tenants';
import { type User as DbUser, users } from '@revealui/db/schema/users';
import type { SQL } from 'drizzle-orm';

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

const typedCollectionHandlers: Record<string, TypedCollectionHandler> = {
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
  };
}
