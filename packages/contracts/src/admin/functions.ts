/**
 * Function Type Contracts (TypeScript)
 *
 * These are TypeScript-only type definitions for function signatures.
 *
 * WHY NOT ZOD?
 * 1. z.function() only validates that something is callable, not its signature
 * 2. Generic type parameters like <T> cannot be expressed in Zod schemas
 * 3. Complex return types (unions, promises, conditional types) don't work
 * 4. Function overloads cannot be represented
 *
 * These types are enforced at COMPILE TIME by TypeScript, not runtime.
 * For runtime validation of function existence, use z.unknown() and
 * TypeScript's type system to ensure correct usage.
 *
 * @module @revealui/contracts/core/contracts/functions
 */

// ============================================
// admin INSTANCE TYPE
// ============================================

/**
 * Minimal RevealUI admin instance interface for hook context.
 *
 * Kept in contracts (not core) to avoid a circular dependency.
 * Describes the subset of RevealUIInstance that hook authors need:
 * find(), create(), and the logger. The full RevealUIInstance type
 * in @revealui/core extends this shape with additional methods.
 */
export interface RevealAdminInstance {
  find(options: {
    collection: string;
    where?: Where;
    limit?: number;
    page?: number;
    depth?: number;
  }): Promise<{ docs: Array<{ id: string | number; [key: string]: unknown }>; totalDocs: number }>;
  create(options: {
    collection: string;
    data: Record<string, unknown>;
    depth?: number;
  }): Promise<{ id: string | number; [key: string]: unknown }>;
  logger?: {
    error(message: string, ...args: unknown[]): void;
    warn?(message: string, ...args: unknown[]): void;
    info?(message: string, ...args: unknown[]): void;
  };
}

// ============================================
// admin REQUEST TYPE
// ============================================

/**
 * Base user shape available on every RevealRequest.
 * Core's RevealUser extends this with additional fields.
 */
export interface BaseRevealUser {
  id: string | number;
  email: string;
  roles?: string[];
  [key: string]: unknown;
}

/**
 * RevealUI Request interface for typing
 */
export interface RevealRequest<TUser extends BaseRevealUser = BaseRevealUser> {
  user?: TUser | null;
  /** The RevealUI admin instance */
  revealui?: RevealAdminInstance;
  locale?: string;
  fallbackLocale?: string;
  context?: Record<string, unknown>;
  transactionID?: string | null;
  i18n?: unknown;
  headers?: Headers | Map<string, string>;
  data?: unknown;
  body?: unknown;
  /** Custom properties for extensibility */
  custom?: Record<string, unknown>;
}

// ============================================
// ACCESS FUNCTION CONTRACTS
// ============================================

/**
 * Access check result type
 * - `true`: Allow access
 * - `false`: Deny access
 * - `Where`: Allow with query constraint (for read operations)
 */
export type AccessResult = boolean | Where;

/**
 * Where query for conditional access
 */
export interface Where {
  [field: string]:
    | { equals?: unknown }
    | { not_equals?: unknown }
    | { in?: unknown[] }
    | { not_in?: unknown[] }
    | { exists?: boolean }
    | { greater_than?: number | string }
    | { greater_than_equal?: number | string }
    | { less_than?: number | string }
    | { less_than_equal?: number | string }
    | { like?: string }
    | { contains?: string }
    | { near?: [number, number, number?, number?] }
    | { within?: unknown }
    | { intersects?: unknown }
    | { and?: Where[] }
    | { or?: Where[] }
    | Where;
}

/**
 * Base access function arguments
 */
export interface AccessArgs<T = unknown> {
  req: RevealRequest;
  id?: string | number;
  data?: Partial<T>;
}

/**
 * Collection-level access function
 *
 * @template T - The document type for this collection
 *
 * @example
 * ```typescript
 * const isAdmin: AccessFunction = ({ req }) => {
 *   return req.user?.roles?.includes('admin') ?? false;
 * };
 *
 * const isOwner: AccessFunction<Post> = ({ req, id }) => {
 *   if (!req.user) return false;
 *   return { author: { equals: req.user.id } };
 * };
 * ```
 */
export type AccessFunction<T = unknown> = (
  args: AccessArgs<T>,
) => AccessResult | Promise<AccessResult>;

