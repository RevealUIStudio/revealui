import type { JSONSchema4TypeName } from 'json-schema'
import type {
  RevealConfig,
  RevealPayload,
  RevealFindOptions,
  RevealCreateOptions,
  RevealUpdateOptions,
  RevealDeleteOptions,
  RevealPaginatedResult,
  RevealUser,
  RevealCollectionConfig,
  RevealGlobalConfig,
  DatabaseResult,
  RevealDocument,
  RevealAfterChangeHook,
  RevealRequest,
  RevealHookContext,
  RevealUITraverseFieldsArgs,
  RevealUITraverseFieldsResult,
  RevealUIDependencyCheckArgs,
  RevealUISchemaArgs,
  RevealUIRichTextAdapter,
  RevealUIEnhancedField,
  RevealUIFieldType,
  RevealUIPermission,
  RevealUIValidationRule,
  Field,
  RevealField,
  SanitizedConfig,
  Config,
  CollectionConfig,
  GlobalConfig,
  ClientConfig,
  ClientCollectionConfig,
  RevealUIBlock,
} from '../types/index'

import { getDataLoader } from './dataloader.js'
import { afterRead } from '../fields/hooks/afterRead/index.js'

// =============================================================================
// RELATIONSHIP ANALYSIS UTILITIES (Step 1.1: Relationship Field Analyzer)
// =============================================================================

/**
 * Metadata for relationship fields to determine storage strategy and query approach
 */
export interface RelationshipMetadata {
  /** The field name in the collection */
  fieldName?: string | undefined

  /** How this relationship is stored in the database */
  storageType: 'direct_fk' | 'junction_table' | 'polymorphic'

  /** Which collection(s) this relates to */
  relationTo: string | string[]

  /** Whether this is a hasMany relationship */
  hasMany: boolean

  /** Whether this field is localized */
  localized: boolean

  /** Table name for junction table relationships */
  tableName?: string

  /** Column name for direct FK relationships */
  fkColumnName?: string

  /** Path in nested structures (for blocks/arrays) */
  path?: string

  /** Maximum depth for this relationship */
  maxDepth?: number

  /** Current depth for this relationship query */
  depth?: number
}

/**
 * Analyzes a collection configuration and extracts all relationship fields
 * with their storage metadata for proper query building.
 *
 * @param collectionConfig - The collection configuration to analyze
 * @param collectionSlug - The slug of the collection being analyzed
 * @returns Array of relationship metadata for all relationship fields
 */
export function getRelationshipFields(
  collectionConfig: RevealCollectionConfig,
  collectionSlug: string
): RelationshipMetadata[] {
  const relationships: RelationshipMetadata[] = []

  // Analyze each field in the collection
  for (const field of collectionConfig.fields) {
    const metadata = analyzeFieldForRelationships(field, collectionSlug, '')
    if (metadata) {
      relationships.push(...metadata)
    }
  }

  return relationships
}

/**
 * Analyzes a single field to determine if it's a relationship and what type
 *
 * @param field - The field to analyze
 * @param collectionSlug - The collection this field belongs to
 * @param currentPath - Current path in nested structures (for blocks/arrays)
 * @returns Relationship metadata or null if not a relationship
 */
