// RevealUI CMS Framework - Independent Type System
import type * as React from 'react';

// User type alias for consistency
export type User = RevealUIUser;

// ============================================================================
// CORE DATA ABSTRACTIONS
// ============================================================================

// RevealUI's operator system - independent design
export const RevealOperators = [
  'equals',
  'contains',
  'not_equals',
  'in',
  'not_in',
  'exists',
  'greater_than',
  'less_than',
  'like',
  'near'
] as const;

export type RevealOperator = typeof RevealOperators[number];

// RevealUI's value system - not tied to JSON
export type RevealValue =
  | string
  | number
  | boolean
  | null
  | Date
  | RevealValue[]
  | { [key: string]: RevealValue }

export type RevealDataObject = { [key: string]: RevealValue }

// RevealUI's query system
export type RevealWhereField = {
  [key in RevealOperator]?: RevealValue
}

export type RevealWhere =
  | { [key: string]: RevealWhereField }
  | { and: RevealWhere[] }
  | { or: RevealWhere[] }
  | { and: RevealWhere[]; or: RevealWhere[] }

export type RevealSort = string | string[]

export type RevealSelect = string[] | { [key: string]: boolean | RevealSelect }

// RevealUI's document model - completely independent
export interface RevealDocument {
  id: string | number
  [key: string]: RevealValue | undefined
}

export interface RevealDocumentWithMeta extends RevealDocument {
  createdAt?: string
  updatedAt?: string
  _status?: 'draft' | 'published'
}

// ============================================================================
// HOOK SYSTEM - RevealUI's Own Abstractions
// ============================================================================

// RevealUI's hook context - not copied from Payload
export interface RevealHookContext {
  payload: RevealPayload
  collection?: string
  global?: string
  operation: 'create' | 'read' | 'update' | 'delete'
  previousDoc?: RevealDocument
  req?: RevealRequest
}

// RevealUI's hook functions - proper abstractions
export type RevealAfterChangeHook = (args: {
  doc: RevealDocument
  context: RevealHookContext
}) => Promise<RevealDocument> | RevealDocument

export type RevealBeforeChangeHook = (args: {
  data: RevealDataObject
  context: RevealHookContext
}) => Promise<RevealDataObject> | RevealDataObject

export type RevealAfterReadHook = (args: {
  doc: RevealDocument
  context: RevealHookContext
}) => Promise<RevealDocument> | RevealDocument

// RevealUI's collection hooks
export interface RevealCollectionHooks {
  beforeChange?: RevealBeforeChangeHook[]
  afterChange?: RevealAfterChangeHook[]
  beforeRead?: ((context: RevealHookContext) => Promise<void> | void)[]
  afterRead?: RevealAfterReadHook[]
  beforeDelete?: ((context: RevealHookContext) => Promise<void> | void)[]
  afterDelete?: ((args: { doc: RevealDocument; context: RevealHookContext }) => Promise<void> | void)[]
}

// ============================================================================
// CONFIGURATION SYSTEM - RevealUI's Own Design
// ============================================================================

// RevealUI's field system
export interface RevealField {
  name: string
  type: string
  label?: string
  required?: boolean
  unique?: boolean
  defaultValue?: RevealValue
  validate?: (value: RevealValue, options?: any) => boolean | string | Promise<boolean | string>
  admin?: {
    position?: 'sidebar'
    readOnly?: boolean
    hidden?: boolean
    condition?: (data: RevealDataObject) => boolean
  }
  hooks?: {
    beforeChange?: RevealBeforeChangeHook[]
    afterChange?: RevealAfterChangeHook[]
  }
  // Relationship-specific fields
  relationTo?: string | string[]
  hasMany?: boolean
  filterOptions?: any
}

// RevealUI's collection config
export interface RevealCollectionConfig {
  slug: string
  fields: RevealField[]
  hooks?: RevealCollectionHooks
  admin?: {
    useAsTitle?: string
    defaultColumns?: string[]
    group?: string
    preview?: (doc: RevealDocument) => string
  }
  access?: {
    read?: Access
    create?: Access
    update?: Access
    delete?: Access
  }
}

// RevealUI's global config
export interface RevealGlobalConfig {
  slug: string
  fields: RevealField[]
  hooks?: Omit<RevealCollectionHooks, 'beforeDelete' | 'afterDelete'>
  access?: {
    read?: Access
    update?: Access
  }
}

