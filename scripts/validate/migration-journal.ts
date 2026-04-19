/**
 * Migration Journal Validator
 *
 * Ensures every .sql file in packages/db/migrations/ has a corresponding
 * entry in meta/_journal.json. Prevents the silent exit-1 failure mode
 * where drizzle-kit sees orphaned SQL files and fails without diagnostics.
 *
 * Incident reference: 2026-04-18 (orphaned 0003/0004/0005 migrations).
 * See packages/db/docs/migrations-discipline.md for full context.
 */

import { readdirSync, readFileSync } from 'node:fs';
import { join, basename } from 'node:path';

const MIGRATIONS_DIR = join(import.meta.dirname ?? '.', '../../packages/db/migrations');
const JOURNAL_PATH = join(MIGRATIONS_DIR, 'meta/_journal.json');

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

function validate(): void {
  // Collect SQL file tags (filenames without .sql extension)
  const sqlFiles = readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith('.sql'))
    .map((f) => basename(f, '.sql'))
    .sort();

  // Parse journal
  const journalRaw = readFileSync(JOURNAL_PATH, 'utf-8');
  const journal: Journal = JSON.parse(journalRaw);
  const journalTags = new Set(journal.entries.map((e) => e.tag));

  // Find orphaned SQL files (no journal entry)
  const orphaned = sqlFiles.filter((tag) => !journalTags.has(tag));

  // Find ghost journal entries (no SQL file)
  const sqlTagSet = new Set(sqlFiles);
  const ghosts = journal.entries.filter((e) => !sqlTagSet.has(e.tag)).map((e) => e.tag);

  let failed = false;

  if (orphaned.length > 0) {
    console.error(
      `\n  migration-journal: ${orphaned.length} orphaned SQL file(s) without journal entry:`,
    );
    for (const tag of orphaned) {
      console.error(`    - ${tag}.sql`);
    }
    console.error(
      '  Fix: either run `pnpm --filter @revealui/db db:generate` or manually add journal entries.',
    );
    console.error('  See: packages/db/docs/migrations-discipline.md\n');
    failed = true;
  }

  if (ghosts.length > 0) {
    console.error(
      `\n  migration-journal: ${ghosts.length} journal entry/entries without SQL file:`,
    );
    for (const tag of ghosts) {
      console.error(`    - ${tag}`);
    }
    console.error('  Fix: the SQL file was deleted but the journal entry remains.\n');
    failed = true;
  }

  if (failed) {
    process.exit(1);
  }

  console.log(
    `  migration-journal: ${sqlFiles.length} SQL files, ${journalTags.size} journal entries — OK`,
  );
}

validate();
