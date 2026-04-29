/**
 * Assert Migration Count (post-migrate guard)
 *
 * Counts rows in drizzle.__drizzle_migrations and compares to the
 * length of packages/db/migrations/meta/_journal.json.entries. Exits
 * non-zero with a clear diagnostic if they diverge, so the deploy
 * step fails loud rather than silently shipping a half-applied state.
 *
 * Companion to scripts/setup/backfill-migrations.ts (which runs
 * BEFORE drizzle-kit migrate to catch pre-existing drift); this
 * script runs AFTER to assert the migrator left the world consistent.
 *
 * Defense-in-depth for the 2026-04-20 incident class. See:
 *   - packages/db/docs/migrations-discipline.md
 *   - scripts/validate/migration-journal.ts (static journal validator)
 *
 * Closes GAP-168 (post-migrate assertion half).
 */

import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { Pool } from 'pg';

interface JournalEntry {
  idx: number;
  version: string;
  when: number;
  tag: string;
  breakpoints: boolean;
}

interface Journal {
  version: string;
  dialect: string;
  entries: JournalEntry[];
}

const JOURNAL_PATH = join(
  import.meta.dirname ?? '.',
  '../../packages/db/migrations/meta/_journal.json',
);

function loadJournal(): Journal {
  if (!existsSync(JOURNAL_PATH)) {
    process.stderr.write(`✗ Journal not found at ${JOURNAL_PATH}\n`);
    process.exit(2);
  }
  return JSON.parse(readFileSync(JOURNAL_PATH, 'utf-8'));
}

function getPostgresUrl(): string {
  const url = process.env.POSTGRES_URL ?? process.env.DATABASE_URL;
  if (!url) {
    process.stderr.write('✗ POSTGRES_URL (or DATABASE_URL) not set\n');
    process.exit(2);
  }
  return url;
}

async function main(): Promise<void> {
  const journal = loadJournal();
  const expected = journal.entries.length;

  const pool = new Pool({
    connectionString: getPostgresUrl(),
    max: 1,
    connectionTimeoutMillis: 10000,
  });

  try {
    // First check the tracking table exists at all. On a virgin DB before
    // the first drizzle-kit migrate has run, drizzle.__drizzle_migrations
    // doesn't exist. In that case "tracked count = 0" is the correct read,
    // not an error.
    const tableCheck = await pool.query<{ exists: boolean }>(`
      SELECT EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_schema = 'drizzle' AND table_name = '__drizzle_migrations'
      ) AS exists
    `);
    const tableExists = tableCheck.rows[0]?.exists === true;

    let tracked = 0;
    if (tableExists) {
      const countRes = await pool.query<{ count: string }>(
        'SELECT COUNT(*)::text AS count FROM drizzle.__drizzle_migrations',
      );
      tracked = Number.parseInt(countRes.rows[0]?.count ?? '0', 10);
    }

    if (tracked === expected) {
      process.stdout.write(
        `✓ Migration count consistent: ${tracked} tracked rows match ${expected} journal entries\n`,
      );
      process.exit(0);
    }

    process.stderr.write(
      `✗ Migration count mismatch: ${tracked} rows in drizzle.__drizzle_migrations vs ${expected} entries in _journal.json\n`,
    );
    process.stderr.write(`  Journal tags: ${journal.entries.map((e) => e.tag).join(', ')}\n`);
    process.stderr.write(
      '  This indicates a half-applied migrate or out-of-band schema drift.\n' +
        '  Investigate before proceeding — the deployment may be in an inconsistent state.\n' +
        '  See packages/db/docs/migrations-discipline.md for recovery patterns.\n',
    );
    process.exit(1);
  } finally {
    await pool.end();
  }
}

main().catch((err) => {
  const msg = err instanceof Error ? err.message : String(err);
  process.stderr.write(`✗ assert-migration-count failed: ${msg}\n`);
  process.exit(2);
});