// RevealUI's main config
export interface RevealConfig {
  collections?: RevealCollectionConfig[]
  globals?: RevealGlobalConfig[]
  serverURL?: string
  secret?: string
  db?: {
    query: (query: string, values?: unknown[]) => Promise<DatabaseResult>
    init?: () => Promise<void>
    connect?: () => Promise<void>
  } | null
  admin?: {
    user?: string
    components?: {
      beforeNavLinks?: string[]
      beforeDashboard?: string[]
      beforeLogin?: string[]
      graphics?: {
        Icon?: string
        Logo?: string
      }
    }
    meta?: {
      titleSuffix?: string
      icons?: Array<{
        url: string
        rel?: string
        sizes?: string
        type?: string
      }>
    }
    importMap?: {
      autoGenerate?: boolean
      baseDir?: string
    }
    livePreview?: {
      url?: (params: { data: any; locale?: string }) => string
    }
  }
  onInit?: (payload: RevealPayload) => Promise<void> | void
}

// ============================================================================
// RUNTIME SYSTEM - RevealUI's Own Abstractions
// ============================================================================

// RevealUI's request abstraction
export interface RevealRequest {
  user?: RevealUser
  locale?: string
  fallbackLocale?: string
  context?: Record<string, unknown>
  payload?: RevealPayload
  transactionID?: string | number | null
  /** Optimized document loader */
  payloadDataLoader?: {
    /**
     * Wraps `payload.find` with a cache to deduplicate requests
     */
    find: RevealPayload['find']
  } & any // DataLoader type
}

// RevealUI's user model
export interface RevealUser {
  id: string | number
  email: string
  roles?: string[]
  [key: string]: RevealValue | undefined
}

export interface RevealUILogger {
  info(message: string): void
  warn(message: string): void
  error(message: string): void
}

// RevealUI's operation options
export interface RevealFindOptions {
  where?: RevealWhere
  sort?: RevealSort
  limit?: number
  page?: number
  select?: RevealSelect
  depth?: number
  req?: RevealRequest
}

export interface RevealCreateOptions {
  data: RevealDataObject
  req?: RevealRequest
}

export interface RevealUpdateOptions {
  id: string | number
  data: RevealDataObject
  req?: RevealRequest
}

export interface RevealDeleteOptions {
  id: string | number
  req?: RevealRequest
}

// RevealUI's result types
export interface RevealPaginatedResult<T = RevealDocument> {
  docs: T[]
  totalDocs: number
  limit: number
  totalPages: number
  page: number
  pagingCounter: number
  hasPrevPage: boolean
  hasNextPage: boolean
  prevPage: number | null
  nextPage: number | null
}

// RevealUI's payload interface
export interface RevealPayload {
  collections: Record<string, RevealCollection>
  globals: Record<string, RevealGlobal>
  config: RevealConfig
  logger: RevealUILogger

  find: (options: RevealFindOptions & { collection: string }) => Promise<RevealPaginatedResult>
  findByID: (options: { collection: string; id: string | number; depth?: number; req?: RevealRequest }) => Promise<RevealDocument | null>
  create: (options: RevealCreateOptions & { collection: string }) => Promise<RevealDocument>
  update: (options: RevealUpdateOptions & { collection: string }) => Promise<RevealDocument>
  delete: (options: RevealDeleteOptions & { collection: string }) => Promise<RevealDocument>
  login: (options: { collection: string; data: { email: string; password: string }; req?: RevealRequest }) => Promise<RevealDocument>
}

// RevealUI's collection interface
export interface RevealCollection {
  config: RevealCollectionConfig
  find: (options: RevealFindOptions) => Promise<RevealPaginatedResult>
  findByID: (options: { id: string | number; depth?: number }) => Promise<RevealDocument | null>
  create: (options: RevealCreateOptions) => Promise<RevealDocument>
  update: (options: RevealUpdateOptions) => Promise<RevealDocument>
  delete: (options: RevealDeleteOptions) => Promise<RevealDocument>
}

// RevealUI's global interface
export interface RevealGlobal {
  config: RevealGlobalConfig
  find: (options?: { depth?: number }) => Promise<RevealDocument | null>
  update: (options: { data: RevealDataObject }) => Promise<RevealDocument>
}

