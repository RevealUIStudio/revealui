/**
 * Database mocks
 *
 * Provides mocks for database operations
 */

import type {
  DatabaseAdapter,
  DatabaseResult,
  QueryableDatabaseAdapter,
  RevealDocument,
} from '@revealui/core/types';

type MockDatabaseAdapter = DatabaseAdapter & {
  __mockData?: Record<string, unknown[]>;
  close?: () => Promise<void>;
};

/**
 * Create mock database adapter
 */
export function createMockDatabase(): DatabaseAdapter {
  const mockDb: MockDatabaseAdapter = {
    __mockData: {},
    init(): Promise<void> {
      // Mock initialization
      return Promise.resolve();
    },

    connect(): Promise<void> {
      // Mock connection
      return Promise.resolve();
    },

    close(): Promise<void> {
      // Mock close
      return Promise.resolve();
    },

    disconnect(): Promise<void> {
      // Mock disconnect
      return Promise.resolve();
    },

    query(query: string, _values: unknown[] = []): Promise<DatabaseResult> {
      // Mock query execution
      // In real implementation, this would parse query and return mock data
      void _values;

      if (query.toLowerCase().trim().startsWith('select')) {
        // Mock SELECT query
        const tableMatch = query.match(/from\s+(\w+)/i);
        const tableName = tableMatch?.[1];
        if (tableName) {
          const rows = mockDb.__mockData?.[tableName] ?? [];

          // Apply WHERE clause filtering if needed
          const filteredRows = rows;

          return Promise.resolve({
            rows: filteredRows as RevealDocument[],
            rowCount: filteredRows.length,
          });
        }
      }

      return Promise.resolve({
        rows: [],
        rowCount: 0,
      });
    },

    async transaction<T>(fn: (tx: QueryableDatabaseAdapter) => Promise<T>): Promise<T> {
      // Mock transaction — no real connection affinity, just passes the mock
      // itself as the tx client so queries run against the same mock state.
      return await fn(mockDb);
    },
  };

  return mockDb;
}

/**
 * Set mock data for a table
 */
export function setMockTableData(
  mockDb: DatabaseAdapter,
  tableName: string,
  data: unknown[],
): void {
  const adapter = mockDb as MockDatabaseAdapter;
  adapter.__mockData = adapter.__mockData || {};
  adapter.__mockData[tableName] = data;
}