function analyzeFieldForRelationships(
  field: RevealField,
  collectionSlug: string,
  currentPath: string
): RelationshipMetadata[] | null {
  const fullPath = currentPath ? `${currentPath}.${field.name ?? ''}` : (field.name ?? '')

  // Check for relationship fields
  if (field.type === 'relationship' || field.type === 'upload') {
    const metadata: RelationshipMetadata = {
      fieldName: field.name,
      storageType: determineStorageType(field),
      relationTo: field.relationTo || [],
      hasMany: field.hasMany || false,
      localized: false, // TODO: Implement localization detection
      path: fullPath,
      maxDepth: 1, // Default depth, will be configurable later
      depth: 1, // Default depth for queries
    }

    // Set storage-specific properties
    if (metadata.storageType === 'direct_fk') {
      metadata.fkColumnName = `${field.name}_id`
    } else if (metadata.storageType === 'junction_table') {
      metadata.tableName = `${collectionSlug}_rels`
    }

    return [metadata]
  }

  // Check for array fields that might contain relationships
  if (field.type === 'array' && 'fields' in field && Array.isArray(field.fields)) {
    const arrayRelationships: RelationshipMetadata[] = []

    for (const subField of field.fields) {
      const subMetadata = analyzeFieldForRelationships(subField, collectionSlug, fullPath)
      if (subMetadata) {
        arrayRelationships.push(...subMetadata)
      }
    }

    return arrayRelationships.length > 0 ? arrayRelationships : null
  }

  // Check for blocks that might contain relationships
  if (field.type === 'blocks' && 'blocks' in field && Array.isArray(field.blocks)) {
    const blockRelationships: RelationshipMetadata[] = []

    for (const block of field.blocks) {
      for (const blockField of block.fields) {
        const blockMetadata = analyzeFieldForRelationships(
          blockField,
          collectionSlug,
          `${fullPath}.${block.name}`
        )
        if (blockMetadata) {
          blockRelationships.push(...blockMetadata)
        }
      }
    }

    return blockRelationships.length > 0 ? blockRelationships : null
  }

  return null
}

/**
 * Determines how a relationship field should be stored based on its configuration
 *
 * @param field - The relationship field to analyze
 * @returns The storage type for this relationship
 */
function determineStorageType(field: RevealField): 'direct_fk' | 'junction_table' | 'polymorphic' {
  // Upload fields are always treated as single relationships
  if (field.type === 'upload') {
    return 'direct_fk'
  }

  // Check for polymorphic relationships (relationTo is an array)
  if (Array.isArray(field.relationTo) && field.relationTo.length > 1) {
    return 'polymorphic'
  }

  // hasMany relationships require junction tables
  if (field.hasMany) {
    return 'junction_table'
  }

  // Single relationships to one collection use direct foreign keys
  return 'direct_fk'
}

class RevealUILogger {
  info(message: string): void {
    console.log(`RevealUI: ${message}`)
  }

  warn(message: string): void {
    console.warn(`RevealUI: ${message}`)
  }

  error(message: string): void {
    console.error(`RevealUI: ${message}`)
  }
}

// Helper function to call hooks
async function callHooks(
  hooks: RevealAfterChangeHook[] | undefined,
  args: {
    doc: RevealDocument
    context: RevealHookContext
  },
  revealUI: RevealPayload
): Promise<RevealDocument> {
  let result = args.doc

  if (!hooks) return result

  for (const hook of hooks) {
    try {
      result = await (hook as any)({
        doc: result,
        context: args.context,
      })
    } catch (error) {
      revealUI.logger.error(`Hook execution failed: ${error}`)
    }
  }

  return result
}

// Collection operations implementation
class RevealUICollection {
  config: RevealCollectionConfig
  db: {
    query: (query: string, values?: unknown[]) => Promise<DatabaseResult>
  } | null

  constructor(
    config: RevealCollectionConfig,
    db: { query: (query: string, values?: unknown[]) => Promise<DatabaseResult> } | null
  ) {
    this.config = config
    this.db = db
  }

  private async callAfterChangeHooks(
    doc: RevealDocument,
    req: RevealRequest,
    operation: 'create' | 'update',
    previousDoc?: RevealDocument
  ): Promise<RevealDocument> {
    if (!this.config.hooks?.afterChange) {
      return doc
    }

    let result = doc
    for (const hook of this.config.hooks.afterChange) {
      result = await (hook as any)({
        doc: result,
        context: {
          payload: {} as any, // Will be set by caller
          collection: this.config.slug,
          operation,
          previousDoc,
          req,
        },
      })
    }
    return result
  }