// ============================================================================
// PAYLOAD-CMS COMPATIBILITY TYPES (For Relationship Population)
// ============================================================================

// Generic document type with ID
export type TypeWithID = RevealDocument

// Request context type
export interface RequestContext {
  [key: string]: unknown
}

// Sanitized collection config (extends RevealCollectionConfig with additional metadata)
export interface SanitizedCollectionConfig extends RevealCollectionConfig {
  /** Flattened fields for traversal */
  flattenedFields?: RevealField[]
  /** Force select certain fields */
  forceSelect?: string[]
  /** Custom ID type for the collection */
  customIDType?: 'text' | 'number'
  /** Trash configuration */
  trash?: boolean
  /** Versions configuration */
  versions?: {
    drafts?: boolean
  }
  /** Default populate fields */
  defaultPopulate?: string[]
}

// Sanitized global config (extends RevealGlobalConfig with additional metadata)
export interface SanitizedGlobalConfig extends RevealGlobalConfig {
  /** Flattened fields for traversal */
  flattenedFields?: RevealField[]
}

// Typed fallback locale (simplified for RevealUI)
export type TypedFallbackLocale = string

// Payload-compatible types for relationship system
export type PayloadRequest = RevealRequest
export type PopulateType = Record<string, string[] | boolean> | boolean
export type SelectType = Record<string, boolean | SelectType> | string[]
export type JsonObject = Record<string, unknown>

// Database operation types
export type FindArgs = {
  collection: string
  draftsEnabled?: boolean
  joins?: any
  limit?: number
  locale?: string
  page?: number
  pagination?: boolean
  populate?: PopulateType
  req?: PayloadRequest
  select?: SelectType
  where?: any
}

// Generic options type for operations
export type OperationOptions<TSelect extends SelectType = SelectType> = {
  collection: string
  currentDepth?: number
  depth?: number
  disableErrors?: boolean
  draft?: boolean
  includeLockStatus?: boolean
  joins?: any
  limit?: number
  overrideAccess?: boolean
  page?: number
  pagination?: boolean
  populate?: PopulateType
  req?: PayloadRequest
  select?: TSelect
  showHiddenFields?: boolean
  sort?: any
  where?: any
}

// ============================================================================
// LEGACY COMPATIBILITY - For Migration
// ============================================================================
// Note: Legacy aliases moved to index.ts for cleaner separation
export type CollectionHooks = RevealCollectionHooks
export type GlobalHooks = Omit<RevealCollectionHooks, 'beforeDelete' | 'afterDelete'>

// Field and validation types (simplified for now)
export type Field = RevealField

// Relationship analysis types
export interface RelationshipMetadata {
  fieldName: string
  storageType: 'direct_fk' | 'junction_table' | 'polymorphic'
  relationTo: string | string[]
  hasMany: boolean
  localized: boolean
  tableName: string // for junction tables: ${parentTable}_rels
  fkColumnName: string // for direct FKs: ${fieldName}_id
  path: string // field path for junction table queries
}
export type TextField = RevealField & { type: 'text' }
export type CheckboxField = RevealField & { type: 'checkbox' }
export type ArrayField = RevealField & { type: 'array' }
export type BlocksField = RevealField & { type: 'blocks'; blocks: Block[] }
export type Block = { name: string; fields: Field[] }

// ============================================================================
// COMPONENT SYSTEM - RevealUI's Own Design
// ============================================================================

export type CustomComponent<T = Record<string, unknown>> = (props: T) => React.ReactElement | null

export type FieldDescriptionClientComponent = CustomComponent
export type FieldDescriptionServerComponent = CustomComponent
export type PayloadComponent<T = Record<string, unknown>> = CustomComponent<T>

// ============================================================================
// UTILITY TYPES
// ============================================================================

export type LabelFunction = (args: { t: (key: string) => string }) => string
export type TextFieldClientProps = { value?: string; onChange?: (value: string) => void }
export type TextFieldSingleValidation = (value: string) => boolean | string | Promise<boolean | string>

// ============================================================================
// ACCESS CONTROL - RevealUI's Own System
// ============================================================================

export interface AccessArgs {
  req?: RevealRequest
  id?: string | number
  data?: RevealDataObject
}