/**
 * Collection access configuration
 *
 * @template T - The document type for this collection
 */
export interface CollectionAccessConfig<T = unknown> {
  create?: AccessFunction<T>;
  read?: AccessFunction<T>;
  update?: AccessFunction<T>;
  delete?: AccessFunction<T>;
  admin?: AccessFunction<T>;
  unlock?: AccessFunction<T>;
}

/**
 * Field-level access function arguments
 */
export interface FieldAccessArgs<TDoc = unknown, TSibling = unknown> {
  req: RevealRequest;
  id?: string | number;
  data?: TDoc;
  siblingData?: Partial<TSibling>;
  doc?: TDoc;
}

/**
 * Field-level access function
 * Field access only returns boolean (no Where queries)
 *
 * @template TDoc - The document type
 * @template TSibling - The sibling data type (for nested fields)
 */
export type FieldAccessFunction<TDoc = unknown, TSibling = unknown> = (
  args: FieldAccessArgs<TDoc, TSibling>,
) => boolean | Promise<boolean>;

/**
 * Field access configuration
 */
export interface FieldAccessConfig<TDoc = unknown, TSibling = unknown> {
  create?: FieldAccessFunction<TDoc, TSibling>;
  read?: FieldAccessFunction<TDoc, TSibling>;
  update?: FieldAccessFunction<TDoc, TSibling>;
}

/**
 * Shorthand for simple field access (single function for all operations)
 */
export type FieldAccess<TDoc = unknown, TSibling = unknown> =
  | FieldAccessFunction<TDoc, TSibling>
  | FieldAccessConfig<TDoc, TSibling>;

/**
 * Global access configuration
 */
export interface GlobalAccessConfig {
  read?: (args: { req: RevealRequest }) => boolean | Promise<boolean>;
  update?: (args: { req: RevealRequest; data?: unknown }) => boolean | Promise<boolean>;
}

// ============================================
// HOOK FUNCTION CONTRACTS
// ============================================

/**
 * Before validate hook arguments
 */
export interface BeforeValidateHookArgs<T = unknown> {
  data: Partial<T>;
  req: RevealRequest;
  operation: 'create' | 'update';
  originalDoc?: T;
  context: Record<string, unknown>;
}

/**
 * Before change hook arguments
 */
export interface BeforeChangeHookArgs<T = unknown> {
  data: Partial<T>;
  req: RevealRequest;
  operation: 'create' | 'update';
  originalDoc?: T;
  context: Record<string, unknown>;
}

/**
 * After change hook arguments
 */
export interface AfterChangeHookArgs<T = unknown> {
  doc: T;
  req: RevealRequest;
  operation: 'create' | 'update';
  previousDoc: T;
  context: Record<string, unknown>;
}

/**
 * Before read hook arguments
 */
export interface BeforeReadHookArgs<T = unknown> {
  doc: T;
  req: RevealRequest;
  query: Where;
  context: Record<string, unknown>;
}

/**
 * After read hook arguments
 */
export interface AfterReadHookArgs<T = unknown> {
  doc: T;
  req: RevealRequest;
  query?: Where;
  findMany: boolean;
  context: Record<string, unknown>;
}

/**
 * Before delete hook arguments
 */
export interface BeforeDeleteHookArgs {
  req: RevealRequest;
  id: string | number;
  context: Record<string, unknown>;
}

/**
 * After delete hook arguments
 */
export interface AfterDeleteHookArgs<T = unknown> {
  req: RevealRequest;
  id: string | number;
  doc: T;
  context: Record<string, unknown>;
}

/**
 * Before operation hook arguments
 */
export interface BeforeOperationHookArgs {
  operation: string;
  req: RevealRequest;
  args: unknown;
  context: Record<string, unknown>;
}

/**
 * After operation hook arguments
 */
export interface AfterOperationHookArgs<TResult = unknown> {
  operation: string;
  req: RevealRequest;
  args: unknown;
  result: TResult;
  context: Record<string, unknown>;
}

// ============================================
// COLLECTION HOOK TYPES
// ============================================

/**
 * Collection before validate hook
 *
 * @template T - The document type
 *
 * @example
 * ```typescript
 * const normalizeTitle: CollectionBeforeValidateHook<Post> = ({ data }) => {
 *   if (data.title) {
 *     data.title = data.title.trim();
 *   }
 *   return data;
 * };
 * ```
 */
