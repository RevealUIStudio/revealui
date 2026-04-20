#!/usr/bin/env tsx

/**
 * Backfill missing rows in drizzle.__drizzle_migrations.
 *
 * Used when SQL was applied out-of-band (manual psql, prior tooling) and the
 * migration journal entries were added retroactively, leaving drizzle-kit's
 * tracking table out of sync with reality. Without backfill, drizzle-kit's
 * migrator either re-applies non-idempotent statements (transaction rolls
 * back) or silently skips later migrations whose `when` is earlier than the
 * last applied row's `created_at`.
 *
 * Reference incident: 2026-04-18 (orphaned 0003/0004/0005); see
 * packages/db/docs/migrations-discipline.md.
 *
 * Usage:
 *   POSTGRES_URL=... tsx src/scripts/backfill-migrations.ts \
 *     --tags=0003_shared_facts,0004_yjs_document_patches,0005_shared_memory_scope
 *
 * Tags are matched against meta/_journal.json. Each tag's row is inserted
 * iff a row with matching `created_at` (= journal `when`) does not already
 * exist. Re-running is a safe no-op once rows are in place.
 */

import crypto from 'node:crypto';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';

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

const here = dirname(fileURLToPath(import.meta.url));
const MIGRATIONS_DIR = join(here, '../../migrations');
const JOURNAL_PATH = join(MIGRATIONS_DIR, 'meta/_journal.json');

function parseTags(): string[] {
  const arg = process.argv.find((a) => a.startsWith('--tags='));
  if (!arg) {
    console.error('error: --tags=<tag1,tag2,...> is required (no implicit backfill)');
    process.exit(2);
  }
  return arg
    .slice('--tags='.length)
    .split(',')
    .map((t) => t.trim())
    .filter(Boolean);
}

function loadJournal(): Journal {
  return JSON.parse(readFileSync(JOURNAL_PATH, 'utf-8'));
}

function hashSql(tag: string): string {
  const sql = readFileSync(join(MIGRATIONS_DIR, `${tag}.sql`), 'utf-8');
  return crypto.createHash('sha256').update(sql).digest('hex');
}

async function main(): Promise<void> {
  const url = process.env.POSTGRES_URL ?? process.env.DATABASE_URL;
  if (!url) {
    console.error('error: POSTGRES_URL or DATABASE_URL must be set');
    process.exit(2);
  }

  const tags = parseTags();
  const journal = loadJournal();
  const byTag = new Map(journal.entries.map((e) => [e.tag, e]));

  for (const tag of tags) {
    if (!byTag.has(tag)) {
      console.error(`error: tag "${tag}" not found in meta/_journal.json`);
      process.exit(2);
    }
  }

  const client = new pg.Client({ connectionString: url });
  await client.connect();

  try {
    await client.query(
      `CREATE TABLE IF NOT EXISTS drizzle.__drizzle_migrations (
        id SERIAL PRIMARY KEY,
        hash text NOT NULL,
        created_at bigint
      )`,
    );

    const existing = await client.query<{ created_at: string }>(
      'SELECT created_at FROM drizzle.__drizzle_migrations',
    );
    const presentWhens = new Set(existing.rows.map((r) => Number(r.created_at)));

    let inserted = 0;
    let skipped = 0;

    for (const tag of tags) {
      const entry = byTag.get(tag)!;
      if (presentWhens.has(entry.when)) {
        console.log(`skip ${tag} (already present at created_at=${entry.when})`);
        skipped += 1;
        continue;
      }
      const hash = hashSql(tag);
      await client.query(
        'INSERT INTO drizzle.__drizzle_migrations ("hash", "created_at") VALUES ($1, $2)',
        [hash, entry.when],
      );
      console.log(`backfilled ${tag} (created_at=${entry.when}, hash=${hash.slice(0, 16)}...)`);
      inserted += 1;
    }

    console.log(`\ndone: ${inserted} inserted, ${skipped} skipped`);
  } finally {
    await client.end();
  }
}

main().catch((err: unknown) => {
  console.error(err instanceof Error ? err.stack : String(err));
  process.exit(1);
});
