/**
 * RevealUI Runtime Types
 *
 * Defines runtime interfaces for the RevealUI framework including
 * RevealUI instance, collections, globals, and operations.
 *
 * @module @revealui/core/types/runtime
 */

import type { RevealCollectionConfig, RevealConfig, RevealGlobalConfig } from './config.js';
import type {
  PopulateType,
  RevealDataObject,
  RevealDocument,
  RevealSelect,
  RevealSort,
  RevealWhere,
  SelectType,
} from './query.js';
import type { RevealRequest } from './request.js';

// =============================================================================
// LOGGER
// =============================================================================

/** Logger interface */
export interface RevealUILogger {
  info(message: string): void;
  warn(message: string): void;
  error(message: string): void;
}

// =============================================================================
// OPERATION OPTIONS
// =============================================================================

/** Find operation options */
export interface RevealFindOptions {
  where?: RevealWhere;
  sort?: RevealSort;
  limit?: number;
  page?: number;
  pagination?: boolean;
  select?: RevealSelect;
  depth?: number;
  currentDepth?: number;
  req?: RevealRequest;
  context?: Record<string, unknown>;
  draft?: boolean;
  overrideAccess?: boolean;
  showHiddenFields?: boolean;
  disableErrors?: boolean;
  locale?: string;
  fallbackLocale?: string;
  populate?: PopulateType;
}

export interface RevealCreateOptions {
  data: RevealDataObject;
  req?: RevealRequest;
  overrideAccess?: boolean;
}

export interface RevealUpdateOptions {
  id: string | number;
  data: RevealDataObject;
  req?: RevealRequest;
  overrideAccess?: boolean;
}

export interface RevealDeleteOptions {
  id: string | number;
  req?: RevealRequest;
  overrideAccess?: boolean;
}

// =============================================================================
// BATCH OPERATION OPTIONS
// =============================================================================

export interface BatchCreateOptions {
  data: RevealDataObject[];
  req?: RevealRequest;
}

export interface BatchUpdateOptions {
  updates: Array<{ id: string | number; data: RevealDataObject }>;
  req?: RevealRequest;
  overrideAccess?: boolean;
}

export interface BatchDeleteOptions {
  ids: Array<string | number>;
  req?: RevealRequest;
  overrideAccess?: boolean;
}

/**
 * Result of a batch operation.
 *
 * On success with a DB adapter: transaction is committed, `results` contains all
 * documents, `errors` is empty.
 *
 * On failure with a DB adapter: transaction is rolled back, `results` is empty,
 * `errors` contains a single entry for the failing item (with its index).
 *
 * Without a DB adapter (fallback mode): each item is processed independently,
 * `results` and `errors` may both be non-empty (partial success is possible).
 */
export interface BatchResult<T> {
  results: T[];
  errors: Array<{ index: number; error: string }>;
}

/** Generic options type for operations */
export type OperationOptions<TSelect extends SelectType = SelectType> = {
  collection: string;
  currentDepth?: number;
  depth?: number;
  disableErrors?: boolean;
  draft?: boolean;
  includeLockStatus?: boolean;
  joins?: unknown;
  limit?: number;
  overrideAccess?: boolean;
  page?: number;
  pagination?: boolean;
  populate?: PopulateType;
  req?: RevealRequest;
  select?: TSelect;
  showHiddenFields?: boolean;
  sort?: unknown;
  where?: unknown;
};

// =============================================================================
// PAGINATED RESULTS
// =============================================================================

/** Paginated result interface */
export interface RevealPaginatedResult<T = RevealDocument> {
  docs: T[];
  totalDocs: number;
  limit: number;
  totalPages: number;
  page: number;
  pagingCounter: number;
  hasPrevPage: boolean;
  hasNextPage: boolean;
  prevPage: number | null;
  nextPage: number | null;
}

export type PaginatedDocs<T = RevealDocument> = RevealPaginatedResult<T>;

// =============================================================================
// ADMIN INTERFACE
// =============================================================================