export type CollectionBeforeValidateHook<T = unknown> = (
  args: BeforeValidateHookArgs<T>,
) => Partial<T> | void | Promise<Partial<T>> | Promise<void>;

/**
 * Collection before change hook
 *
 * @template T - The document type
 */
export type CollectionBeforeChangeHook<T = unknown> = (
  args: BeforeChangeHookArgs<T>,
) => Partial<T> | void | Promise<Partial<T>> | Promise<void>;

/**
 * Collection after change hook
 *
 * @template T - The document type
 *
 * @example
 * ```typescript
 * const revalidatePost: CollectionAfterChangeHook<Post> = async ({ doc, req }) => {
 *   // Revalidate cache after post update
 *   await revalidatePath(`/posts/${doc.slug}`);
 *   return doc;
 * };
 * ```
 */
export type CollectionAfterChangeHook<T = unknown> = (
  args: AfterChangeHookArgs<T>,
) => T | void | Promise<T> | Promise<void>;

/**
 * Collection before read hook
 */
export type CollectionBeforeReadHook<T = unknown> = (
  args: BeforeReadHookArgs<T>,
) => T | void | Promise<T> | Promise<void>;

/**
 * Collection after read hook
 *
 * @template T - The document type
 */
export type CollectionAfterReadHook<T = unknown> = (args: AfterReadHookArgs<T>) => T | Promise<T>;

/**
 * Collection before delete hook
 */
export type CollectionBeforeDeleteHook = (args: BeforeDeleteHookArgs) => void | Promise<void>;

/**
 * Collection after delete hook
 */
export type CollectionAfterDeleteHook<T = unknown> = (
  args: AfterDeleteHookArgs<T>,
) => T | void | Promise<T> | Promise<void>;

/**
 * Collection before operation hook
 */
export type CollectionBeforeOperationHook = (args: BeforeOperationHookArgs) => void | Promise<void>;

/**
 * Collection after operation hook
 */
export type CollectionAfterOperationHook<TResult = unknown> = (
  args: AfterOperationHookArgs<TResult>,
) => TResult | Promise<TResult>;

/**
 * Complete collection hooks configuration
 *
 * @template T - The document type
 */
export interface CollectionHooksConfig<T = unknown> {
  beforeOperation?: CollectionBeforeOperationHook[];
  beforeValidate?: CollectionBeforeValidateHook<T>[];
  beforeChange?: CollectionBeforeChangeHook<T>[];
  afterChange?: CollectionAfterChangeHook<T>[];
  beforeRead?: CollectionBeforeReadHook<T>[];
  afterRead?: CollectionAfterReadHook<T>[];
  beforeDelete?: CollectionBeforeDeleteHook[];
  afterDelete?: CollectionAfterDeleteHook<T>[];
  afterOperation?: CollectionAfterOperationHook[];
}

// ============================================
// FIELD HOOK TYPES
// ============================================

/**
 * Field before change hook arguments
 */
export interface FieldBeforeChangeHookArgs<TValue = unknown, TDoc = unknown, TSibling = unknown> {
  value: TValue;
  previousValue?: TValue;
  data: TDoc;
  siblingData: Partial<TSibling>;
  req: RevealRequest;
  operation: 'create' | 'update';
  originalDoc?: TDoc;
  context: Record<string, unknown>;
  field: unknown; // Field config
}

/**
 * Field after read hook arguments
 */
export interface FieldAfterReadHookArgs<TValue = unknown, TDoc = unknown, TSibling = unknown> {
  value: TValue;
  data: TDoc;
  siblingData: TSibling;
  req: RevealRequest;
  context: Record<string, unknown>;
  field: unknown;
}

/**
 * Field before change hook
 */
export type FieldBeforeChangeHook<TValue = unknown, TDoc = unknown, TSibling = unknown> = (
  args: FieldBeforeChangeHookArgs<TValue, TDoc, TSibling>,
) => TValue | Promise<TValue>;

/**
 * Field after read hook
 */
export type FieldAfterReadHook<TValue = unknown, TDoc = unknown, TSibling = unknown> = (
  args: FieldAfterReadHookArgs<TValue, TDoc, TSibling>,
) => TValue | Promise<TValue>;

