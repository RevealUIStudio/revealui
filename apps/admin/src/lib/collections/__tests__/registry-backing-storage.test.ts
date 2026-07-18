/**
 * Registry backing-storage guard (F7 — table/orphan hygiene).
 *
 * Every collection registered in `allCollections` must have a backing Postgres
 * table whose name equals its slug. The admin storage layer resolves a
 * collection to storage by slug in both tiers:
 *   - the typed-storage bridge (`apps/admin/src/lib/db/typedCollectionStorage.ts`)
 *     keys its handlers by `collection.slug`;
 *   - the dynamic SQL adapter
 *     (`packages/core/src/collections/operations/sqlAdapter.ts`) issues
 *     `... FROM "<slug>"` where the table name IS the slug.
 * Either way, a registered collection whose slug has no matching table renders
 * in the dashboard but throws on every read and write.
 *
 * This test derives the real table set from the Drizzle schema (the same schema
 * the storage bridge reads/writes through) and fails if any registered slug has
 * no matching table — so a future registration without a migration fails CI.
 */

import * as schema from '@revealui/db/schema';
import { getTableName, is, Table } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';
import { allCollections } from '../registry';

function drizzleTableNames(): Set<string> {
  const names = new Set<string>();
  for (const value of Object.values(schema)) {
    if (is(value, Table)) {
      names.add(getTableName(value));
    }
  }
  return names;
}

describe('registry backing-storage invariant', () => {
  const tableNames = drizzleTableNames();

  it('resolves a non-trivial set of Drizzle tables (schema import sanity)', () => {
    expect(tableNames.size).toBeGreaterThan(0);
    expect(tableNames.has('users')).toBe(true);
  });

  it.each(
    allCollections.map((collection) => collection.slug),
  )('registered collection "%s" has a backing table named the same as its slug', (slug) => {
    expect(tableNames.has(slug)).toBe(true);
  });
});