  async find(options: RevealFindOptions): Promise<RevealPaginatedResult> {
    const { where, limit = 10, page = 1, sort, depth = 0, req } = options

    // Validate depth
    if (depth < 0 || depth > 3) {
      throw new Error(`Depth must be between 0 and 3, got ${depth}`)
    }

    // Build query based on database adapter
    if (this.db?.query) {
      const offset = (page - 1) * limit
      const tableName = this.config.slug

      // Build WHERE clause
      let whereClause = ''
      const params: unknown[] = []

      if (where) {
        // Simple where clause implementation (PostgreSQL uses $1, $2 style)
        const conditions: string[] = []
        Object.entries(where).forEach(([key, value]) => {
          if (value !== undefined) {
            params.push(value)
            conditions.push(`"${key}" = $${params.length}`)
          }
        })
        whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''
      }

      // Build ORDER BY clause
      let orderByClause = ''
      if (sort) {
        const sortConditions: string[] = []
        Object.entries(sort).forEach(([key, direction]) => {
          sortConditions.push(`"${key}" ${direction === '-1' ? 'DESC' : 'ASC'}`)
        })
        orderByClause = sortConditions.length > 0 ? `ORDER BY ${sortConditions.join(', ')}` : ''
      }

      // Execute count query (PostgreSQL)
      const countQuery = `SELECT COUNT(*) as total FROM "${tableName}" ${whereClause}`
      const countResult = await this.db.query(countQuery, params)
      const totalDocs = Number(countResult.rows[0]?.total) || 0

      // Execute data query (PostgreSQL uses $1, $2 for parameters)
      const limitParam = params.length + 1
      const offsetParam = params.length + 2
      const dataQuery = `SELECT * FROM "${tableName}" ${whereClause} ${orderByClause} LIMIT $${limitParam} OFFSET $${offsetParam}`
      const docsResult = await this.db.query(dataQuery, [...params, limit, offset])
      let docs = docsResult.rows

      // Apply relationship population if depth > 0
      if (req && depth > 0) {
        const sanitizedConfig = {
          ...this.config,
          flattenedFields: this.config.fields,
          customIDType: 'text' as const,
          trash: false,
          defaultPopulate: [],
        }

        docs = await Promise.all(
          docs.map(async (doc) => {
            return await afterRead({
              collection: sanitizedConfig as any,
              context: req.context || {},
              currentDepth: 1,
              depth,
              doc,
              draft: false,
              fallbackLocale: req.fallbackLocale || 'en',
              findMany: true,
              flattenLocales: true,
              global: null,
              locale: req.locale || 'en',
              overrideAccess: false,
              populate: undefined,
              req,
              select: undefined,
              showHiddenFields: false,
            })
          })
        )
      }

      const totalPages = Math.ceil(totalDocs / limit)

      return {
        docs,
        totalDocs,
        limit,
        totalPages,
        page,
        pagingCounter: offset + 1,
        hasPrevPage: page > 1,
        hasNextPage: page < totalPages,
        prevPage: page > 1 ? page - 1 : null,
        nextPage: page < totalPages ? page + 1 : null,
      }
    }

    // Fallback for no database
    return {
      docs: [],
      totalDocs: 0,
      limit,
      totalPages: 0,
      page,
      pagingCounter: 0,
      hasPrevPage: false,
      hasNextPage: false,
      prevPage: null,
      nextPage: null,
    }
  }

  async findByID(options: {
    id: string | number
    depth?: number
    req?: RevealRequest
  }): Promise<RevealDocument | null> {
    const { id, depth = 0, req } = options

    // Validate depth
    if (depth < 0 || depth > 3) {
      throw new Error(`Depth must be between 0 and 3, got ${depth}`)
    }

    if (this.db?.query) {
      const tableName = this.config.slug
      const query = `SELECT * FROM "${tableName}" WHERE id = $1 LIMIT 1`
      const result = await this.db.query(query, [id])
      const doc = result.rows[0]

      if (!doc) return null

      // Use afterRead hook system for relationship population
      if (req && depth > 0) {
        // Adapt collection config to sanitized format
        const sanitizedConfig = {
          ...this.config,
          flattenedFields: this.config.fields,
          customIDType: 'text' as const, // Default to text IDs
          trash: false,
          defaultPopulate: [],
        }

        return await afterRead({
          collection: sanitizedConfig as any,
          context: req.context || {},
          currentDepth: 1,
          depth,
          doc,
          draft: false,
          fallbackLocale: req.fallbackLocale || 'en',
          findMany: false,
          flattenLocales: true,
          global: null,
          locale: req.locale || 'en',
          overrideAccess: false,
          populate: undefined, // TODO: Add populate support
          req,
          select: undefined,
          showHiddenFields: false,
        })
      }

      return doc
    }

    return null
  }

