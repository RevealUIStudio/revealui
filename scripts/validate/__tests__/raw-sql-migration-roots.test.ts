import { describe, expect, it } from 'vitest';
import { isSqlMigrationFile } from '../raw-sql-migration-roots.js';

describe('raw SQL migration roots', () => {
  it('recognizes the product and isolated controller Drizzle journals', () => {
    expect(isSqlMigrationFile('packages/db/migrations/0053_review_controller_store.sql')).toBe(
      true,
    );
    expect(isSqlMigrationFile('apps/review-controller/migrations/0002_runtime_grants.sql')).toBe(
      true,
    );
  });

  it('keeps standalone SQL outside the maintained migration roots blocked', () => {
    expect(isSqlMigrationFile('apps/server/scripts/manual-grant.sql')).toBe(false);
    expect(isSqlMigrationFile('scripts/setup/temporary.sql')).toBe(false);
  });
});
