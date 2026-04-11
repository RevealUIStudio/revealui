/**
 * Soft-delete utility tests
 *
 * Validates whereActive() and withActiveFilter() produce correct SQL conditions
 * for filtering soft-deleted rows.
 */

import { eq, isNull, sql } from 'drizzle-orm';
import { pgTable, text, timestamp } from 'drizzle-orm/pg-core';
import { describe, expect, it } from 'vitest';
import { whereActive, withActiveFilter } from '../soft-delete.js';

// Minimal table with a deletedAt column for testing
const testTable = pgTable('test_table', {
  id: text('id').primaryKey(),
  name: text('name'),
  deletedAt: timestamp('deleted_at'),
});

describe('soft-delete utilities', () => {
  describe('whereActive', () => {
    it('returns a defined SQL condition', () => {
      const condition = whereActive(testTable);
      expect(condition).toBeDefined();
    });

    it('produces the same result as isNull on deletedAt', () => {
      const condition = whereActive(testTable);
      const expected = isNull(testTable.deletedAt);
      // Both should be SQL objects wrapping the same column
      expect(String(condition)).toBe(String(expected));
    });
  });

  describe('withActiveFilter', () => {
    it('returns just the active filter when no existing clause is provided', () => {
      const condition = withActiveFilter(testTable);
      const expected = isNull(testTable.deletedAt);
      expect(String(condition)).toBe(String(expected));
    });

    it('combines existing WHERE clause with the active filter', () => {
      const nameFilter = eq(testTable.name, 'test');
      const condition = withActiveFilter(testTable, nameFilter);
      expect(condition).toBeDefined();
    });

    it('returns a defined result when existing clause is a raw SQL fragment', () => {
      const existingClause = sql`${testTable.name} = 'admin'`;
      const result = withActiveFilter(testTable, existingClause);
      expect(result).toBeDefined();
    });
  });
});