export type AccessResult = boolean | Promise<boolean>

export type Access = (args: AccessArgs) => AccessResult

export interface Permission {
  create?: AccessResult
  read?: AccessResult
  update?: AccessResult
  delete?: AccessResult
}

// ============================================================================
// DATABASE & STORAGE - RevealUI's Abstractions
// ============================================================================

export interface DatabaseResult {
  rows: RevealDocument[]
  rowCount: number
}

export interface DatabaseAdapter {
  query: (query: string, values?: unknown[]) => Promise<DatabaseResult>
  connect: () => Promise<void>
  disconnect: () => Promise<void>
}

export interface StorageAdapter {
  upload: (file: { name: string; data: Buffer; size: number; mimetype: string }) => Promise<{ url: string }>
  delete: (url: string) => Promise<void>
}

// ============================================================================
// RICH TEXT - RevealUI's Own System
// ============================================================================

export interface RichTextFeature {
  name: string
  key: string
  type: 'mark' | 'inline' | 'block'
  tag?: string
  options?: Record<string, unknown>
}

export interface RichTextEditor {
  features: RichTextFeature[]
}

// ============================================================================
// PLUGINS - RevealUI's Extension System
// ============================================================================

export type Plugin = (config: RevealConfig) => RevealConfig

export interface PluginOptions {
  [key: string]: unknown
}

// ============================================================================
// PAGINATION & RESULTS
// ============================================================================

export interface PaginatedDocs<T = RevealDocument> extends RevealPaginatedResult<T> {}

// ============================================================================
// API & REST - RevealUI's Own Design
// ============================================================================

export interface RESTOptions {
  where?: RevealWhere
  sort?: RevealSort
  limit?: number
  page?: number
  select?: RevealSelect
  depth?: number
  locale?: string
}

export interface APIResponse<T = RevealDocument> {
  message?: string
  doc?: T
  docs?: T[]
  errors?: { field: string; message: string }[]
  totalDocs?: number
  limit?: number
  totalPages?: number
  page?: number
}

export type REST_DELETE = () => Promise<Response>
export type REST_GET = () => Promise<Response>
export type REST_OPTIONS = () => Promise<Response>
export type REST_PATCH = () => Promise<Response>
export type REST_POST = () => Promise<Response>

// ============================================================================
// REVEALUI FRAMEWORK TYPES
// ============================================================================

export interface RevealUITenant {
  id: string;
  name: string;
  domain: string;
  settings: Record<string, unknown>;
}

export interface RevealUIContext {
  tenant: RevealUITenant;
  user: User;
  permissions: string[];
  auditLog: boolean;
}

export type RevealUIAccessResult = boolean | ((args: { req: RevealRequest; user: User; tenant: RevealUITenant }) => boolean);

export interface RevealUICollectionConfig extends Omit<CollectionConfig, 'access'> {
  revealUI?: {
    tenantScoped?: boolean;
    auditLog?: boolean;
    permissions?: string[];
  };
  access?: {
  create?: Access;
  read?: Access;
  update?: Access;
  delete?: Access;
    revealUI?: {
      tenantRead?: RevealUIAccessResult;
      tenantWrite?: RevealUIAccessResult;
      superAdminOnly?: boolean;
    };
  };
}

export interface RevealUIField extends Field {
  revealUI?: {
    searchable?: boolean;
    auditable?: boolean;
    tenantScoped?: boolean;
    permissions?: string[];
  };
}

// ============================================================================
// UTILITIES
// ============================================================================
// Type utilities moved to index.ts

// ============================================================================
// RevealUI Framework Abstractions
// ============================================================================

export interface RevealUIFrameworkContext {
  tenant?: {
    id: string;
    name: string;
    domain: string;
  };
  user?: RevealUIUser;
  permissions: RevealUIPermission[];
  theme?: string;
}

export interface RevealUIAccessContext {
  tenant?: RevealUIFrameworkContext['tenant'];
  user?: RevealUIUser;
  operation: 'create' | 'read' | 'update' | 'delete' | 'publish';
  data?: Record<string, unknown>;
}

export type RevealUIFilterResult = boolean | RevealWhere;

export type RevealUIPermission = 'create' | 'read' | 'update' | 'delete' | 'publish' | 'admin';

