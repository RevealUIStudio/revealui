/**
 * Node ID Mappings Table
 *
 * Stores mappings between entity IDs (session/user) and their deterministic node IDs.
 * Used for CRDT operations to ensure consistent node IDs across requests.
 *
 * Strategy: Hybrid approach
 * - Primary: SHA-256 hash of entityId (deterministic, fast)
 * - Fallback: Database lookup for collision resolution and manual management
 */
export declare const nodeIdMappings: import('drizzle-orm/pg-core').PgTableWithColumns<{
  name: 'node_id_mappings'
  schema: undefined
  columns: {
    id: import('drizzle-orm/pg-core').PgColumn<
      {
        name: 'id'
        tableName: 'node_id_mappings'
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
    entityType: import('drizzle-orm/pg-core').PgColumn<
      {
        name: 'entity_type'
        tableName: 'node_id_mappings'
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
    entityId: import('drizzle-orm/pg-core').PgColumn<
      {
        name: 'entity_id'
        tableName: 'node_id_mappings'
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
    nodeId: import('drizzle-orm/pg-core').PgColumn<
      {
        name: 'node_id'
        tableName: 'node_id_mappings'
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
    createdAt: import('drizzle-orm/pg-core').PgColumn<
      {
        name: 'created_at'
        tableName: 'node_id_mappings'
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
        tableName: 'node_id_mappings'
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
export type NodeIdMapping = typeof nodeIdMappings.$inferSelect
export type NewNodeIdMapping = typeof nodeIdMappings.$inferInsert
//# sourceMappingURL=node-ids.d.ts.map
