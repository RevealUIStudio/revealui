import React from 'react'
import type {
  RevealConfig,
  RevealUICollectionConfig,
  RevealUIField,
  RevealUIContext,
  RevealUIAccessRule,
  RevealUIBlock,
  DatabaseAdapter,
  CollectionConfig,
} from './types/index'
import type { RevealDocument, RevealWhere, RevealSort } from './types/query'

// ============================================
// TYPES
// ============================================

export interface FindOptions {
  where?: RevealWhere
  limit?: number
  page?: number
  sort?: RevealSort
  depth?: number
  draft?: boolean
  locale?: string
}

export interface FindByIdOptions {
  depth?: number
  draft?: boolean
  locale?: string
}

export interface CreateOptions {
  locale?: string
  draft?: boolean
}

export interface UpdateOptions {
  locale?: string
  draft?: boolean
}

export interface DeleteOptions {
  locale?: string
}

export interface PaginatedResult<T> {
  docs: T[]
  totalDocs: number
  totalPages: number
  page: number
  limit: number
  hasNextPage: boolean
  hasPrevPage: boolean
  nextPage: number | null
  prevPage: number | null
}

// ============================================
// UTILITY FUNCTIONS
// ============================================

function generateId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).substr(2, 9)}`
}

function buildWhereClause(where?: RevealWhere): string {
  if (!where) return ''
  
  const conditions: string[] = []
  
  // Handle simple field conditions
  for (const [field, operators] of Object.entries(where)) {
    if (field === 'and' || field === 'or') continue
    
    if (typeof operators === 'object' && operators !== null) {
      for (const [op, value] of Object.entries(operators as Record<string, unknown>)) {
        switch (op) {
          case 'equals':
            conditions.push(`${field} = ?`)
            break
          case 'not_equals':
            conditions.push(`${field} != ?`)
            break
          case 'contains':
            conditions.push(`${field} LIKE ?`)
            break
          case 'greater_than':
            conditions.push(`${field} > ?`)
            break
          case 'less_than':
            conditions.push(`${field} < ?`)
            break
          case 'in':
            if (Array.isArray(value)) {
              conditions.push(`${field} IN (${value.map(() => '?').join(', ')})`)
            }
            break
          case 'exists':
            conditions.push(value ? `${field} IS NOT NULL` : `${field} IS NULL`)
            break
        }
      }
    }
  }
  
  // Handle AND conditions
  if ('and' in where && Array.isArray((where as any).and)) {
    const andConditions = (where as any).and.map((w: RevealWhere) => buildWhereClause(w)).filter(Boolean)
    if (andConditions.length) {
      conditions.push(`(${andConditions.join(' AND ')})`)
    }
  }
  
  // Handle OR conditions
  if ('or' in where && Array.isArray((where as any).or)) {
    const orConditions = (where as any).or.map((w: RevealWhere) => buildWhereClause(w)).filter(Boolean)
    if (orConditions.length) {
      conditions.push(`(${orConditions.join(' OR ')})`)
    }
  }
  
  return conditions.length ? conditions.join(' AND ') : ''
}

function extractWhereValues(where?: RevealWhere): unknown[] {
  if (!where) return []
  
  const values: unknown[] = []
  
  for (const [field, operators] of Object.entries(where)) {
    if (field === 'and' || field === 'or') continue
    
    if (typeof operators === 'object' && operators !== null) {
      for (const [op, value] of Object.entries(operators as Record<string, unknown>)) {
        switch (op) {
          case 'equals':
          case 'not_equals':
          case 'greater_than':
          case 'less_than':
            values.push(value)
            break
          case 'contains':
            values.push(`%${value}%`)
            break
          case 'in':
            if (Array.isArray(value)) {
              values.push(...value)
            }
            break
        }
      }
    }
  }
  
  // Handle nested conditions
  if ('and' in where && Array.isArray((where as any).and)) {
    for (const w of (where as any).and) {
      values.push(...extractWhereValues(w))
    }
  }
  
  if ('or' in where && Array.isArray((where as any).or)) {
    for (const w of (where as any).or) {
      values.push(...extractWhereValues(w))
    }
  }
  
  return values
}

// ============================================
// MAIN REVEALUI CLASS
// ============================================

export interface RevealUILogger {
  info: (...args: unknown[]) => void
  warn: (...args: unknown[]) => void
  error: (...args: unknown[]) => void
  debug: (...args: unknown[]) => void
}

export class RevealUI {
  private config: RevealConfig
  private context: RevealUIContext
  private db: DatabaseAdapter | null = null
  private initialized = false
  private collections: Map<string, CollectionConfig> = new Map()
  
  // Public logger for hooks and consumers
  public logger: RevealUILogger = {
    info: (...args) => console.log('[RevealUI]', ...args),
    warn: (...args) => console.warn('[RevealUI]', ...args),
    error: (...args) => console.error('[RevealUI]', ...args),
    debug: (...args) => console.debug('[RevealUI]', ...args),
  }

  constructor(config: RevealConfig, context?: Partial<RevealUIContext>) {
    this.config = config
    this.context = {
      permissions: [],
      theme: 'default',
      ...context,
    }
    
    // Index collections by slug
    if (config.collections) {
      for (const collection of config.collections) {
        this.collections.set(collection.slug, collection)
      }
    }
  }

  // Initialize the framework
  async init(): Promise<void> {
    if (this.initialized) return
    
    // Initialize database adapter
    if (this.config.db) {
      this.db = this.config.db as DatabaseAdapter
      if (typeof (this.db as any).init === 'function') {
        await (this.db as any).init()
      }
      
      // Create tables for collections
      if (this.config.collections && (this.db as any).createTable) {
        for (const collection of this.config.collections) {
          (this.db as any).createTable(collection.slug, collection.fields || [])
        }
      }
      
      // Create tables for globals
      if (this.config.globals && (this.db as any).createGlobalTable) {
        for (const global of this.config.globals) {
          (this.db as any).createGlobalTable(global.slug, global.fields || [])
        }
      }
    }
    
    this.initialized = true
  }

  // Get collection config
  getCollection(slug: string): CollectionConfig | undefined {
    return this.collections.get(slug)
  }

  // ============================================
  // COLLECTION OPERATIONS
  // ============================================

  async find(collection: string, options: FindOptions = {}): Promise<PaginatedResult<RevealDocument>> {
    if (!this.db) {
      throw new Error('Database not initialized. Call init() first.')
    }
    
    const { where, limit = 10, page = 1, sort } = options
    const offset = (page - 1) * limit
    
    // Build query
    let query = `SELECT * FROM ${collection}`
    const values: unknown[] = []
    
    // Add WHERE clause
    const whereClause = buildWhereClause(where)
    if (whereClause) {
      query += ` WHERE ${whereClause}`
      values.push(...extractWhereValues(where))
    }
    
    // Add ORDER BY
    if (sort) {
      const sortFields = Array.isArray(sort) ? sort : [sort]
      const orderBy = sortFields.map(s => {
        if (s.startsWith('-')) {
          return `${s.slice(1)} DESC`
        }
        return `${s} ASC`
      }).join(', ')
      query += ` ORDER BY ${orderBy}`
    } else {
      query += ` ORDER BY created_at DESC`
    }
    
    // Add LIMIT and OFFSET
    query += ` LIMIT ${limit} OFFSET ${offset}`
    
    // Execute query
    const result = await this.db.query(query, values)
    const docs = result.rows as RevealDocument[]
    
    // Get total count
    let countQuery = `SELECT COUNT(*) as count FROM ${collection}`
    if (whereClause) {
      countQuery += ` WHERE ${whereClause}`
    }
    const countResult = await this.db.query(countQuery, extractWhereValues(where))
    const totalDocs = (countResult.rows[0] as any)?.count || 0
    const totalPages = Math.ceil(totalDocs / limit)
    
    return {
      docs,
      totalDocs,
      totalPages,
      page,
      limit,
      hasNextPage: page < totalPages,
      hasPrevPage: page > 1,
      nextPage: page < totalPages ? page + 1 : null,
      prevPage: page > 1 ? page - 1 : null,
    }
  }

  async findById(collection: string, id: string, options: FindByIdOptions = {}): Promise<RevealDocument | null> {
    if (!this.db) {
      throw new Error('Database not initialized. Call init() first.')
    }
    
    const query = `SELECT * FROM ${collection} WHERE id = ? LIMIT 1`
    const result = await this.db.query(query, [id])
    
    if (result.rows.length === 0) {
      return null
    }
    
    return result.rows[0] as RevealDocument
  }

  async create(
    collection: string, 
    data: Record<string, unknown>,
    options: CreateOptions = {}
  ): Promise<RevealDocument> {
    if (!this.db) {
      throw new Error('Database not initialized. Call init() first.')
    }
    
    const now = new Date().toISOString()
    const id = generateId()
    
    // Build document
    const document: RevealDocument = {
      id,
      ...data,
      createdAt: now,
      updatedAt: now,
    }
    
    // Build INSERT query
    const fields = Object.keys(document)
    const placeholders = fields.map(() => '?').join(', ')
    const values = fields.map(f => {
      const val = document[f]
      // Serialize objects as JSON
      if (typeof val === 'object' && val !== null) {
        return JSON.stringify(val)
      }
      return val
    })
    
    const query = `INSERT INTO ${collection} (${fields.join(', ')}) VALUES (${placeholders})`
    
    await this.db.query(query, values)
    
    return document
  }

  async update(
    collection: string,
    id: string,
    data: Record<string, unknown>,
    options: UpdateOptions = {}
  ): Promise<RevealDocument | null> {
    if (!this.db) {
      throw new Error('Database not initialized. Call init() first.')
    }
    
    // Check if document exists
    const existing = await this.findById(collection, id)
    if (!existing) {
      return null
    }
    
    const now = new Date().toISOString()
    
    // Build SET clause
    const updates: Record<string, unknown> = { ...data, updatedAt: now }
    const fields = Object.keys(updates)
    const setClause = fields.map(f => `${f} = ?`).join(', ')
    const values = fields.map(f => {
      const val = updates[f]
      // Serialize objects as JSON
      if (typeof val === 'object' && val !== null) {
        return JSON.stringify(val)
      }
      return val
    })
    
    const query = `UPDATE ${collection} SET ${setClause} WHERE id = ?`
    values.push(id)
    
    await this.db.query(query, values)
    
    // Return updated document
    return this.findById(collection, id)
  }

  async delete(collection: string, id: string, options: DeleteOptions = {}): Promise<boolean> {
    if (!this.db) {
      throw new Error('Database not initialized. Call init() first.')
    }
    
    // Check if document exists
    const existing = await this.findById(collection, id)
    if (!existing) {
      return false
    }
    
    const query = `DELETE FROM ${collection} WHERE id = ?`
    await this.db.query(query, [id])
    
    return true
  }

  // ============================================
  // GLOBAL OPERATIONS
  // ============================================

  async findGlobal(slug: string): Promise<RevealDocument | null> {
    if (!this.db) {
      throw new Error('Database not initialized. Call init() first.')
    }
    
    const tableName = `global_${slug}`
    const query = `SELECT * FROM ${tableName} LIMIT 1`
    
    try {
      const result = await this.db.query(query, [])
      return result.rows.length > 0 ? result.rows[0] as RevealDocument : null
    } catch {
      return null
    }
  }

  async updateGlobal(slug: string, data: Record<string, unknown>): Promise<RevealDocument> {
    if (!this.db) {
      throw new Error('Database not initialized. Call init() first.')
    }
    
    const tableName = `global_${slug}`
    const existing = await this.findGlobal(slug)
    
    if (existing) {
      // Update existing
      const now = new Date().toISOString()
      const updateData: Record<string, unknown> = { ...data, updatedAt: now }
      const fields = Object.keys(updateData)
      const setClause = fields.map(f => `${f} = ?`).join(', ')
      const values = fields.map(f => {
        const val = updateData[f]
        if (typeof val === 'object' && val !== null) {
          return JSON.stringify(val)
        }
        return val
      })
      
      const query = `UPDATE ${tableName} SET ${setClause} WHERE id = ?`
      values.push(existing.id)
      
      await this.db.query(query, values)
      return { ...existing, ...updateData } as RevealDocument
    } else {
      // Create new
      const now = new Date().toISOString()
      const id = generateId()
      const document: RevealDocument = {
        id,
        ...data,
        createdAt: now,
        updatedAt: now,
      }
      
      const fields = Object.keys(document)
      const placeholders = fields.map(() => '?').join(', ')
      const values = fields.map(f => {
        const val = document[f]
        if (typeof val === 'object' && val !== null) {
          return JSON.stringify(val)
        }
        return val
      })
      
      const query = `INSERT INTO ${tableName} (${fields.join(', ')}) VALUES (${placeholders})`
      await this.db.query(query, values)
      
      return document
    }
  }

  // ============================================
  // CONTEXT & PERMISSIONS
  // ============================================

  setContext(context: Partial<RevealUIContext>): void {
    this.context = { ...this.context, ...context }
  }

  getContext(): RevealUIContext {
    return this.context
  }

  hasPermission(permission: string): boolean {
    return (
      this.context.permissions.includes(permission as any) ||
      this.context.permissions.includes('admin')
    )
  }

  switchTenant(tenantId: string): void {
    this.context.tenant = {
      id: tenantId,
      name: `Tenant ${tenantId}`,
      domain: `${tenantId}.example.com`,
      settings: {},
    }
  }

  // ============================================
  // CLEANUP
  // ============================================

  async close(): Promise<void> {
    if (this.db) {
      if (typeof (this.db as any).close === 'function') {
        await (this.db as any).close()
      } else if (typeof (this.db as any).disconnect === 'function') {
        await (this.db as any).disconnect()
      }
      this.db = null
    }
    this.initialized = false
  }
}

// ============================================
// FACTORY FUNCTIONS
// ============================================

export function createRevealUI(config: RevealConfig, context?: Partial<RevealUIContext>): RevealUI {
  return new RevealUI(config, context)
}

// Collection builder functions
export function createRevealUICollection(options: {
  slug: string
  fields: RevealUIField[]
  revealUI?: RevealUICollectionConfig['revealUI']
  access?: RevealUICollectionConfig['access']
}): RevealUICollectionConfig {
  return {
    slug: options.slug,
    fields: options.fields,
    revealUI: {
      tenantScoped: false,
      auditLog: false,
      permissions: ['read', 'update'],
      ...(options.revealUI || {}),
    },
    access: options.access,
  }
}

// Field builder functions
export function createRevealUIField(options: {
  name: string
  type: RevealUIField['type']
  label?: string
  required?: boolean
  revealUI?: RevealUIField['revealUI']
  admin?: RevealUIField['admin']
  validate?: RevealUIField['validate']
}): RevealUIField {
  return {
    name: options.name,
    type: options.type,
    label: options.label,
    required: options.required,
    revealUI: {
      searchable: false,
      permissions: ['read', 'update'],
      tenantScoped: false,
      auditLog: false,
      validation: [],
      ...options.revealUI,
    },
    admin: options.admin,
    validate: options.validate,
  }
}

// Block builder functions
export function createRevealUIBlock(options: {
  slug: string
  fields: RevealUIField[]
  revealUI?: RevealUIBlock['revealUI']
  labels?: RevealUIBlock['labels']
}): RevealUIBlock {
  return {
    slug: options.slug,
    fields: options.fields,
    revealUI: {
      category: 'content',
      icon: 'block',
      permissions: ['read', 'update'],
      tenantScoped: false,
      ...options.revealUI,
    },
    labels: options.labels,
  }
}

// Access rule builder functions
export function createRevealUIAccessRule(options: {
  tenant?: string
  user?: string
  permissions?: string[]
  condition?: (context: any) => boolean | any
}): RevealUIAccessRule {
  return {
    tenant: options.tenant,
    user: options.user,
    permissions: options.permissions as any,
    condition: options.condition,
  }
}

// ============================================
// REACT HOOKS
// ============================================

export function useRevealUI(): RevealUIContext {
  // This would be implemented with React context
  return {
    permissions: ['read'],
    theme: 'default',
  }
}

// Higher-order component for RevealUI access control
export function withRevealUIAccess<P extends object>(
  WrappedComponent: React.ComponentType<P>,
  requiredPermissions: string[]
): React.ComponentType<P> {
  return function RevealUIAccessWrapper(props: P) {
    // This would check permissions and conditionally render
    return <WrappedComponent {...props} />
  }
}