export interface RevealUIAccessRule {
  tenant?: string;
  user?: string;
  permissions?: RevealUIPermission[];
  condition?: (context: RevealUIAccessContext) => RevealUIAccessResult;
}

// Enhanced Field Types with RevealUI features
export interface RevealUIEnhancedField {
  name: string;
  type: RevealUIFieldType;
  label?: string;
  required?: boolean;
  revealUI?: {
    searchable?: boolean;
    permissions?: RevealUIPermission[];
    tenantScoped?: boolean;
    auditLog?: boolean;
    validation?: RevealUIValidationRule[];
  };
  admin?: {
    description?: string;
    position?: string;
    readOnly?: boolean;
    hidden?: boolean;
    condition?: (data: Record<string, unknown>, siblingData: Record<string, unknown>, context: RevealUIContext) => boolean;
  };
  validate?: RevealUIFieldValidator;
}

export type RevealUIFieldType = 'text' | 'textarea' | 'number' | 'email' | 'password' | 'checkbox' | 'select' | 'radio' | 'array' | 'group' | 'richText' | 'upload' | 'relationship' | 'date' | 'point' | 'polygon';

export interface RevealUITextField extends RevealUIEnhancedField {
  type: 'text';
  maxLength?: number;
  minLength?: number;
}

export interface RevealUICheckboxField extends RevealUIEnhancedField {
  type: 'checkbox';
  defaultValue?: boolean;
}

export interface RevealUIArrayField extends RevealUIEnhancedField {
  type: 'array';
  fields: RevealUIField[];
  minRows?: number;
  maxRows?: number;
}

export interface RevealUIRichTextField extends RevealUIEnhancedField {
  type: 'richText';
  editor?: RevealUIRichTextEditor;
}

export type RevealUIFieldValidator = (value: unknown, context: RevealUIValidationContext) => string | true;

export interface RevealUIValidationContext {
  data: Record<string, unknown>;
  siblingData: Record<string, unknown>;
  user: RevealUIUser;
  tenant?: RevealUIContext['tenant'];
  operation: 'create' | 'update';
}

export interface RevealUIValidationRule {
  type: 'required' | 'minLength' | 'maxLength' | 'pattern' | 'custom';
  value?: unknown;
  message?: string;
  condition?: (context: RevealUIValidationContext) => boolean;
}

// Block Abstractions
export interface RevealUIBlock {
  slug: string;
  fields: RevealUIField[];
  revealUI?: {
    category?: string;
    icon?: string;
    preview?: RevealUIBlockPreview;
    permissions?: RevealUIPermission[];
    tenantScoped?: boolean;
  };
  labels?: {
    singular?: string;
    plural?: string;
  };
}

export interface RevealUIBlockPreview {
  imageURL?: string;
  imageAltText?: string;
  description?: string;
}

// Component Abstractions
export interface RevealUIComponentProps<T = any> {
  revealUI?: RevealUIContext;
  children?: React.ReactNode;
  className?: string;
}

export type RevealUIComponentType<T = any> = React.ComponentType<T & RevealUIComponentProps>;

export interface RevealUIFieldComponentProps {
  field: RevealUIField;
  value: unknown;
  onChange: (value: unknown) => void;
  error?: string;
  revealUI?: RevealUIContext;
}

export type RevealUIFieldComponent = React.ComponentType<RevealUIFieldComponentProps>;

export interface RevealUIBlockComponentProps {
  block: RevealUIBlock;
  data: Record<string, unknown>;
  onChange: (data: Record<string, unknown>) => void;
  revealUI?: RevealUIContext;
}

export type RevealUIBlockComponent = React.ComponentType<RevealUIBlockComponentProps>;

// Rich Text Abstractions
export interface RevealUIRichTextEditor {
  features?: RevealUIRichTextFeature[];
  placeholder?: string;
}

export interface RevealUIRichTextFeature {
  name: string;
  component: RevealUIComponent;
  props?: Record<string, unknown>;
}

// Hook Abstractions
export interface RevealUIHookContext {
  tenant?: RevealUIContext['tenant'];
  user?: RevealUIUser;
  operation: 'create' | 'update' | 'delete';
  data: Record<string, unknown>;
  previousData?: Record<string, unknown>;
}