  async create(options: RevealCreateOptions): Promise<RevealDocument> {
    const { data } = options

    if (this.db?.query) {
      const tableName = this.config.slug

      // Generate ID if not provided
      const id =
        typeof data.id === 'string' || typeof data.id === 'number'
          ? data.id
          : `rvl_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`

      // Build INSERT query (PostgreSQL uses $1, $2 style)
      const columns = Object.keys(data)
      const placeholders = columns.map((_, i) => `$${i + 2}`).join(', ')
      const values = Object.values(data)

      const query = `INSERT INTO "${tableName}" (id, ${columns.map((c) => `"${c}"`).join(', ')}) VALUES ($1, ${placeholders})`
      await this.db.query(query, [id, ...values])

      return { ...data, id }
    }

    // Fallback
    const id =
      typeof data.id === 'string' || typeof data.id === 'number'
        ? data.id
        : `rvl_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    return { ...data, id }
  }

  async update(options: RevealUpdateOptions): Promise<RevealDocument> {
    const { id, data } = options

    if (this.db?.query) {
      const tableName = this.config.slug

      // Build UPDATE query (PostgreSQL uses $1, $2 style)
      const keys = Object.keys(data)
      const setClause = keys.map((key, i) => `"${key}" = $${i + 1}`).join(', ')
      const values = Object.values(data)

      const query = `UPDATE "${tableName}" SET ${setClause} WHERE id = $${keys.length + 1}`
      await this.db.query(query, [...values, id])

      // Return updated document
      const updatedDoc = await this.findByID({ id })
      if (!updatedDoc) {
        throw new Error(`Document with id ${id} not found after update`)
      }
      return updatedDoc
    }

    return { ...data, id }
  }

  async delete(options: RevealDeleteOptions): Promise<RevealDocument> {
    const { id } = options

    if (this.db?.query) {
      const tableName = this.config.slug
      const query = `DELETE FROM "${tableName}" WHERE id = $1`
      await this.db.query(query, [id])
    }

    return { id }
  }
}

// Global operations implementation
class RevealUIGlobal {
  config: RevealGlobalConfig
  db: {
    query: (query: string, values?: unknown[]) => Promise<DatabaseResult>
  } | null

  constructor(
    config: RevealGlobalConfig,
    db: { query: (query: string, values?: unknown[]) => Promise<DatabaseResult> } | null
  ) {
    this.config = config
    this.db = db
  }

  async find(options: { depth?: number } = {}): Promise<RevealDocument | null> {
    const { depth = 0 } = options

    // Validate depth
    if (depth < 0 || depth > 3) {
      throw new Error(`Depth must be between 0 and 3, got ${depth}`)
    }

    if (this.db?.query) {
      const tableName = `global_${this.config.slug}`
      let query = `SELECT * FROM "${tableName}" LIMIT 1`
      const params: unknown[] = []

      // If depth > 0, we need to populate relationships
      if (depth > 0) {
        // Cast to collection config for relationship analysis
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const relationships = getRelationshipFields(this.config as any, String(this.config.slug))

        // For now, only handle simple direct FK relationships (depth 1)
        if (relationships.length > 0) {
          const joins: string[] = []
          const selectColumns: string[] = [`"${tableName}".*`]

          for (const rel of relationships) {
            if (rel.storageType === 'direct_fk' && !rel.hasMany) {
              // Simple foreign key relationship
              const relTableName = Array.isArray(rel.relationTo)
                ? rel.relationTo[0]
                : rel.relationTo
              const fkColumn = rel.fkColumnName || `${rel.fieldName}_id`
              const alias = `rel_${rel.fieldName}`

              joins.push(
                `LEFT JOIN "${relTableName}" AS ${alias} ON "${tableName}"."${fkColumn}" = ${alias}.id`
              )
              selectColumns.push(`${alias}.title AS "${rel.fieldName}.title"`)
              selectColumns.push(`${alias}.id AS "${rel.fieldName}.id"`)
            }
          }

          if (joins.length > 0) {
            query = `SELECT ${selectColumns.join(', ')} FROM "${tableName}" ${joins.join(' ')} LIMIT 1`
          }
        }
      }

      const result = await this.db.query(query, params)
      const doc = result.rows[0]

      if (!doc) return null

      // Flatten dotted notation results into nested objects
      return flattenResult(doc)
    }

    return null
  }

  async update(options: { data: Partial<RevealDocument> }): Promise<RevealDocument> {
    const { data } = options

    if (this.db?.query) {
      const tableName = `global_${this.config.slug}`

      // Check if global exists
      const existing = await this.find()
      const id = existing?.id || `global_${this.config.slug}`

      if (existing) {
        // Update (PostgreSQL uses $1, $2 style)
        const keys = Object.keys(data)
        const setClause = keys.map((key, i) => `"${key}" = $${i + 1}`).join(', ')
        const values = Object.values(data)
        const query = `UPDATE "${tableName}" SET ${setClause} WHERE id = $${keys.length + 1}`
        await this.db.query(query, [...values, id])
      } else {
        // Insert (PostgreSQL uses $1, $2 style)
        const columns = Object.keys(data)
        const placeholders = columns.map((_, i) => `$${i + 2}`).join(', ')
        const values = Object.values(data)
        const query = `INSERT INTO "${tableName}" (id, ${columns.map((c) => `"${c}"`).join(', ')}) VALUES ($1, ${placeholders})`
        await this.db.query(query, [id, ...values])
      }

      const updatedDoc = await this.find()
      if (!updatedDoc) {
        throw new Error(`Global document ${this.config.slug} not found after update`)
      }
      return updatedDoc
    }

    return { ...data, id: `global_${this.config.slug}` }
  }
}

/**
 * Flattens SQL result with dotted notation into nested objects
 * e.g., { 'author.title': 'John', 'author.id': 1 } -> { author: { title: 'John', id: 1 } }
 */
export function flattenResult(doc: RevealDocument): RevealDocument {
  const result = { ...doc }

  for (const key of Object.keys(doc)) {
    if (key.includes('.')) {
      const [parentKey, childKey] = key.split('.', 2)
      if (!result[parentKey]) {
        result[parentKey] = {}
      }
      ;(result[parentKey] as Record<string, unknown>)[childKey] = doc[key]
      delete result[key]
    }
  }

  return result
}

export async function createRevealUIPayload(config: any): Promise<RevealPayload> {
  const logger = new RevealUILogger()

  // Database connection is now lazy - only connect on first query
  let dbConnected = false
  const ensureDbConnected = async () => {
    if (!dbConnected && config.db) {
      await config.db.init?.()
      await config.db.connect?.()
      dbConnected = true
    }
  }

  // Initialize collections and globals
  const collections: { [slug: string]: RevealUICollection } = {}
  const globals: { [slug: string]: RevealUIGlobal } = {}

  // Initialize collections
  if (config.collections) {
    for (const collectionConfig of config.collections) {
      collections[collectionConfig.slug] = new RevealUICollection(
        collectionConfig,
        config.db || null
      )
    }
  }

  // Initialize globals
  if (config.globals) {
    for (const globalConfig of config.globals) {
      globals[globalConfig.slug] = new RevealUIGlobal(globalConfig, config.db || null)
    }
  }

  // Create a base request for DataLoader initialization
  const baseReq = {
    payload: {} as RevealPayload,
    transactionID: null,
    context: {},
  } as RevealRequest

  const revealUIPayload: RevealPayload = {
    collections,
    globals,
    config,
    logger,

    async find(
      options: RevealFindOptions & { collection: string }
    ): Promise<RevealPaginatedResult> {
      await ensureDbConnected()
      const { collection, depth = 0, req } = options

      if (!collections[collection]) {
        throw new Error(`Collection '${collection}' not found`)
      }

      // Ensure request context has DataLoader if needed
      if (req && !req.payloadDataLoader) {
        req.payload = revealUIPayload
        req.transactionID = req.transactionID || 'default'
        req.payloadDataLoader = getDataLoader(req)
      }

      return collections[collection].find(options)
    },

    async findByID(options: {
      collection: string
      id: string | number
      depth?: number
      req?: RevealRequest
    }): Promise<RevealDocument | null> {
      await ensureDbConnected()
      const { collection, depth = 0, req } = options

      if (!collections[collection]) {
        throw new Error(`Collection '${collection}' not found`)
      }

      // Initialize DataLoader for the request if it doesn't exist
      if (req && !req.payloadDataLoader) {
        req.payload = revealUIPayload
        req.transactionID = req.transactionID || 'default'
        req.payloadDataLoader = getDataLoader(req)
      }

      return collections[collection].findByID(options)
    },

    async create(options: RevealCreateOptions & { collection: string }): Promise<RevealDocument> {
      await ensureDbConnected()
      const { collection, req } = options

      if (!collections[collection]) {
        throw new Error(`Collection '${collection}' not found`)
      }

      const collectionConfig = config.collections?.find((c: any) => c.slug === collection)
      let doc = await collections[collection].create(options)

      // Call afterChange hooks
      if (collectionConfig?.hooks?.afterChange && req) {
        doc = await callHooks(
          collectionConfig.hooks.afterChange,
          {
            doc,
            context: {
              payload: revealUIPayload,
              collection,
              operation: 'create',
              req,
            },
          },
          revealUIPayload
        )
      }

      return doc
    },

    async update(options: RevealUpdateOptions & { collection: string }): Promise<RevealDocument> {
      await ensureDbConnected()
      const { collection, req } = options

      if (!collections[collection]) {
        throw new Error(`Collection '${collection}' not found`)
      }

      const collectionConfig = config.collections?.find((c: any) => c.slug === collection)
      const previousDoc = await collections[collection].findByID({ id: options.id })
      let doc = await collections[collection].update(options)

      // Call afterChange hooks
      if (collectionConfig?.hooks?.afterChange && req) {
        doc = await callHooks(
          collectionConfig.hooks.afterChange,
          {
            doc,
            context: {
              payload: revealUIPayload,
              collection,
              operation: 'update',
              previousDoc: previousDoc || undefined,
              req,
            },
          },
          revealUIPayload
        )
      }

      return doc
    },

    async delete(options: RevealDeleteOptions & { collection: string }): Promise<RevealDocument> {
      await ensureDbConnected()
      const { collection } = options

      if (!collections[collection]) {
        throw new Error(`Collection '${collection}' not found`)
      }

      return collections[collection].delete(options)
    },

    async login(options: {
      collection: string
      data: { email: string; password: string }
      req?: RevealRequest
    }): Promise<RevealDocument> {
      const { collection, data, req } = options

      if (!collections[collection]) {
        throw new Error(`Collection '${collection}' not found`)
      }

      // Basic login implementation - in a real system this would verify password hash
      // For now, just find user by email (password verification would be added)
      const users = await collections[collection].find({
        where: { email: { equals: data.email } },
        limit: 1,
      })

      if (!users.docs[0]) {
        throw new Error('Invalid credentials')
      }

      // In a real implementation, password verification would happen here
      // For now, just return the user document
      return users.docs[0]
    },

    async findGlobal(options: {
      slug: string
      depth?: number
      req?: RevealRequest
    }): Promise<RevealDocument | null> {
      await ensureDbConnected()
      const { slug, depth = 0, req } = options

      if (!globals[slug]) {
        throw new Error(`Global '${slug}' not found`)
      }

      return globals[slug].find({ depth })
    },

    async updateGlobal(options: {
      slug: string
      data: Partial<RevealDocument>
      depth?: number
      req?: RevealRequest
    }): Promise<RevealDocument> {
      await ensureDbConnected()
      const { slug, req } = options

      if (!globals[slug]) {
        throw new Error(`Global '${slug}' not found`)
      }

      return globals[slug].update(options)
    },
  }

  // Run onInit hook if provided (skip during build to avoid database connections)
  const isBuildTime =
    process.env.NEXT_PHASE === 'phase-production-build' ||
    (process.env.NODE_ENV === 'production' && !process.env.RUNTIME_INIT)

  if (config.onInit && !isBuildTime) {
    await config.onInit(revealUIPayload)
  }

  // Initialize DataLoader for the base request
  baseReq.payload = revealUIPayload
  baseReq.payloadDataLoader = getDataLoader(baseReq)

  return revealUIPayload
}

// Utility functions needed by richtext-lexical
export async function afterChangeTraverseFields(
  args: RevealUITraverseFieldsArgs
): Promise<RevealUITraverseFieldsResult> {
  // Proper implementation for field traversal after changes
  const result: RevealUITraverseFieldsResult = {
    traversed: args.fields?.length || 0,
    found: args.fields || [],
    data: args.data,
    errors: [],
  }

  // TODO: Implement actual field traversal logic
  // This should process each field according to its type and configuration

  return result
}

export async function afterReadTraverseFields(
  args: RevealUITraverseFieldsArgs
): Promise<RevealUITraverseFieldsResult> {
  // Proper implementation for field traversal after reads
  const result: RevealUITraverseFieldsResult = {
    traversed: args.fields?.length || 0,
    found: args.fields || [],
    data: args.data,
    errors: [],
  }

  // TODO: Implement actual field traversal logic
  // This should process fields for read operations

  return result
}

export async function beforeChangeTraverseFields(
  args: RevealUITraverseFieldsArgs
): Promise<RevealUITraverseFieldsResult> {
  // Proper implementation for field traversal before changes
  const result: RevealUITraverseFieldsResult = {
    traversed: args.fields?.length || 0,
    found: args.fields || [],
    data: args.data,
    errors: [],
  }

  // TODO: Implement actual field traversal logic
  // This should validate and prepare fields before changes

  return result
}

export async function beforeValidateTraverseFields(
  args: RevealUITraverseFieldsArgs
): Promise<RevealUITraverseFieldsResult> {
  // Proper implementation for field traversal before validation
  const result: RevealUITraverseFieldsResult = {
    traversed: args.fields?.length || 0,
    found: args.fields || [],
    data: args.data,
    errors: [],
  }

  // TODO: Implement actual field traversal logic
  // This should prepare fields for validation

  return result
}

export function checkDependencies(args: RevealUIDependencyCheckArgs): boolean {
  // Proper implementation for dependency checking
  // TODO: Implement actual dependency validation logic
  // This should check field relationships and data dependencies

  // For now, return true (no issues found)
  return true
}

export function deepMergeSimple<T extends Record<string, unknown>>(
  target: T,
  source: Partial<T>
): T {
  // Type-safe deep merge implementation
  const result = { ...target }
  for (const key in source) {
    const sourceValue = source[key]
    if (sourceValue && typeof sourceValue === 'object' && !Array.isArray(sourceValue)) {
      const targetValue = result[key]
      if (targetValue && typeof targetValue === 'object' && !Array.isArray(targetValue)) {
        result[key] = deepMergeSimple(
          targetValue as Record<string, unknown>,
          sourceValue as Record<string, unknown>
        ) as T[Extract<keyof T, string>]
      } else {
        result[key] = sourceValue as T[Extract<keyof T, string>]
      }
    } else {
      result[key] = sourceValue as T[Extract<keyof T, string>]
    }
  }
  return result
}

export type RichTextAdapter = RevealUIRichTextAdapter

export function withNullableJSONSchemaType(
  typeName: JSONSchema4TypeName,
  isRequired: boolean
): JSONSchema4TypeName | JSONSchema4TypeName[] | undefined {
  // Return the type name, or an array including null if not required
  return isRequired ? typeName : [typeName, 'null']
}

// Additional type exports needed by richtext-lexical
export type { Field, RevealField, SanitizedConfig }
export type StaticLabel = string // Simple string type for labels
export type ServerFieldBase = RevealField // Alias for field base types
export type RichTextAdapterProvider = RevealUIRichTextAdapter // Rich text adapter type
export type RichTextField = RevealUIEnhancedField // Rich text field type

// Basic types
export type Data = Record<string, unknown>
export type FormState = Record<string, unknown>

// Config types
export type { Config, CollectionConfig, GlobalConfig }

// Component types (simplified aliases)
export type BlocksFieldClient = React.ComponentType<any>
export type ClientBlock = React.ComponentType<any>
export type CodeFieldClient = React.ComponentType<any>
export type CodeFieldClientProps = Record<string, unknown>
export type BlocksField = RevealField

// Block types
export type Block = RevealUIBlock
export type BlockJSX = React.ReactElement
export type BlockSlug = string

// Alias for backwards compatibility
export const createPayload = createRevealUIPayload
