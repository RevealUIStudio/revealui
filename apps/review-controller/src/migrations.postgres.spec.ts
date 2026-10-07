import { createReviewControllerDatabase } from '@revealui/db/review-controller';
import { sql } from 'drizzle-orm';
import { afterAll, describe, expect, it } from 'vitest';

function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is required for the PostgreSQL migration contract`);
  return value;
}

const owner = createReviewControllerDatabase(required('REVIEW_CONTROLLER_MIGRATION_DATABASE_URL'));
const runtime = createReviewControllerDatabase(
  required('REVIEW_CONTROLLER_TEST_RUNTIME_DATABASE_URL'),
);

afterAll(async () => {
  await Promise.all([owner.close(), runtime.close()]);
});

describe('isolated Review Controller migration on PostgreSQL', () => {
  it('applies exactly the controller journal to a dedicated database', async () => {
    const result = await owner.db.execute(sql`
      SELECT current_database() AS database_name,
        (SELECT count(*)::int FROM drizzle.__drizzle_migrations) AS migration_count,
        (SELECT json_agg(tablename ORDER BY tablename)
         FROM pg_tables WHERE schemaname = 'public') AS public_tables
    `);

    expect(result.rows[0]).toMatchObject({
      database_name: 'revealui_review_controller_ci',
      migration_count: 3,
      public_tables: [
        'review_controller_shadow_observations',
        'review_controller_signed_receipts',
        'review_controller_webhook_inbox',
      ],
    });
  });

  it('grants only inbox processing and append-only evidence access to the runtime role', async () => {
    const result = await owner.db.execute(sql`
      SELECT
        has_schema_privilege('revealui-review-controller', 'public', 'USAGE') AS schema_usage,
        has_schema_privilege('revealui-review-controller', 'public', 'CREATE') AS schema_create,
        has_database_privilege('revealui-review-controller', current_database(), 'CREATE') AS database_create,
        has_table_privilege('revealui-review-controller', 'review_controller_webhook_inbox', 'SELECT') AS inbox_select,
        has_table_privilege('revealui-review-controller', 'review_controller_webhook_inbox', 'INSERT') AS inbox_insert,
        has_column_privilege('revealui-review-controller', 'review_controller_webhook_inbox', 'state', 'UPDATE') AS inbox_state_update,
        has_column_privilege('revealui-review-controller', 'review_controller_webhook_inbox', 'payload', 'UPDATE') AS inbox_payload_update,
        has_table_privilege('revealui-review-controller', 'review_controller_shadow_observations', 'SELECT') AS observations_select,
        has_table_privilege('revealui-review-controller', 'review_controller_shadow_observations', 'INSERT') AS observations_insert,
        has_table_privilege('revealui-review-controller', 'review_controller_shadow_observations', 'UPDATE') AS observations_update,
        has_table_privilege('revealui-review-controller', 'review_controller_signed_receipts', 'SELECT') AS receipts_select,
        has_table_privilege('revealui-review-controller', 'review_controller_signed_receipts', 'INSERT') AS receipts_insert,
        has_table_privilege('revealui-review-controller', 'review_controller_signed_receipts', 'DELETE') AS receipts_delete
    `);

    expect(result.rows[0]).toMatchObject({
      schema_usage: true,
      schema_create: false,
      database_create: false,
      inbox_select: true,
      inbox_insert: true,
      inbox_state_update: true,
      inbox_payload_update: false,
      observations_select: true,
      observations_insert: true,
      observations_update: false,
      receipts_select: true,
      receipts_insert: true,
      receipts_delete: false,
    });

    await expect(
      runtime.db.execute(sql`CREATE TABLE review_controller_forbidden (id integer)`),
    ).rejects.toMatchObject({ cause: { code: '42501' } });
    await expect(
      runtime.db.execute(sql`UPDATE review_controller_webhook_inbox SET payload = '{}'::jsonb`),
    ).rejects.toMatchObject({ cause: { code: '42501' } });
  });

  it('allows runtime receipt append but rejects mutation even by the migration owner', async () => {
    await runtime.db.execute(sql`
      INSERT INTO review_controller_signed_receipts (
        receipt_id, repository_id, pull_request, head_sha, base_sha, candidate_tree_sha,
        policy_version, key_id, envelope_sha256, canonical_envelope, issued_at, expires_at
      ) VALUES (
        'ci-receipt', 1, 1, repeat('a', 40), repeat('b', 40), repeat('c', 40),
        'ci-policy', 'ci-key', repeat('d', 64), '{}', now(), now() + interval '1 hour'
      )
    `);

    await expect(
      runtime.db.execute(
        sql`DELETE FROM review_controller_signed_receipts WHERE receipt_id = 'ci-receipt'`,
      ),
    ).rejects.toMatchObject({ cause: { code: '42501' } });
    await expect(
      owner.db.execute(
        sql`UPDATE review_controller_signed_receipts SET key_id = 'changed' WHERE receipt_id = 'ci-receipt'`,
      ),
    ).rejects.toMatchObject({
      cause: { code: 'P0001', message: 'signed review receipts are append-only' },
    });
  });
});
