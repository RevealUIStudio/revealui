/**
 * Integration test for the unreconciled_webhooks migration (0010).
 *
 * Verifies that the freshly-migrated DB has the table and that the
 * partial index is correctly scoped to `WHERE resolved_at IS NULL`.
 *
 * Migration: packages/db/migrations/0010_unreconciled_webhooks.sql
 * Schema: packages/db/src/schema/webhook-reconciliation.ts
 *
 * Context: the table was present in the Drizzle schema + snapshots but
 * had no .sql migration. Fresh DBs (test / new deploys) would fail any
 * query against it. This test runs against PGlite via the createTestDb
 * harness which applies all migrations in order — if the migration is
 * missing or broken, this test fails at harness setup.
 */

import { unreconciledWebhooks } from '@revealui/db/schema';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createTestDb, type TestDb } from '../../utils/drizzle-test-db.js';

describe('unreconciled_webhooks migration (0010)', () => {
  let testDb: TestDb;

  beforeAll(async () => {
    testDb = await createTestDb();
  }, 30_000);

  afterAll(async () => {
    await testDb.close();
  });

  it('creates the unreconciled_webhooks table', async () => {
    const result = await testDb.pglite.query<{ table_name: string }>(
      "SELECT table_name FROM information_schema.tables WHERE table_name = 'unreconciled_webhooks'",
    );
    expect(result.rows).toHaveLength(1);
  });

  it('has all expected columns with correct types', async () => {
    const result = await testDb.pglite.query<{
      column_name: string;
      data_type: string;
      is_nullable: string;
    }>(
      "SELECT column_name, data_type, is_nullable FROM information_schema.columns WHERE table_name = 'unreconciled_webhooks' ORDER BY column_name",
    );
    const columns = Object.fromEntries(
      result.rows.map((r) => [
        r.column_name,
        { type: r.data_type, nullable: r.is_nullable === 'YES' },
      ]),
    );

    expect(columns).toMatchObject({
      event_id: { nullable: false },
      event_type: { nullable: false },
      customer_id: { nullable: true },
      stripe_object_id: { nullable: true },
      object_type: { nullable: true },
      error_trace: { nullable: false },
      created_at: { nullable: false },
      resolved_at: { nullable: true },
      resolved_by: { nullable: true },
    });
  });

  it('has the partial index scoped to unresolved rows', async () => {
    const result = await testDb.pglite.query<{
      indexname: string;
      indexdef: string;
    }>(
      "SELECT indexname, indexdef FROM pg_indexes WHERE tablename = 'unreconciled_webhooks' AND indexname = 'unreconciled_webhooks_unresolved_idx'",
    );
    expect(result.rows).toHaveLength(1);
    // Partial-index predicate preserved.
    expect(result.rows[0]?.indexdef).toMatch(/WHERE .*resolved_at.*IS NULL/i);
  });

  it('accepts inserts via Drizzle', async () => {
    await testDb.drizzle.insert(unreconciledWebhooks).values({
      eventId: 'evt_test_1',
      eventType: 'checkout.session.completed',
      errorTrace: 'test trace',
    });

    const rows = await testDb.pglite.query<{ event_id: string }>(
      "SELECT event_id FROM unreconciled_webhooks WHERE event_id = 'evt_test_1'",
    );
    expect(rows.rows).toHaveLength(1);
  });
});
