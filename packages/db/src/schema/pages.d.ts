/**
 * Page tables - Derived from @revealui/contracts PageSchema
 *
 * These tables store page content and hierarchies.
 * The schema structure mirrors the Zod schemas in @revealui/contracts/entities.
 */
export declare const pages: import('drizzle-orm/pg-core').PgTableWithColumns<{
  name: 'pages'
  schema: undefined
  columns: {
    id: import('drizzle-orm/pg-core').PgColumn<
      {
        name: 'id'
        tableName: 'pages'
        dataType: 'string'
        columnType: 'PgText'
        data: string
        driverParam: string
        notNull: true
        hasDefault: false
        isPrimaryKey: true
        isAutoincrement: false
        hasRuntimeDefault: false
        enumValues: [string, ...string[]]
        baseColumn: never
        identity: undefined
        generated: undefined
      },
      {},
      {}
    >
    schemaVersion: import('drizzle-orm/pg-core').PgColumn<
      {
        name: 'schema_version'
        tableName: 'pages'
        dataType: 'string'
        columnType: 'PgText'
        data: string
        driverParam: string
        notNull: true
        hasDefault: true
        isPrimaryKey: false
        isAutoincrement: false
        hasRuntimeDefault: false
        enumValues: [string, ...string[]]
        baseColumn: never
        identity: undefined
        generated: undefined
      },
      {},
      {}
    >
    siteId: import('drizzle-orm/pg-core').PgColumn<
      {
        name: 'site_id'
        tableName: 'pages'
        dataType: 'string'
        columnType: 'PgText'
        data: string
        driverParam: string
        notNull: true
        hasDefault: false
        isPrimaryKey: false
        isAutoincrement: false
        hasRuntimeDefault: false
        enumValues: [string, ...string[]]
        baseColumn: never
        identity: undefined
        generated: undefined
      },
      {},
      {}
    >
    parentId: import('drizzle-orm/pg-core').PgColumn<
      {
        name: 'parent_id'
        tableName: 'pages'
        dataType: 'string'
        columnType: 'PgText'
        data: string
        driverParam: string
        notNull: false
        hasDefault: false
        isPrimaryKey: false
        isAutoincrement: false
        hasRuntimeDefault: false
        enumValues: [string, ...string[]]
        baseColumn: never
        identity: undefined
        generated: undefined
      },
      {},
      {}
    >
    templateId: import('drizzle-orm/pg-core').PgColumn<
      {
        name: 'template_id'
        tableName: 'pages'
        dataType: 'string'
        columnType: 'PgText'
        data: string
        driverParam: string
        notNull: false
        hasDefault: false
        isPrimaryKey: false
        isAutoincrement: false
        hasRuntimeDefault: false
        enumValues: [string, ...string[]]
        baseColumn: never
        identity: undefined
        generated: undefined
      },
      {},
      {}
    >
    title: import('drizzle-orm/pg-core').PgColumn<
      {
        name: 'title'
        tableName: 'pages'
        dataType: 'string'
        columnType: 'PgText'
        data: string
        driverParam: string
        notNull: true
        hasDefault: false
        isPrimaryKey: false
        isAutoincrement: false
        hasRuntimeDefault: false
        enumValues: [string, ...string[]]
        baseColumn: never
        identity: undefined
        generated: undefined
      },
      {},
      {}
    >
    slug: import('drizzle-orm/pg-core').PgColumn<
      {
        name: 'slug'
        tableName: 'pages'
        dataType: 'string'
        columnType: 'PgText'
        data: string
        driverParam: string
        notNull: true
        hasDefault: false
        isPrimaryKey: false
        isAutoincrement: false
        hasRuntimeDefault: false
        enumValues: [string, ...string[]]
        baseColumn: never
        identity: undefined
        generated: undefined
      },
      {},
      {}
    >
    path: import('drizzle-orm/pg-core').PgColumn<
      {
        name: 'path'
        tableName: 'pages'
        dataType: 'string'
        columnType: 'PgText'
        data: string
        driverParam: string
        notNull: true
        hasDefault: false
        isPrimaryKey: false
        isAutoincrement: false
        hasRuntimeDefault: false
        enumValues: [string, ...string[]]
        baseColumn: never
        identity: undefined
        generated: undefined
      },
      {},
      {}
    >
    status: import('drizzle-orm/pg-core').PgColumn<
      {
        name: 'status'
        tableName: 'pages'
        dataType: 'string'
        columnType: 'PgText'
        data: string
        driverParam: string
        notNull: true
        hasDefault: true
        isPrimaryKey: false
        isAutoincrement: false
        hasRuntimeDefault: false
        enumValues: [string, ...string[]]
        baseColumn: never
        identity: undefined
        generated: undefined
      },
      {},
      {}
    >
    blocks: import('drizzle-orm/pg-core').PgColumn<
      {
        name: 'blocks'
        tableName: 'pages'
        dataType: 'json'
        columnType: 'PgJsonb'
        data: unknown[]
        driverParam: unknown
        notNull: false
        hasDefault: true
        isPrimaryKey: false
        isAutoincrement: false
        hasRuntimeDefault: false
        enumValues: undefined
        baseColumn: never
        identity: undefined
        generated: undefined
      },
      {},
      {
        $type: unknown[]
      }
    >
    seo: import('drizzle-orm/pg-core').PgColumn<
      {
        name: 'seo'
        tableName: 'pages'
        dataType: 'json'
        columnType: 'PgJsonb'
        data: unknown
        driverParam: unknown
        notNull: false
        hasDefault: false
        isPrimaryKey: false
        isAutoincrement: false
        hasRuntimeDefault: false
        enumValues: undefined
        baseColumn: never
        identity: undefined
        generated: undefined
      },
      {},
      {}
    >
    blockCount: import('drizzle-orm/pg-core').PgColumn<
      {
        name: 'block_count'
        tableName: 'pages'
        dataType: 'number'
        columnType: 'PgInteger'
        data: number
        driverParam: string | number
        notNull: false
        hasDefault: true
        isPrimaryKey: false
        isAutoincrement: false
        hasRuntimeDefault: false
        enumValues: undefined
        baseColumn: never
        identity: undefined
        generated: undefined
      },
      {},
      {}
    >
    wordCount: import('drizzle-orm/pg-core').PgColumn<
      {
        name: 'word_count'
        tableName: 'pages'
        dataType: 'number'
        columnType: 'PgInteger'
        data: number
        driverParam: string | number
        notNull: false
        hasDefault: true
        isPrimaryKey: false
        isAutoincrement: false
        hasRuntimeDefault: false
        enumValues: undefined
        baseColumn: never
        identity: undefined
        generated: undefined
      },
      {},
      {}
    >
    lock: import('drizzle-orm/pg-core').PgColumn<
      {
        name: 'lock'
        tableName: 'pages'
        dataType: 'json'
        columnType: 'PgJsonb'
        data: unknown
        driverParam: unknown
        notNull: false
        hasDefault: false
        isPrimaryKey: false
        isAutoincrement: false
        hasRuntimeDefault: false
        enumValues: undefined
        baseColumn: never
        identity: undefined
        generated: undefined
      },
      {},
      {}
    >
    scheduledAt: import('drizzle-orm/pg-core').PgColumn<
      {
        name: 'scheduled_at'
        tableName: 'pages'
        dataType: 'date'
        columnType: 'PgTimestamp'
        data: Date
        driverParam: string
        notNull: false
        hasDefault: false
        isPrimaryKey: false
        isAutoincrement: false
        hasRuntimeDefault: false
        enumValues: undefined
        baseColumn: never
        identity: undefined
        generated: undefined
      },
      {},
      {}
    >
    createdAt: import('drizzle-orm/pg-core').PgColumn<
      {
        name: 'created_at'
        tableName: 'pages'
        dataType: 'date'
        columnType: 'PgTimestamp'
        data: Date
        driverParam: string
        notNull: true
        hasDefault: true
        isPrimaryKey: false
        isAutoincrement: false
        hasRuntimeDefault: false
        enumValues: undefined
        baseColumn: never
        identity: undefined
        generated: undefined
      },
      {},
      {}
    >
    updatedAt: import('drizzle-orm/pg-core').PgColumn<
      {
        name: 'updated_at'
        tableName: 'pages'
        dataType: 'date'
        columnType: 'PgTimestamp'
        data: Date
        driverParam: string
        notNull: true
        hasDefault: true
        isPrimaryKey: false
        isAutoincrement: false
        hasRuntimeDefault: false
        enumValues: undefined
        baseColumn: never
        identity: undefined
        generated: undefined
      },
      {},
      {}
    >
    publishedAt: import('drizzle-orm/pg-core').PgColumn<
      {
        name: 'published_at'
        tableName: 'pages'
        dataType: 'date'
        columnType: 'PgTimestamp'
        data: Date
        driverParam: string
        notNull: false
        hasDefault: false
        isPrimaryKey: false
        isAutoincrement: false
        hasRuntimeDefault: false
        enumValues: undefined
        baseColumn: never
        identity: undefined
        generated: undefined
      },
      {},
      {}
    >
  }
  dialect: 'pg'
}>
export declare const pageRevisions: import('drizzle-orm/pg-core').PgTableWithColumns<{
  name: 'page_revisions'
  schema: undefined
  columns: {
    id: import('drizzle-orm/pg-core').PgColumn<
      {
        name: 'id'
        tableName: 'page_revisions'
        dataType: 'string'
        columnType: 'PgText'
        data: string
        driverParam: string
        notNull: true
        hasDefault: false
        isPrimaryKey: true
        isAutoincrement: false
        hasRuntimeDefault: false
        enumValues: [string, ...string[]]
        baseColumn: never
        identity: undefined
        generated: undefined
      },
      {},
      {}
    >
    pageId: import('drizzle-orm/pg-core').PgColumn<
      {
        name: 'page_id'
        tableName: 'page_revisions'
        dataType: 'string'
        columnType: 'PgText'
        data: string
        driverParam: string
        notNull: true
        hasDefault: false
        isPrimaryKey: false
        isAutoincrement: false
        hasRuntimeDefault: false
        enumValues: [string, ...string[]]
        baseColumn: never
        identity: undefined
        generated: undefined
      },
      {},
      {}
    >
    createdBy: import('drizzle-orm/pg-core').PgColumn<
      {
        name: 'created_by'
        tableName: 'page_revisions'
        dataType: 'string'
        columnType: 'PgText'
        data: string
        driverParam: string
        notNull: false
        hasDefault: false
        isPrimaryKey: false
        isAutoincrement: false
        hasRuntimeDefault: false
        enumValues: [string, ...string[]]
        baseColumn: never
        identity: undefined
        generated: undefined
      },
      {},
      {}
    >
    revisionNumber: import('drizzle-orm/pg-core').PgColumn<
      {
        name: 'revision_number'
        tableName: 'page_revisions'
        dataType: 'number'
        columnType: 'PgInteger'
        data: number
        driverParam: string | number
        notNull: true
        hasDefault: false
        isPrimaryKey: false
        isAutoincrement: false
        hasRuntimeDefault: false
        enumValues: undefined
        baseColumn: never
        identity: undefined
        generated: undefined
      },
      {},
      {}
    >
    title: import('drizzle-orm/pg-core').PgColumn<
      {
        name: 'title'
        tableName: 'page_revisions'
        dataType: 'string'
        columnType: 'PgText'
        data: string
        driverParam: string
        notNull: true
        hasDefault: false
        isPrimaryKey: false
        isAutoincrement: false
        hasRuntimeDefault: false
        enumValues: [string, ...string[]]
        baseColumn: never
        identity: undefined
        generated: undefined
      },
      {},
      {}
    >
    blocks: import('drizzle-orm/pg-core').PgColumn<
      {
        name: 'blocks'
        tableName: 'page_revisions'
        dataType: 'json'
        columnType: 'PgJsonb'
        data: unknown[]
        driverParam: unknown
        notNull: false
        hasDefault: true
        isPrimaryKey: false
        isAutoincrement: false
        hasRuntimeDefault: false
        enumValues: undefined
        baseColumn: never
        identity: undefined
        generated: undefined
      },
      {},
      {
        $type: unknown[]
      }
    >
    seo: import('drizzle-orm/pg-core').PgColumn<
      {
        name: 'seo'
        tableName: 'page_revisions'
        dataType: 'json'
        columnType: 'PgJsonb'
        data: unknown
        driverParam: unknown
        notNull: false
        hasDefault: false
        isPrimaryKey: false
        isAutoincrement: false
        hasRuntimeDefault: false
        enumValues: undefined
        baseColumn: never
        identity: undefined
        generated: undefined
      },
      {},
      {}
    >
    changeDescription: import('drizzle-orm/pg-core').PgColumn<
      {
        name: 'change_description'
        tableName: 'page_revisions'
        dataType: 'string'
        columnType: 'PgText'
        data: string
        driverParam: string
        notNull: false
        hasDefault: false
        isPrimaryKey: false
        isAutoincrement: false
        hasRuntimeDefault: false
        enumValues: [string, ...string[]]
        baseColumn: never
        identity: undefined
        generated: undefined
      },
      {},
      {}
    >
    createdAt: import('drizzle-orm/pg-core').PgColumn<
      {
        name: 'created_at'
        tableName: 'page_revisions'
        dataType: 'date'
        columnType: 'PgTimestamp'
        data: Date
        driverParam: string
        notNull: true
        hasDefault: true
        isPrimaryKey: false
        isAutoincrement: false
        hasRuntimeDefault: false
        enumValues: undefined
        baseColumn: never
        identity: undefined
        generated: undefined
      },
      {},
      {}
    >
  }
  dialect: 'pg'
}>
export type Page = typeof pages.$inferSelect
export type NewPage = typeof pages.$inferInsert
export type PageRevision = typeof pageRevisions.$inferSelect
export type NewPageRevision = typeof pageRevisions.$inferInsert
//# sourceMappingURL=pages.d.ts.map