/**
 * Field hooks configuration
 */
export interface FieldHooksConfig<TValue = unknown, TDoc = unknown, TSibling = unknown> {
  beforeValidate?: FieldBeforeChangeHook<TValue, TDoc, TSibling>[];
  beforeChange?: FieldBeforeChangeHook<TValue, TDoc, TSibling>[];
  afterChange?: FieldBeforeChangeHook<TValue, TDoc, TSibling>[];
  afterRead?: FieldAfterReadHook<TValue, TDoc, TSibling>[];
}

// ============================================
// GLOBAL HOOK TYPES
// ============================================

/**
 * Global before read hook
 */
export type GlobalBeforeReadHook<T = unknown> = (args: {
  doc: T;
  req: RevealRequest;
  context: Record<string, unknown>;
}) => T | void | Promise<T> | Promise<void>;

/**
 * Global after read hook
 */
export type GlobalAfterReadHook<T = unknown> = (args: {
  doc: T;
  req: RevealRequest;
  context: Record<string, unknown>;
}) => T | Promise<T>;

/**
 * Global before change hook
 */
export type GlobalBeforeChangeHook<T = unknown> = (args: {
  data: Partial<T>;
  req: RevealRequest;
  originalDoc?: T;
  context: Record<string, unknown>;
}) => Partial<T> | void | Promise<Partial<T>> | Promise<void>;

/**
 * Global after change hook
 */
export type GlobalAfterChangeHook<T = unknown> = (args: {
  doc: T;
  req: RevealRequest;
  previousDoc?: T;
  context: Record<string, unknown>;
}) => T | void | Promise<T> | Promise<void>;

/**
 * Global hooks configuration
 */
export interface GlobalHooksConfig<T = unknown> {
  beforeRead?: GlobalBeforeReadHook<T>[];
  afterRead?: GlobalAfterReadHook<T>[];
  beforeChange?: GlobalBeforeChangeHook<T>[];
  afterChange?: GlobalAfterChangeHook<T>[];
}

// ============================================
// VALIDATION FUNCTION CONTRACT
// ============================================

/**
 * Field validation function arguments
 */
export interface FieldValidateArgs<TValue = unknown, TDoc = unknown, TSibling = unknown> {
  value: TValue;
  data: Partial<TDoc>;
  siblingData: Partial<TSibling>;
  req: RevealRequest;
  operation: 'create' | 'update';
}

/**
 * Field validation function
 *
 * @returns `true` if valid, error message string if invalid
 *
 * @example
 * ```typescript
 * const validateSlug: FieldValidateFunction<string> = ({ value }) => {
 *   if (!value) return 'Slug is required';
 *   if (!/^[a-z0-9-]+$/.test(value)) return 'Slug must be lowercase alphanumeric with hyphens';
 *   return true;
 * };
 * ```
 */
export type FieldValidateFunction<TValue = unknown, TDoc = unknown, TSibling = unknown> = (
  args: FieldValidateArgs<TValue, TDoc, TSibling>,
) => string | true | Promise<string | true>;

// ============================================
// ENDPOINT FUNCTION CONTRACT
// ============================================

/**
 * Custom endpoint handler
 */
export type EndpointHandler = (req: RevealRequest) => Response | Promise<Response>;

/**
 * Endpoint configuration
 */
export interface EndpointConfig {
  path: string;
  method: 'get' | 'post' | 'put' | 'patch' | 'delete' | 'connect' | 'options' | 'head';
  handler: EndpointHandler;
  root?: boolean;
  custom?: Record<string, unknown>;
}

// ============================================
// CONDITION FUNCTION CONTRACT
// ============================================

/**
 * Field condition function (for conditional display)
 */
export type ConditionFunction<TDoc = unknown, TSibling = unknown> = (
  data: TDoc,
  siblingData: TSibling,
  args: { user?: unknown },
) => boolean;

// ============================================
// FILTER OPTIONS FUNCTION CONTRACT
// ============================================

/**
 * Filter options function (for relationship fields)
 */
export type FilterOptionsFunction<T = unknown> = (args: {
  relationTo: string;
  data: Partial<T>;
  siblingData: Partial<unknown>;
  id?: string | number;
  user?: unknown;
}) => Where | boolean | null;
