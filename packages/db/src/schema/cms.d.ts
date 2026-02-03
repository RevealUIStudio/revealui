/**
 * CMS-specific tables - Posts, Media, and Globals
 *
 * These tables provide content management functionality for the CMS app.
 */
export declare const posts: import('drizzle-orm/pg-core').PgTableWithColumns<{
  name: 'posts'
  schema: undefined
  columns: {
    id: import('drizzle-orm/pg-core').PgColumn<
      {
        name: 'id'
        tableName: 'posts'
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
        tableName: 'posts'
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
    title: import('drizzle-orm/pg-core').PgColumn<
      {
        name: 'title'
        tableName: 'posts'
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
        tableName: 'posts'
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
    excerpt: import('drizzle-orm/pg-core').PgColumn<
      {
        name: 'excerpt'
        tableName: 'posts'
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
    content: import('drizzle-orm/pg-core').PgColumn<
      {
        name: 'content'
        tableName: 'posts'
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
    featuredImageId: import('drizzle-orm/pg-core').PgColumn<
      {
        name: 'featured_image_id'
        tableName: 'posts'
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
    authorId: import('drizzle-orm/pg-core').PgColumn<
      {
        name: 'author_id'
        tableName: 'posts'
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
    status: import('drizzle-orm/pg-core').PgColumn<
      {
        name: 'status'
        tableName: 'posts'
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
    published: import('drizzle-orm/pg-core').PgColumn<
      {
        name: 'published'
        tableName: 'posts'
        dataType: 'boolean'
        columnType: 'PgBoolean'
        data: boolean
        driverParam: boolean
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
    meta: import('drizzle-orm/pg-core').PgColumn<
      {
        name: 'meta'
        tableName: 'posts'
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
    categories: import('drizzle-orm/pg-core').PgColumn<
      {
        name: 'categories'
        tableName: 'posts'
        dataType: 'json'
        columnType: 'PgJsonb'
        data: string[]
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
        $type: string[]
      }
    >
    createdAt: import('drizzle-orm/pg-core').PgColumn<
      {
        name: 'created_at'
        tableName: 'posts'
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
        tableName: 'posts'
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
        tableName: 'posts'
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
export declare const media: import('drizzle-orm/pg-core').PgTableWithColumns<{
  name: 'media'
  schema: undefined
  columns: {
    id: import('drizzle-orm/pg-core').PgColumn<
      {
        name: 'id'
        tableName: 'media'
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
        tableName: 'media'
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
    filename: import('drizzle-orm/pg-core').PgColumn<
      {
        name: 'filename'
        tableName: 'media'
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
    mimeType: import('drizzle-orm/pg-core').PgColumn<
      {
        name: 'mime_type'
        tableName: 'media'
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
    filesize: import('drizzle-orm/pg-core').PgColumn<
      {
        name: 'filesize'
        tableName: 'media'
        dataType: 'number'
        columnType: 'PgInteger'
        data: number
        driverParam: string | number
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
    url: import('drizzle-orm/pg-core').PgColumn<
      {
        name: 'url'
        tableName: 'media'
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
    alt: import('drizzle-orm/pg-core').PgColumn<
      {
        name: 'alt'
        tableName: 'media'
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
    width: import('drizzle-orm/pg-core').PgColumn<
      {
        name: 'width'
        tableName: 'media'
        dataType: 'number'
        columnType: 'PgInteger'
        data: number
        driverParam: string | number
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
    height: import('drizzle-orm/pg-core').PgColumn<
      {
        name: 'height'
        tableName: 'media'
        dataType: 'number'
        columnType: 'PgInteger'
        data: number
        driverParam: string | number
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
    focalPoint: import('drizzle-orm/pg-core').PgColumn<
      {
        name: 'focal_point'
        tableName: 'media'
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
    sizes: import('drizzle-orm/pg-core').PgColumn<
      {
        name: 'sizes'
        tableName: 'media'
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
    uploadedBy: import('drizzle-orm/pg-core').PgColumn<
      {
        name: 'uploaded_by'
        tableName: 'media'
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
        tableName: 'media'
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
        tableName: 'media'
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
export declare const globalHeader: import('drizzle-orm/pg-core').PgTableWithColumns<{
  name: 'global_header'
  schema: undefined
  columns: {
    id: import('drizzle-orm/pg-core').PgColumn<
      {
        name: 'id'
        tableName: 'global_header'
        dataType: 'string'
        columnType: 'PgText'
        data: string
        driverParam: string
        notNull: true
        hasDefault: true
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
        tableName: 'global_header'
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
    navItems: import('drizzle-orm/pg-core').PgColumn<
      {
        name: 'nav_items'
        tableName: 'global_header'
        dataType: 'json'
        columnType: 'PgJsonb'
        data: {
          label: string
          url: string
          newTab?: boolean
          children?: Array<{
            label: string
            url: string
            newTab?: boolean
          }>
        }[]
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
        $type: {
          label: string
          url: string
          newTab?: boolean
          children?: Array<{
            label: string
            url: string
            newTab?: boolean
          }>
        }[]
      }
    >
    logoId: import('drizzle-orm/pg-core').PgColumn<
      {
        name: 'logo_id'
        tableName: 'global_header'
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
        tableName: 'global_header'
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
        tableName: 'global_header'
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
export declare const globalFooter: import('drizzle-orm/pg-core').PgTableWithColumns<{
  name: 'global_footer'
  schema: undefined
  columns: {
    id: import('drizzle-orm/pg-core').PgColumn<
      {
        name: 'id'
        tableName: 'global_footer'
        dataType: 'string'
        columnType: 'PgText'
        data: string
        driverParam: string
        notNull: true
        hasDefault: true
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
        tableName: 'global_footer'
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
    columns: import('drizzle-orm/pg-core').PgColumn<
      {
        name: 'columns'
        tableName: 'global_footer'
        dataType: 'json'
        columnType: 'PgJsonb'
        data: {
          label: string
          links: Array<{
            label: string
            url: string
            newTab?: boolean
          }>
        }[]
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
        $type: {
          label: string
          links: Array<{
            label: string
            url: string
            newTab?: boolean
          }>
        }[]
      }
    >
    copyright: import('drizzle-orm/pg-core').PgColumn<
      {
        name: 'copyright'
        tableName: 'global_footer'
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
    socialLinks: import('drizzle-orm/pg-core').PgColumn<
      {
        name: 'social_links'
        tableName: 'global_footer'
        dataType: 'json'
        columnType: 'PgJsonb'
        data: {
          platform: string
          url: string
        }[]
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
        $type: {
          platform: string
          url: string
        }[]
      }
    >
    createdAt: import('drizzle-orm/pg-core').PgColumn<
      {
        name: 'created_at'
        tableName: 'global_footer'
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
        tableName: 'global_footer'
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
export declare const globalSettings: import('drizzle-orm/pg-core').PgTableWithColumns<{
  name: 'global_settings'
  schema: undefined
  columns: {
    id: import('drizzle-orm/pg-core').PgColumn<
      {
        name: 'id'
        tableName: 'global_settings'
        dataType: 'string'
        columnType: 'PgText'
        data: string
        driverParam: string
        notNull: true
        hasDefault: true
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
        tableName: 'global_settings'
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
    siteName: import('drizzle-orm/pg-core').PgColumn<
      {
        name: 'site_name'
        tableName: 'global_settings'
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
    siteDescription: import('drizzle-orm/pg-core').PgColumn<
      {
        name: 'site_description'
        tableName: 'global_settings'
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
    defaultMeta: import('drizzle-orm/pg-core').PgColumn<
      {
        name: 'default_meta'
        tableName: 'global_settings'
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
    contactEmail: import('drizzle-orm/pg-core').PgColumn<
      {
        name: 'contact_email'
        tableName: 'global_settings'
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
    contactPhone: import('drizzle-orm/pg-core').PgColumn<
      {
        name: 'contact_phone'
        tableName: 'global_settings'
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
    socialProfiles: import('drizzle-orm/pg-core').PgColumn<
      {
        name: 'social_profiles'
        tableName: 'global_settings'
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
    analyticsId: import('drizzle-orm/pg-core').PgColumn<
      {
        name: 'analytics_id'
        tableName: 'global_settings'
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
    features: import('drizzle-orm/pg-core').PgColumn<
      {
        name: 'features'
        tableName: 'global_settings'
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
    createdAt: import('drizzle-orm/pg-core').PgColumn<
      {
        name: 'created_at'
        tableName: 'global_settings'
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
        tableName: 'global_settings'
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
export type Post = typeof posts.$inferSelect
export type NewPost = typeof posts.$inferInsert
export type Media = typeof media.$inferSelect
export type NewMedia = typeof media.$inferInsert
export type GlobalHeader = typeof globalHeader.$inferSelect
export type NewGlobalHeader = typeof globalHeader.$inferInsert
export type GlobalFooter = typeof globalFooter.$inferSelect
export type NewGlobalFooter = typeof globalFooter.$inferInsert
export type GlobalSettings = typeof globalSettings.$inferSelect
export type NewGlobalSettings = typeof globalSettings.$inferInsert
//# sourceMappingURL=cms.d.ts.map