export type RevealUIFieldHook<T = any> = (args: {
  value: T;
  context: RevealUIHookContext;
}) => T | Promise<T>;

export type RevealUIGlobalHook = (args: {
  doc: RevealUIDocument;
  context: RevealUIHookContext;
}) => void | Promise<void>;

// Document and User Abstractions
export interface RevealUIDocument {
  id: string;
  createdAt: string;
  updatedAt: string;
  _status?: 'draft' | 'published';
  revealUI?: {
    tenantId?: string;
    createdBy?: string;
    updatedBy?: string;
    version?: number;
    auditLog?: RevealUIAuditEntry[];
  };
}

export interface RevealUIAuditEntry {
  timestamp: string;
  userId: string;
  action: 'create' | 'update' | 'delete' | 'publish';
  changes: Record<string, { from: unknown; to: unknown }>;
}

export interface RevealUIUser {
  id: string;
  email: string;
  roles: string[];
  tenants?: string[];
  revealUI?: {
    preferences?: Record<string, unknown>;
    lastLogin?: string;
    isSuperAdmin?: boolean;
  };
}

// Configuration Abstractions
export interface RevealUIConfig {
  collections: RevealUICollection[];
  globals?: RevealUIGlobal[];
  revealUI?: {
    multiTenant?: boolean;
    auditLog?: boolean;
    permissions?: RevealUIPermission[];
    theme?: string;
  };
}

export interface RevealUICollection {
  slug: string;
  fields: RevealUIField[];
  revealUI?: {
    tenantScoped?: boolean;
    auditLog?: boolean;
    permissions?: RevealUIPermission[];
    hooks?: {
      beforeChange?: RevealUIFieldHook[];
      afterChange?: RevealUIFieldHook[];
    };
  };
  access?: {
    read?: RevealUIAccessRule;
    create?: RevealUIAccessRule;
    update?: RevealUIAccessRule;
    delete?: RevealUIAccessRule;
  };
}

export interface RevealUIGlobal {
  slug: string;
  fields: RevealUIField[];
  revealUI?: {
    tenantScoped?: boolean;
    permissions?: RevealUIPermission[];
  };
}

// ============================================================================
// CORE CONFIGURATION TYPES (Vertical Slice 1)
// ============================================================================

// Base configuration interface
export interface Config {
  collections?: CollectionConfig[]
  globals?: GlobalConfig[]
  serverURL?: string
  secret?: string
  admin?: AdminConfig
  db?: DatabaseConfig
  upload?: UploadConfig
  typescript?: TypeScriptConfig
  cors?: string[]
  csrf?: string[]
  telemetry?: boolean
  debug?: boolean
  defaultDepth?: number
  maxDepth?: number
  onInit?: (payload: RevealPayload) => Promise<void> | void
}

// Sanitized configuration (processed/cleaned)
export type SanitizedConfig = Config & {
  collections: CollectionConfig[]
  globals: GlobalConfig[]
  i18n?: {
    translations?: Record<string, unknown>
  }
  editor?: Record<string, unknown>
}

// Collection configuration
export interface CollectionConfig {
  slug: string
  fields: Field[]
  access?: Access
  admin?: AdminConfig
  hooks?: CollectionHooks
  endpoints?: Endpoint[]
  versions?: VersionConfig
  timestamps?: boolean | TimestampConfig
  auth?: AuthConfig
  upload?: boolean | UploadConfig
  labels?: LabelConfig
}

// Global configuration
export interface GlobalConfig {
  slug: string
  fields: Field[]
  access?: Access
  admin?: AdminConfig
  hooks?: GlobalHooks
  versions?: VersionConfig
  label?: string
}

// Client user type for client-side configuration
export interface ClientUser {
  id: string | number
  email: string
  roles?: string[]
}

// Client-side configuration
export interface ClientConfig {
  collections: ClientCollectionConfig[]
  globals: ClientGlobalConfig[]
  routes: {
    admin: string
    api: string
  }
  user: ClientUser
  typescript: TypeScriptConfig
}

// Client field type (simplified for client-side use)
export type ClientField = Field

// Client collection configuration
export interface ClientCollectionConfig {
  slug: string
  fields: ClientField[]
  labels: LabelConfig
  admin: AdminConfig
  auth?: AuthConfig
  upload?: UploadConfig
  timestamps?: boolean
  versions?: VersionConfig
}

