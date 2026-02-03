/**
 * Rate Limits and Failed Attempts Tables
 *
 * Tables for storing rate limiting and brute force protection data.
 * Used by the storage abstraction for distributed rate limiting.
 */
export declare const rateLimits: import('drizzle-orm/pg-core').PgTableWithColumns<{
  name: 'rate_limits'
  schema: undefined
  columns: {
    key: import('drizzle-orm/pg-core').PgColumn<
      {
        name: 'key'
        tableName: 'rate_limits'
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
    value: import('drizzle-orm/pg-core').PgColumn<
      {
        name: 'value'
        tableName: 'rate_limits'
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
    resetAt: import('drizzle-orm/pg-core').PgColumn<
      {
        name: 'reset_at'
        tableName: 'rate_limits'
        dataType: 'date'
        columnType: 'PgTimestamp'
        data: Date
        driverParam: string
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
    createdAt: import('drizzle-orm/pg-core').PgColumn<
      {
        name: 'created_at'
        tableName: 'rate_limits'
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
        tableName: 'rate_limits'
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
export declare const failedAttempts: import('drizzle-orm/pg-core').PgTableWithColumns<{
  name: 'failed_attempts'
  schema: undefined
  columns: {
    email: import('drizzle-orm/pg-core').PgColumn<
      {
        name: 'email'
        tableName: 'failed_attempts'
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
    count: import('drizzle-orm/pg-core').PgColumn<
      {
        name: 'count'
        tableName: 'failed_attempts'
        dataType: 'number'
        columnType: 'PgInteger'
        data: number
        driverParam: string | number
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
    lockUntil: import('drizzle-orm/pg-core').PgColumn<
      {
        name: 'lock_until'
        tableName: 'failed_attempts'
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
    windowStart: import('drizzle-orm/pg-core').PgColumn<
      {
        name: 'window_start'
        tableName: 'failed_attempts'
        dataType: 'date'
        columnType: 'PgTimestamp'
        data: Date
        driverParam: string
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
    createdAt: import('drizzle-orm/pg-core').PgColumn<
      {
        name: 'created_at'
        tableName: 'failed_attempts'
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
        tableName: 'failed_attempts'
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
export type RateLimit = typeof rateLimits.$inferSelect
export type NewRateLimit = typeof rateLimits.$inferInsert
export type FailedAttempt = typeof failedAttempts.$inferSelect
export type NewFailedAttempt = typeof failedAttempts.$inferInsert
//# sourceMappingURL=rate-limits.d.ts.map
