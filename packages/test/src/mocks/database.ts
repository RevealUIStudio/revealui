/**
 * Database mocks
 *
 * Provides mocks for database operations
 */

import type { DatabaseAdapter, DatabaseResult } from "@revealui/core/types";

/**
 * Create mock database adapter
 */
export function createMockDatabase(): DatabaseAdapter {
	const mockData: Record<string, unknown[]> = {};

	return {
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

		async query(
			query: string,
			_values: unknown[] = [],
		): Promise<DatabaseResult> {
			// Mock query execution
			// In real implementation, this would parse query and return mock data

			if (query.toLowerCase().trim().startsWith("select")) {
				// Mock SELECT query
				const tableMatch = query.match(/from\s+(\w+)/i);
				if (tableMatch) {
					const tableName = tableMatch[1];
					const rows = mockData[tableName] || [];

					// Apply WHERE clause filtering if needed
					const filteredRows = rows;

					return {
						rows: filteredRows as any[],
						rowCount: filteredRows.length,
					};
				}
			}

			return {
				rows: [],
				rowCount: 0,
			};
		},

		async transaction(callback: () => Promise<void>): Promise<void> {
			// Mock transaction
			await callback();
		},
	} as DatabaseAdapter;
}

/**
 * Set mock data for a table
 */
export function setMockTableData(
	mockDb: DatabaseAdapter,
	tableName: string,
	data: unknown[],
): void {
	(mockDb as any).__mockData = (mockDb as any).__mockData || {};
	(mockDb as any).__mockData[tableName] = data;
}