// Client global configuration
export interface ClientGlobalConfig {
  slug: string
  fields: ClientField[]
  label?: string
}

// Admin configuration
export interface AdminConfig {
  useAsTitle?: string
  defaultColumns?: string[]
  group?: string
  description?: string
  listSearchableFields?: string[]
  pagination?: {
    defaultLimit?: number
    limits?: number[]
  }
  components?: {
    views?: Record<string, any>
  }
  livePreview?: {
    url?: string
    breakpoints?: Array<{
      label: string
      name: string
      width: number
      height: number
    }>
  }
  meta?: {
    title?: string
    titleSuffix?: string
    ogImage?: string
    description?: string
  }
  dateFormat?: string
}

// Database configuration
export interface DatabaseConfig {
  init: () => Promise<void>
  connect: () => Promise<void>
  close: () => Promise<void>
  query: (query: string, values?: unknown[]) => Promise<DatabaseResult>
  migrate?: () => Promise<void>
}

// Upload configuration
export interface UploadConfig {
  staticURL?: string
  staticDir?: string
  mimeTypes?: string[]
  imageSizes?: Array<{
    name: string
    width?: number
    height?: number
    crop?: 'center' | 'top' | 'left' | 'right' | 'bottom'
  }>
  adminThumbnail?: string
  focalPoint?: boolean
  disableLocalStorage?: boolean
}

// TypeScript configuration
export interface TypeScriptConfig {
  outputFile?: string
}

// Auth configuration
export interface AuthConfig {
  tokenExpiration?: number
  cookies?: {
    secure?: boolean
    sameSite?: 'strict' | 'lax' | 'none'
    domain?: string
  }
  strategies?: AuthStrategy[]
  forgotPassword?: {
    generateEmailHTML?: (args: any) => string
    generateEmailSubject?: (args: any) => string
  }
  verify?: boolean | {
    generateEmailHTML?: (args: any) => string
    generateEmailSubject?: (args: any) => string
  }
}

// Auth strategy interface
export interface AuthStrategy {
  name: string
  authenticate: (args: any) => Promise<AuthResult>
}

// Auth result
export interface AuthResult {
  user: User
  token?: string
  exp?: number
}

// Version configuration
export interface VersionConfig {
  maxPerDoc?: number
  retainDeleted?: boolean
}

// Timestamp configuration
export interface TimestampConfig {
  createdAt?: string
  updatedAt?: string
}

// Label configuration
export interface LabelConfig {
  singular?: string
  plural?: string
}

// Endpoint configuration
export interface Endpoint {
  path: string
  method: 'get' | 'post' | 'put' | 'patch' | 'delete'
  handler: (req: RevealRequest) => Promise<Response> | Response
  root?: boolean
}

// ============================================================================
// REVEALUI FIELD TRAVERSAL & PROCESSING INTERFACES
// ============================================================================

// Arguments for field traversal functions
export interface RevealUITraverseFieldsArgs {
  blockData?: Record<string, unknown>
  collection?: string
  context: RevealUIFrameworkContext
  currentDepth?: number
  data: Record<string, unknown>
  depth?: number
  doc: RevealDocument
  docWithLocales?: Record<string, unknown>
  draft?: boolean
  errors?: string[]
  fallbackLocale?: string
  fieldLabelPath?: string
  fieldPromises?: Promise<unknown>[]
  fields: RevealField[]
  findMany?: (args: { collection: string; where?: Record<string, unknown>; limit?: number }) => Promise<RevealDocument[]>
  flattenLocales?: boolean
  global?: boolean
  id?: string | number
  locale?: string
  mergeLocaleActions?: Record<string, unknown>
  operation: 'create' | 'update' | 'read'
  overrideAccess?: boolean
  parentIndexPath?: string
  parentIsLocalized?: boolean
  parentPath?: string
  parentSchemaPath?: string
  populate?: boolean
  populationPromises?: Promise<unknown>[]
  previousDoc?: RevealDocument
  previousSiblingDoc?: Record<string, unknown>
  req: RevealRequest
  showHiddenFields?: boolean
  siblingData?: Record<string, unknown>
  siblingDoc?: RevealDocument
  siblingDocWithLocales?: Record<string, unknown>
  skipValidation?: boolean
  triggerAccessControl?: boolean
  triggerHooks?: boolean
}

