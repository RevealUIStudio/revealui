import { createReviewControllerDatabase } from '@revealui/db/review-controller';
import { sql } from 'drizzle-orm';
import { Pool } from 'pg';
import { afterAll, describe, expect, it } from 'vitest';
import { makeMergeIntent, mergeIntentNow } from './__tests__/merge-intent.js';
import { PostgresMergeIntentJournal } from './merge-intent-journal.js';
import { PostgresPublicationCoordinator } from './publication-coordinator.js';
import { PostgresReceiptAuthority } from './receipt-authority.js';

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
        current_setting('server_version_num')::int / 10000 AS postgres_major,
        (SELECT count(*)::int FROM drizzle.__drizzle_migrations) AS migration_count,
        (SELECT json_agg(tablename ORDER BY tablename)
         FROM pg_tables WHERE schemaname = 'public') AS public_tables
    `);

    expect(result.rows[0]).toMatchObject({
      database_name: 'revealui_review_controller_ci',
      postgres_major: 18,
      migration_count: 6,
      public_tables: [
        'review_controller_merge_intents',
        'review_controller_merge_reconciliation_observations',
        'review_controller_receipt_authorizations',
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
        'ci-policy', 'ci-key', repeat('d', 64), '{}', now(), date_trunc('milliseconds', now()) + interval '1 hour'
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
  it('serializes competing runtime sessions through the full publication operation', async () => {
    const url = required('REVIEW_CONTROLLER_TEST_RUNTIME_DATABASE_URL');
    const firstPool = new Pool({ connectionString: url, max: 1 });
    const secondPool = new Pool({
      connectionString: url,
      max: 1,
      application_name: 'receipt-lock-second-fixture',
    });
    let release = () => {};
    let acquired = () => {};
    const hold = new Promise<void>((resolve) => {
      release = resolve;
    });
    const ready = new Promise<void>((resolve) => {
      acquired = resolve;
    });
    const events: string[] = [];
    let first: Promise<void> | undefined;
    let second: Promise<void> | undefined;
    try {
      first = new PostgresPublicationCoordinator(firstPool).run(300, 7, async (assertHeld) => {
        acquired();
        await hold;
        await assertHeld();
        events.push('approval');
      });
      await ready;
      second = new PostgresPublicationCoordinator(secondPool).run(300, 7, async (assertHeld) => {
        await assertHeld();
        events.push('revocation-or-expiry');
      });
      let blocked = false;
      for (let attempt = 0; attempt < 40; attempt++) {
        const result = await owner.db.execute(
          sql`SELECT 1 FROM pg_stat_activity WHERE application_name = 'receipt-lock-second-fixture' AND wait_event_type = 'Lock' AND wait_event = 'advisory'`,
        );
        if (result.rows.length === 1) {
          blocked = true;
          break;
        }
        await new Promise((resolve) => setTimeout(resolve, 25));
      }
      expect(blocked).toBe(true);
      expect(events).toEqual([]);
      release();
      await Promise.all([first, second]);
      expect(events).toEqual(['approval', 'revocation-or-expiry']);
    } finally {
      release();
      await Promise.allSettled([first, second]);
      await Promise.all([firstPool.end(), secondPool.end()]);
    }
  });
  it('enforces generation fencing and narrow authority grants under the real runtime role', async () => {
    const authority = new PostgresReceiptAuthority(runtime.db);
    const rows = await owner.db.execute(
      sql`SELECT expires_at FROM review_controller_signed_receipts WHERE receipt_id = 'ci-receipt'`,
    );
    const value = rows.rows[0]?.expires_at;
    const expiresAt = value instanceof Date ? value : new Date(String(value));
    const first = await authority.begin(1, 1);
    const approval = {
      repositoryId: 1,
      pullRequest: 1,
      generation: first,
      receiptId: 'ci-receipt',
      envelopeSha256: 'd'.repeat(64),
      expiresAt,
    };
    expect(await authority.approve(approval)).toBe(true);
    const second = await authority.begin(1, 1);
    expect(await authority.revoke(1, 1, second)).toBe(true);
    expect(await authority.approve(approval)).toBe(false);
    await expect(
      runtime.db.execute(
        sql`UPDATE review_controller_receipt_authorizations SET generation = 1 WHERE repository_id = 1 AND pull_request = 1`,
      ),
    ).rejects.toMatchObject({ cause: { code: 'P0001' } });
    await expect(
      runtime.db.execute(sql`DELETE FROM review_controller_receipt_authorizations`),
    ).rejects.toMatchObject({ cause: { code: '42501' } });
    await expect(
      runtime.db.execute(
        sql`UPDATE review_controller_receipt_authorizations SET repository_id = 2`,
      ),
    ).rejects.toMatchObject({ cause: { code: '42501' } });
  });

  it('does not grant the deployed runtime access to disabled merge intent tables', async () => {
    const result = await owner.db.execute(sql`
      SELECT has_table_privilege('revealui-review-controller', 'review_controller_merge_intents', 'SELECT') AS can_read,
        has_table_privilege('revealui-review-controller', 'review_controller_merge_intents', 'INSERT') AS can_insert,
        has_table_privilege('revealui-review-controller', 'review_controller_merge_intents', 'UPDATE') AS can_update,
        has_table_privilege('revealui-review-controller', 'review_controller_merge_reconciliation_observations', 'INSERT') AS can_observe
    `);
    expect(result.rows[0]).toEqual({
      can_read: false,
      can_insert: false,
      can_update: false,
      can_observe: false,
    });
    await expect(
      runtime.db.execute(sql`SELECT job_id FROM review_controller_merge_intents`),
    ).rejects.toMatchObject({ cause: { code: '42501' } });
  });

  it('fences validation dispatch across independent PostgreSQL sessions and restart', async () => {
    const left = createReviewControllerDatabase(
      required('REVIEW_CONTROLLER_MIGRATION_DATABASE_URL'),
    );
    const right = createReviewControllerDatabase(
      required('REVIEW_CONTROLLER_MIGRATION_DATABASE_URL'),
    );
    try {
      const a = new PostgresMergeIntentJournal(left.db, () => mergeIntentNow);
      const b = new PostgresMergeIntentJournal(right.db, () => mergeIntentNow);
      const first = makeMergeIntent({
        jobId: '7'.repeat(64),
        baseRef: 'refs/heads/postgres-inert',
      });
      const second = { ...first, jobId: '8'.repeat(64) };
      await a.propose(first);
      await b.propose(second);
      const outcomes = await Promise.allSettled([
        a.recordInertDispatch(first.jobId),
        b.recordInertDispatch(second.jobId),
      ]);
      expect(outcomes.filter((outcome) => outcome.status === 'fulfilled')).toHaveLength(1);
      expect(outcomes.filter((outcome) => outcome.status === 'rejected')).toHaveLength(1);
      expect(
        await new PostgresMergeIntentJournal(
          owner.db,
          () => mergeIntentNow,
        ).quarantineAbandonedDispatches(),
      ).toBe(1);
      await expect(a.recordInertDispatch(first.jobId)).rejects.toThrow();
      await expect(b.recordInertDispatch(second.jobId)).rejects.toThrow();
    } finally {
      await Promise.all([left.close(), right.close()]);
    }
  });
});
