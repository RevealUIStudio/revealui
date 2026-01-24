/**
 * Database mocks
 *
 * Provides mocks for database operations
 */

import type { DatabaseAdapter, DatabaseResult } from '@revealui/core/types'

type MockDatabaseAdapter = DatabaseAdapter & {
  __mockData?: Record<string, unknown[]>
}

/**
 * Create mock database adapter
 */
export function createMockDatabase(): DatabaseAdapter {
  const mockDb: MockDatabaseAdapter = {
    __mockData: {},
    async init(): Promise<void> {
      // Mock initialization
    },

    async connect(): Promise<void> {
      // Mock connection
    },

    async close(): Promise<void> {
      // Mock close
    },

    async disconnect(): Promise<void> {
      // Mock disconnect
    },

    async query(query: string, _values: unknown[] = []): Promise<DatabaseResult> {
      // Mock query execution
      // In real implementation, this would parse query and return mock data

      if (query.toLowerCase().trim().startsWith('select')) {
        // Mock SELECT query
        const tableMatch = query.match(/from\s+(\w+)/i)
        if (tableMatch) {
          const tableName = tableMatch[1]
          const rows = mockDb.__mockData?.[tableName] || []

          // Apply WHERE clause filtering if needed
          const filteredRows = rows

          return {
            rows: filteredRows,
            rowCount: filteredRows.length,
          }
        }
      }

      return {
        rows: [],
        rowCount: 0,
      }
    },

    async transaction(callback: () => Promise<void>): Promise<void> {
      // Mock transaction
      await callback()
    },
  }

  return mockDb
}

/**
 * Set mock data for a table
 */
export function setMockTableData(
  mockDb: DatabaseAdapter,
  tableName: string,
  data: unknown[],
): void {
  const adapter = mockDb as MockDatabaseAdapter
  adapter.__mockData = adapter.__mockData || {}
  adapter.__mockData[tableName] = data
}