// Results from field traversal functions
export interface RevealUITraverseFieldsResult {
  data: Record<string, unknown>
  errors: string[]
}

// Arguments for dependency checking
export interface RevealUIDependencyCheckArgs {
  collection?: string
  data?: Record<string, unknown>
  fields?: RevealField[]
  req?: RevealRequest
  dependencyGroups?: Array<{
    name: string
    dependencies: string[]
    targetVersion?: string
  }>
}

// Arguments for schema processing
export interface RevealUISchemaArgs {
  schema: Record<string, unknown>
  field?: RevealField
  collection?: string
}

// Rich text adapter interface
export interface RevealUIRichTextAdapter {
  name: string
  editor?: RevealUIRichTextEditor
  outputSchema?: (args: { field: RevealField; collection?: string }) => Record<string, unknown>
  validate?: (value: unknown, args: { field: RevealField; collection?: string }) => boolean | string
  hooks?: {
    afterRead?: RevealAfterReadHook[]
    beforeChange?: RevealBeforeChangeHook[]
    afterChange?: RevealAfterChangeHook[]
  }
}

// Rich text editor interface
export interface RevealUIRichTextEditor {
  features?: RevealUIRichTextFeature[]
  lexical?: {
    theme?: Record<string, unknown>
  }
}

// Rich text feature interface
export interface RevealUIRichTextFeature {
  name: string
  props?: Record<string, unknown>
}

// ============================================================================
// TYPE ALIASES FOR COMPATIBILITY
// ============================================================================

// Core type aliases moved to index.ts for cleaner organization

// File types
export type FileData = {
  filename: string
  filesize: number
  mimeType: string
  buffer: Buffer
  tempFilePath?: string
}
export type FileSizeImproved = (size: number) => string

// ID and type utilities
export type TypeWithID = { id: string | number }
export type DefaultDocumentIDType = string | number
export type TypedUser = User & { [key: string]: unknown }
export type TypedLocale = string
export type TypedFallbackLocale = string

// Operation types
export type Operation = 'create' | 'read' | 'update' | 'delete' | 'publish'

// Context and request types
export type RequestContext = Record<string, unknown>

// Validation types
export type Validate<T = unknown> = (value: T, options?: ValidateOptions) => boolean | string | Promise<boolean | string>
export type ValidateOptions = {
  data?: Record<string, unknown>
  siblingData?: Record<string, unknown>
  id?: string | number
  user?: User
  payload?: RevealPayload
  operation?: Operation
}

// Utility functions
export type createDataloaderCacheKey = (args: { collection: string; id: string | number; depth?: number }) => string
export type createLocalReq = (options: { user?: User; context?: Record<string, unknown> }) => RevealRequest
export type isValidID = (id: unknown) => id is string | number

// Field processing utilities
export type fieldsToJSONSchema = (fields: Field[], config: SanitizedConfig) => Record<string, unknown>
export type flattenAllFields = (fields: Field[], config: SanitizedConfig) => FlattenedField[]

// Import map utilities
export type ImportMapGenerators = Record<string, (args: any) => string>

// Additional missing types
export type DataFromCollectionSlug<T extends string> = T extends keyof any ? any : never
export type DocumentPreferences = {
  collection: string
  document: string | number
  user: string | number
  key: string
  value: unknown
}

// Flattened field types
export interface FlattenedField extends Field {
  path: string
  depth: number
  parent: FlattenedField | null
}

export interface FlattenedBlock extends Block {
  path: string
  depth: number
  parent: FlattenedField | null
}

export interface FlattenedBlocksField extends BlocksField {
  path: string
  depth: number
  parent: FlattenedField | null
}

// Default component props
export interface DefaultServerCellComponentProps {
  collection: string
  field: Field
  data: unknown
  rowData: Record<string, unknown>
}

// API Handler types
export type PayloadHandler = (req: RevealRequest) => Promise<Response> | Response
export type RevealUIAccessArgs = RevealRequest
export type RevealUIComponent = React.ComponentType<{ children?: React.ReactNode; revealUI?: RevealUIFrameworkContext }>

// Export default empty config for convenience
export const defaultConfig: RevealConfig = {}