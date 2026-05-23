/**
 * Backfill Migrations (pre-migrate detection guard)
 *
 * Runs BEFORE drizzle-kit migrate. Detects the 2026-04-20 incident
 * class — drizzle.__drizzle_migrations tracking rows missing for
 * journal entries — and surfaces the diff so the deploy fails loud
 * instead of letting drizzle-kit re-apply already-applied migrations
 * and trip a duplicate_object error.
 *
 * Detection-only by default. With `--apply` (NOT YET IMPLEMENTED), it
 * would compute the hash drizzle expects for each missing entry and
 * insert the tracking row directly. Wiring `--apply` requires matching
 * drizzle's exact hash computation; deferred until the first incident
 * where drift recurs and a manual recovery is too painful.
 *
 * Companion to scripts/setup/assert-migration-count.ts (post-migrate
 * count assertion). Both ship together as defense-in-depth.
 *
 * Closes GAP-168 (pre-migrate backfill half).
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

interface TrackingRow {
  id: number;
  hash: string;
  created_at: string; // pg returns BIGINT as text by default
}

const JOURNAL_PATH = join(
  import.meta.dirname ?? '.',
  '../../packages/db/migrations/meta/_journal.json',
);

const APPLY_FLAG = process.argv.includes('--apply');
const DRY_RUN = process.argv.includes('--dry-run') || !APPLY_FLAG;

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

/**
 * Classify prod's tracking rows against the journal. drizzle records
 * `created_at` = each migration's journal `when`, so we match by that
 * timestamp — NOT row count. Count alone can't tell a benign new migration
 * (which a forward deploy SHOULD apply) apart from the 2026-04-20
 * out-of-band-applied-but-untracked drift class.
 *
 *  - synced  : journal and tracking agree.
 *  - pending : the only un-tracked entries are NEWER than every applied
 *              migration — a contiguous tail of new migrations drizzle-kit
 *              migrate will apply forward. SAFE; do NOT block the deploy.
 *  - drift   : a tracking row is missing for a migration OLDER than the newest
 *              applied, or tracking has a row with no journal entry. Re-running
 *              migrate risks re-applying already-applied SQL. BLOCK.
 *
 * Pure + exported for unit testing.
 */
export type DriftClassification =
  | { kind: 'synced' }
  | { kind: 'pending'; pendingTags: string[] }
  | { kind: 'drift'; detail: string };

export function classifyMigrationDrift(
  trackedCreatedAt: number[],
  journalEntries: Array<{ tag: string; when: number }>,
): DriftClassification {
  const trackedSet = new Set(trackedCreatedAt);
  const journalWhenSet = new Set(journalEntries.map((e) => e.when));
  const missing = journalEntries.filter((e) => !trackedSet.has(e.when));
  const orphans = trackedCreatedAt.filter((c) => !journalWhenSet.has(c));

  if (missing.length === 0 && orphans.length === 0) return { kind: 'synced' };

  if (orphans.length > 0) {
    return {
      kind: 'drift',
      detail: `tracking has ${orphans.length} row(s) with no journal entry (created_at=${orphans.join(', ')})`,
    };
  }

  const maxTracked = trackedCreatedAt.length
    ? Math.max(...trackedCreatedAt)
    : Number.NEGATIVE_INFINITY;
  const olderMissing = missing.filter((e) => e.when <= maxTracked);

  if (olderMissing.length === 0) {
    return { kind: 'pending', pendingTags: missing.map((e) => e.tag) };
  }
  return {
    kind: 'drift',
    detail: `missing tracking rows for already-passed migration(s): ${olderMissing
      .map((e) => e.tag)
      .join(', ')} (older than the newest applied row)`,
  };
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
    // First-ever run: drizzle.__drizzle_migrations doesn't exist yet.
    // Nothing to backfill; let drizzle-kit migrate create it.
    const tableCheck = await pool.query<{ exists: boolean }>(`
      SELECT EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_schema = 'drizzle' AND table_name = '__drizzle_migrations'
      ) AS exists
    `);
    if (!tableCheck.rows[0]?.exists) {
      process.stdout.write(
        '✓ drizzle.__drizzle_migrations not yet created; first migrate run will initialize it\n',
      );
      process.exit(0);
    }

    // Pull existing tracking rows.
    const trackingRes = await pool.query<TrackingRow>(
      'SELECT id, hash, created_at FROM drizzle.__drizzle_migrations ORDER BY id',
    );
    const tracked = trackingRes.rows;

    // Match by created_at (= journal `when`), not row count: a benign new
    // migration and the 2026-04-20 out-of-band-untracked drift both show
    // tracked.length < expected, but only the latter must block the deploy.
    const classification = classifyMigrationDrift(
      tracked.map((r) => Number(r.created_at)),
      journal.entries,
    );

    if (classification.kind === 'synced') {
      process.stdout.write(
        `✓ ${tracked.length} tracking rows match ${expected} journal entries; no backfill needed\n`,
      );
      process.exit(0);
    }

    if (classification.kind === 'pending') {
      // Benign forward case: the only un-tracked entries are NEWER than every
      // applied migration — a contiguous tail drizzle-kit migrate will apply
      // next. NOT the 2026-04-20 drift class; do not block the deploy.
      process.stdout.write(
        `✓ ${classification.pendingTags.length} new migration(s) pending; drizzle-kit migrate ` +
          `will apply them: ${classification.pendingTags.join(', ')}\n`,
      );
      process.exit(0);
    }

    // classification.kind === 'drift' — dangerous. Surface the diagnostic.
    process.stderr.write(
      `✗ Drift detected: ${tracked.length} tracking rows vs ${expected} journal entries\n`,
    );
    process.stderr.write(`  ${classification.detail}\n`);
    process.stderr.write('\nJournal entries (expected applied set):\n');
    for (const e of journal.entries) {
      process.stderr.write(`  [idx=${e.idx}] ${e.tag} (when=${e.when})\n`);
    }
    process.stderr.write('\nTracking rows (actually applied set):\n');
    for (const r of tracked) {
      process.stderr.write(
        `  [id=${r.id}] hash=${r.hash.substring(0, 16)}… created_at=${r.created_at}\n`,
      );
    }

    if (DRY_RUN) {
      process.stderr.write(
        '\nThis is the 2026-04-20 incident class.\n' +
          'Recovery: align the tracking table with the journal manually; do NOT let drizzle-kit\n' +
          'migrate run while drift exists or it will attempt to re-apply already-applied SQL\n' +
          'and error with duplicate_object / etc.\n' +
          'See packages/db/docs/migrations-discipline.md for the recovery playbook.\n' +
          '\n' +
          '`--apply` mode (auto-insert missing tracking rows) is NOT YET IMPLEMENTED.\n',
      );
      process.exit(1);
    }

    process.stderr.write('\n--apply mode is not yet implemented; drift surfaced only.\n');
    process.exit(1);
  } finally {
    await pool.end();
  }
}

// Run when invoked directly (not when imported by tests).
const isMainModule = process.argv[1] ? import.meta.url === `file://${process.argv[1]}` : false;
if (isMainModule) {
  main().catch((err) => {
    const msg = err instanceof Error ? err.message : String(err);
    process.stderr.write(`✗ backfill-migrations failed: ${msg}\n`);
    process.exit(2);
  });
}
