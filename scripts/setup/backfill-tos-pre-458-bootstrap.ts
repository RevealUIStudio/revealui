/**
 * Backfill tosAcceptedAt for pre-#458 bootstrap admins.
 *
 * Bootstrap admins created before PR #458 have tosAcceptedAt = NULL because
 * the setup flow did not persist TOS acceptance at that time. This script
 * finds those rows and backfills them so the legal record is defensible.
 *
 * Closes #460 (CR-8 audit gap).
 *
 * Dry-run is the default. Pass `--apply` to mutate.
 *
 * Idempotent: a second run finds 0 rows because the WHERE clause filters on
 * tosAcceptedAt IS NULL, which will no longer match after backfill.
 */

import { randomUUID } from 'node:crypto';
import { Pool } from 'pg';

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const APPLY_FLAG = process.argv.includes('--apply');
const DRY_RUN = !APPLY_FLAG;

const TOS_VERSION = process.env.TOS_VERSION ?? '2026-03-01';

function getPostgresUrl(): string {
  const url = process.env.POSTGRES_URL ?? process.env.DATABASE_URL;
  if (!url) {
    process.stderr.write('✗ POSTGRES_URL (or DATABASE_URL) not set\n');
    process.exit(2);
  }
  return url;
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface MatchedUser {
  id: string;
  createdAt: Date;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  const pool = new Pool({
    connectionString: getPostgresUrl(),
    max: 1,
    connectionTimeoutMillis: 10_000,
  });

  try {
    const findResult = await pool.query<MatchedUser>(
      `SELECT id, created_at AS "createdAt"
       FROM users
       WHERE tos_accepted_at IS NULL
         AND role = 'owner'
         AND email_verified = true`,
    );

    const matched = findResult.rows;

    if (matched.length === 0) {
      process.stdout.write('✓ No rows require backfill\n');
      return;
    }

    if (DRY_RUN) {
      process.stdout.write(
        `[dry-run] Would backfill ${matched.length} user(s) with tosAcceptedAt = createdAt, tosVersion = '${TOS_VERSION}'\n`,
      );
      for (const user of matched) {
        process.stdout.write(`  user.id=${user.id} createdAt=${user.createdAt.toISOString()}\n`);
      }
      process.stdout.write('[dry-run] Pass --apply to apply changes\n');
      return;
    }

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      for (const user of matched) {
        await client.query(
          `UPDATE users
           SET tos_accepted_at = $1,
               tos_version     = $2
           WHERE id = $3
             AND tos_accepted_at IS NULL`,
          [user.createdAt, TOS_VERSION, user.id],
        );

        await client.query(
          `INSERT INTO audit_log
             (id, event_type, agent_id, severity, payload)
           VALUES ($1, $2, $3, $4, $5)`,
          [
            randomUUID(),
            'setup:tos-backfill',
            'setup:script:backfill-tos-pre-458-bootstrap',
            'info',
            JSON.stringify({
              userId: user.id,
              previousTosAcceptedAt: null,
              previousTosVersion: null,
              backfilledTosAcceptedAt: user.createdAt.toISOString(),
              backfilledTosVersion: TOS_VERSION,
              rationale: 'CR-8 backfill for pre-#458 bootstrap admin',
              issue: 460,
            }),
          ],
        );
      }

      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }

    const verifyResult = await pool.query<{ count: string }>(
      `SELECT count(*)::text AS count
       FROM users
       WHERE tos_accepted_at IS NULL
         AND role = 'owner'
         AND email_verified = true`,
    );
    const remaining = Number(verifyResult.rows[0]?.count ?? '0');

    if (remaining !== 0) {
      process.stderr.write(
        `✗ Post-apply drift: ${remaining} row(s) still have tosAcceptedAt = NULL\n`,
      );
      process.exit(1);
    }

    process.stdout.write(
      `✓ Backfilled ${matched.length} user(s); 0 rows remain with tosAcceptedAt = NULL\n`,
    );
  } finally {
    await pool.end();
  }
}

main().catch((err) => {
  const msg = err instanceof Error ? err.message : String(err);
  process.stderr.write(`✗ backfill-tos-pre-458-bootstrap failed: ${msg}\n`);
  process.exit(2);
});