/** RevealUI admin instance interface */
export interface RevealUIInstance {
  db: DatabaseAdapter | null | undefined;
  collections: Record<string, RevealCollection>;
  collectionStorageRegistry: Record<string, CollectionStorageDescriptor>;
  globals: Record<string, RevealGlobal>;
  config: RevealConfig;
  logger: RevealUILogger;
  secret?: string;
  find: (options: RevealFindOptions & { collection: string }) => Promise<RevealPaginatedResult>;
  findByID: (options: {
    collection: string;
    id: string | number;
    depth?: number;
    req?: RevealRequest;
  }) => Promise<RevealDocument | null>;
  create: (options: RevealCreateOptions & { collection: string }) => Promise<RevealDocument>;
  update: (options: RevealUpdateOptions & { collection: string }) => Promise<RevealDocument>;
  delete: (options: RevealDeleteOptions & { collection: string }) => Promise<RevealDocument>;
  login: (options: {
    collection: string;
    data: { email: string; password: string };
    req?: RevealRequest;
  }) => Promise<{ user: RevealDocument; token: string }>;
  findGlobal?: (options: {
    slug: string;
    depth?: number;
    draft?: boolean;
    locale?: string;
    fallbackLocale?: string;
    overrideAccess?: boolean;
    showHiddenFields?: boolean;
    populate?: PopulateType;
    req?: RevealRequest;
  }) => Promise<RevealDocument | null>;
  updateGlobal?: (options: {
    slug: string;
    data: RevealDataObject;
    depth?: number;
    draft?: boolean;
    locale?: string;
    overrideAccess?: boolean;
    req?: RevealRequest;
  }) => Promise<RevealDocument>;
  populate: (
    collection: string,
    docs: RevealDocument | RevealDocument[],
    options?: {
      depth?: number;
      draft?: boolean;
      locale?: string;
      fallbackLocale?: string;
      overrideAccess?: boolean;
      showHiddenFields?: boolean;
      req?: RevealRequest;
    },
  ) => Promise<RevealDocument | RevealDocument[]>;
}

/** Type alias for RevealUI instance */
export type RevealUI = RevealUIInstance;

// =============================================================================
// COLLECTION & GLOBAL RUNTIME
// =============================================================================

/** Collection runtime interface */
export interface RevealCollection {
  config: RevealCollectionConfig;
  storage: CollectionStorageDescriptor | null;
  find: (options: RevealFindOptions) => Promise<RevealPaginatedResult>;
  findByID: (options: { id: string | number; depth?: number }) => Promise<RevealDocument | null>;
  create: (options: RevealCreateOptions) => Promise<RevealDocument>;
  update: (options: RevealUpdateOptions) => Promise<RevealDocument>;
  delete: (options: RevealDeleteOptions) => Promise<RevealDocument>;
}

export interface CollectionStorageDescriptor {
  slug: string;
  tableName: string;
  storageMode: 'dynamic' | 'typed-candidate';
  allowedColumns: string[];
  jsonFieldNames: string[];
}

/** Global runtime interface */
export interface RevealGlobal {
  config: RevealGlobalConfig;
  find: (options?: { depth?: number }) => Promise<RevealDocument | null>;
  update: (options: { data: RevealDataObject }) => Promise<RevealDocument>;
}

// =============================================================================
// DATABASE & STORAGE
// =============================================================================

export interface DatabaseResult {
  rows: RevealDocument[];
  rowCount: number;
}

export interface CollectionStorageAdapter {
  findByID?: (
    collection: RevealCollectionConfig,
    options: { id: string | number },
  ) => Promise<RevealDocument | null | undefined>;
  find?: (
    collection: RevealCollectionConfig,
    options: RevealFindOptions,
  ) => Promise<RevealPaginatedResult | undefined>;
}

export interface QueryableDatabaseAdapter {
  query: (query: string, values?: unknown[]) => Promise<DatabaseResult>;
  /**
   * Execute a callback inside a database transaction with a single connection
   * held across all queries. The callback receives a transactional adapter
   * whose `query` runs on the same connection; committed on success, rolled
   * back on throw.
   *
   * Optional: adapters without real connection affinity (e.g. test mocks) can
   * omit this. Operations that need read-after-write consistency must guard
   * with `if (db.transaction)` and fall back to sequential queries.
   */
  transaction?: <T>(fn: (tx: QueryableDatabaseAdapter) => Promise<T>) => Promise<T>;
  collectionStorage?: CollectionStorageAdapter;
}

export interface DatabaseAdapter {
  query: QueryableDatabaseAdapter['query'];
  transaction?: QueryableDatabaseAdapter['transaction'];
  connect: () => Promise<void>;
  disconnect: () => Promise<void>;
  init?: () => Promise<void>;
  createTable?: (tableName: string, fields: Field[]) => void;
  createGlobalTable?: (globalSlug: string, fields: Field[]) => void;
  collectionStorage?: QueryableDatabaseAdapter['collectionStorage'];
}

import type { Field } from '@revealui/contracts/admin';

export interface StorageAdapter {
  upload: (file: {
    name: string;
    data: Buffer;
    size: number;
    mimetype: string;
  }) => Promise<{ url: string }>;
  delete: (url: string) => Promise<void>;
}

// =============================================================================
// FIND ARGS
// =============================================================================

/** Database operation types */
export type FindArgs = {
  collection: string;
  draftsEnabled?: boolean;
  joins?: unknown;
  limit?: number;
  locale?: string;
  page?: number;
  pagination?: boolean;
  populate?: PopulateType;
  req?: RevealRequest;
  select?: SelectType;
  showHiddenFields?: boolean;
  sort?: unknown;
  where?: unknown;
};
