import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { PGlite } from '@electric-sql/pglite';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

const runtimeRole = 'revealui-review-controller';
const migrationFiles = [
  '0000_review_controller_store.sql',
  '0001_review_controller_receipt_immutable.sql',
  '0002_review_controller_runtime_grants.sql',
];

describe('review-controller migration scope and runtime grants', () => {
  let database: PGlite;

  beforeAll(async () => {
    database = new PGlite();
    await database.exec(`CREATE ROLE "${runtimeRole}" WITH LOGIN`);
    const migrationDirectory = resolve(process.cwd(), 'migrations');
    for (const filename of migrationFiles) {
      await database.exec(await readFile(resolve(migrationDirectory, filename), 'utf8'));
    }
  });

  afterAll(async () => {
    await database.close();
  });

  it('grants only the controller runtime operations and keeps evidence append-only', async () => {
    const result = await database.query<{
      schema_usage: boolean;
      schema_create: boolean;
      inbox_select: boolean;
      inbox_insert: boolean;
      inbox_state_update: boolean;
      inbox_payload_update: boolean;
      observations_select: boolean;
      observations_insert: boolean;
      observations_update: boolean;
      receipts_select: boolean;
      receipts_insert: boolean;
      receipts_delete: boolean;
      elevated_membership: boolean;
    }>(`
      SELECT
        has_schema_privilege('${runtimeRole}', 'public', 'USAGE') AS schema_usage,
        has_schema_privilege('${runtimeRole}', 'public', 'CREATE') AS schema_create,
        has_table_privilege('${runtimeRole}', 'review_controller_webhook_inbox', 'SELECT') AS inbox_select,
        has_table_privilege('${runtimeRole}', 'review_controller_webhook_inbox', 'INSERT') AS inbox_insert,
        has_column_privilege('${runtimeRole}', 'review_controller_webhook_inbox', 'state', 'UPDATE') AS inbox_state_update,
        has_column_privilege('${runtimeRole}', 'review_controller_webhook_inbox', 'payload', 'UPDATE') AS inbox_payload_update,
        has_table_privilege('${runtimeRole}', 'review_controller_shadow_observations', 'SELECT') AS observations_select,
        has_table_privilege('${runtimeRole}', 'review_controller_shadow_observations', 'INSERT') AS observations_insert,
        has_table_privilege('${runtimeRole}', 'review_controller_shadow_observations', 'UPDATE') AS observations_update,
        has_table_privilege('${runtimeRole}', 'review_controller_signed_receipts', 'SELECT') AS receipts_select,
        has_table_privilege('${runtimeRole}', 'review_controller_signed_receipts', 'INSERT') AS receipts_insert,
        has_table_privilege('${runtimeRole}', 'review_controller_signed_receipts', 'DELETE') AS receipts_delete,
        EXISTS (
          SELECT 1
          FROM pg_auth_members membership
          JOIN pg_roles member_role ON member_role.oid = membership.member
          WHERE member_role.rolname = '${runtimeRole}'
        ) AS elevated_membership
    `);

    expect(result.rows[0]).toEqual({
      schema_usage: true,
      schema_create: false,
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
      elevated_membership: false,
    });
  });

  it('refuses to install runtime grants after any role membership is added', async () => {
    await database.exec('CREATE ROLE review_controller_parent');
    await database.exec(`GRANT review_controller_parent TO "${runtimeRole}"`);
    const grantsMigration = await readFile(
      resolve(process.cwd(), 'migrations/0002_review_controller_runtime_grants.sql'),
      'utf8',
    );

    await expect(database.exec(grantsMigration)).rejects.toThrow(
      'review_controller_runtime_role_has_role_membership',
    );
  });
});
