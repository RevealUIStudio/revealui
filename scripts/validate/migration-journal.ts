/**
 * Migration Journal Validator
 *
 * Hard-fails on patterns that have caused silent drizzle-kit migrate
 * failures in this repo. Each check below corresponds to a specific
 * incident the validator now prevents.
 *
 * Reference incidents:
 *   2026-04-18 — orphaned 0003/0004/0005 SQL files without journal entries.
 *   2026-04-19 — non-idempotent ADD CONSTRAINT in 0005, out-of-order `when`
 *                on 0006. Both produced silent exit-1 with the error eaten
 *                by drizzle-kit's TTY spinner.
 *
 * See packages/db/docs/migrations-discipline.md for full context.
 */

import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { basename, join } from 'node:path';

const MIGRATIONS_DIR = join(import.meta.dirname ?? '.', '../../packages/db/migrations');
const JOURNAL_PATH = join(MIGRATIONS_DIR, 'meta/_journal.json');
const CUSTOM_PATH = join(MIGRATIONS_DIR, 'meta/_custom.json');

export interface JournalEntry {
  idx: number;
  version: string;
  when: number;
  tag: string;
  breakpoints: boolean;
}

export interface Journal {
  version: string;
  dialect: string;
  entries: JournalEntry[];
}

export interface CustomEntry {
  tag: string;
  rationale: string;
  missingSnapshot?: boolean;
  snapshotDebtNote?: string;
}

export interface CustomManifest {
  version: number;
  custom: CustomEntry[];
}

export interface CheckResult {
  ok: boolean;
  errors: string[];
}

/**
 * Tags that drizzle-kit generated as the schema baseline and that contain
 * unguarded `ADD CONSTRAINT` purely because they only ever run against a
 * fresh database. NOT a place to silence the lint for new migrations —
 * additions here require a code-review justification.
 */
const IDEMPOTENCY_LINT_ALLOWLIST = new Set([
  '0000_init',
  '0001_special_logan',
  // Already applied to prod (revealcoin tables dropped 2026-05-23) and tracked;
  // it pre-dates the DROP TABLE idempotency check below and never re-runs.
  // Editing committed-and-applied migration SQL would break drizzle's hash.
  '0016_drop_revealcoin_tables',
]);

export function loadJournal(): Journal {
  return JSON.parse(readFileSync(JOURNAL_PATH, 'utf-8'));
}

/**
 * Loads the hand-written-migration manifest. Missing file is treated as an
 * empty manifest (every migration must be drizzle-kit-generated).
 */
export function loadCustomManifest(): CustomManifest {
  if (!existsSync(CUSTOM_PATH)) return { version: 1, custom: [] };
  return JSON.parse(readFileSync(CUSTOM_PATH, 'utf-8'));
}

export function listSqlTags(): string[] {
  return readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith('.sql'))
    .map((f) => basename(f, '.sql'))
    .sort();
}

/** Every .sql file must have a journal entry. */
export function checkOrphans(sqlTags: string[], journal: Journal): CheckResult {
  const journalTags = new Set(journal.entries.map((e) => e.tag));
  const orphans = sqlTags.filter((tag) => !journalTags.has(tag));
  if (orphans.length === 0) return { ok: true, errors: [] };
  return {
    ok: false,
    errors: [
      `${orphans.length} orphaned SQL file(s) without journal entry: ${orphans.join(', ')}`,
      'Fix: run `pnpm --filter @revealui/db db:generate` (preferred) or manually add journal entries.',
    ],
  };
}

/** Every journal entry must have a corresponding .sql file. */
export function checkGhosts(sqlTags: string[], journal: Journal): CheckResult {
  const sqlSet = new Set(sqlTags);
  const ghosts = journal.entries.filter((e) => !sqlSet.has(e.tag)).map((e) => e.tag);
  if (ghosts.length === 0) return { ok: true, errors: [] };
  return {
    ok: false,
    errors: [
      `${ghosts.length} journal entry/entries without SQL file: ${ghosts.join(', ')}`,
      'Fix: the SQL file was deleted but the journal entry remains.',
    ],
  };
}

/**
 * `when` values, when entries are sorted by `idx`, must be strictly
 * increasing. drizzle-orm's pg-core migrator only applies entries where
 * `when > last_applied_row.created_at`, so any out-of-order `when` causes
 * the affected entry to be silently skipped on every future deploy.
 *
 * Caught the 2026-04-19 incident where 0006.when (Mar 18) was earlier than
 * 0005.when (Mar 22) and would never have applied.
 */
export function checkMonotonicWhen(journal: Journal): CheckResult {
  const sorted = [...journal.entries].sort((a, b) => a.idx - b.idx);
  const errors: string[] = [];
  for (let i = 1; i < sorted.length; i++) {
    const prev = sorted[i - 1]!;
    const curr = sorted[i]!;
    if (curr.when <= prev.when) {
      errors.push(
        `Entry ${curr.tag} (idx ${curr.idx}, when=${curr.when}) is not strictly greater than prior entry ${prev.tag} (idx ${prev.idx}, when=${prev.when}).`,
      );
    }
  }
  if (errors.length === 0) return { ok: true, errors: [] };
  return {
    ok: false,
    errors: [
      ...errors,
      'Fix: bump the offending `when` to be strictly greater than the prior entry. drizzle-orm skips entries with non-monotonic `when` values.',
    ],
  };
}

/**
 * Every journal entry must have a corresponding `meta/<NNNN>_snapshot.json`
 * file. Snapshots are how `drizzle-kit generate` computes the diff for the
 * next migration; missing snapshots break the generate workflow and force
 * hand-written SQL (which then leaves the journal further out of sync).
 *
 * Exempted: tags listed in `meta/_custom.json` with `missingSnapshot: true`.
 * Adding a tag to that allowlist requires a written rationale (enforced by
 * `checkCustomManifestShape`).
 */
export function checkSnapshotPresence(journal: Journal, manifest: CustomManifest): CheckResult {
  const exempt = new Set(
    manifest.custom.filter((c) => c.missingSnapshot === true).map((c) => c.tag),
  );
  const errors: string[] = [];
  for (const entry of journal.entries) {
    if (exempt.has(entry.tag)) continue;
    const idxStr = String(entry.idx).padStart(4, '0');
    const snapshotPath = join(MIGRATIONS_DIR, `meta/${idxStr}_snapshot.json`);
    if (!existsSync(snapshotPath)) {
      errors.push(`Entry ${entry.tag} (idx ${entry.idx}) is missing meta/${idxStr}_snapshot.json.`);
    }
  }
  if (errors.length === 0) return { ok: true, errors: [] };
  return {
    ok: false,
    errors: [
      ...errors,
      'Fix: regenerate the snapshot via `pnpm --filter @revealui/db db:generate`, or — if the migration is intentionally hand-written — add an entry to packages/db/migrations/meta/_custom.json with `missingSnapshot: true` and a rationale.',
    ],
  };
}

/**
 * Every entry in `_custom.json` must:
 *   - reference a tag that exists in the journal
 *   - have a non-trivial `rationale` (>= 16 chars, forces an actual reason)
 *   - have `snapshotDebtNote` if `missingSnapshot: true`
 *
 * The manifest's purpose is to be a paper trail for hand-written migrations.
 * Without these constraints it would silently absorb anything.
 */
export function checkCustomManifestShape(manifest: CustomManifest, journal: Journal): CheckResult {
  const journalTags = new Set(journal.entries.map((e) => e.tag));
  const errors: string[] = [];
  const seen = new Set<string>();

  for (const c of manifest.custom) {
    if (seen.has(c.tag)) {
      errors.push(`Duplicate entry for tag "${c.tag}" in _custom.json.`);
    }
    seen.add(c.tag);

    if (!journalTags.has(c.tag)) {
      errors.push(`_custom.json entry "${c.tag}" has no corresponding journal entry.`);
    }
    if (!c.rationale || c.rationale.trim().length < 16) {
      errors.push(
        `_custom.json entry "${c.tag}" must have a rationale of at least 16 characters explaining why it is hand-written.`,
      );
    }
    if (c.missingSnapshot === true && !c.snapshotDebtNote) {
      errors.push(
        `_custom.json entry "${c.tag}" has missingSnapshot: true but no snapshotDebtNote — describe the regen path or why it is permanent.`,
      );
    }
  }

  if (errors.length === 0) return { ok: true, errors: [] };
  return {
    ok: false,
    errors: [
      ...errors,
      'Fix: see packages/db/docs/migrations-discipline.md for the _custom.json schema.',
    ],
  };
}

/**
 * Collapse every ASCII-whitespace run to a single space and uppercase, so DDL
 * keyword sequences can be matched by plain substring scanning. Regex-free
 * (fleet M2 no-regex rule): tokenize on whitespace, rejoin with one space.
 */
export function normalizeSqlWhitespace(sql: string): string {
  const tokens: string[] = [];
  let cur = '';
  for (const ch of sql) {
    if (ch === ' ' || ch === '\t' || ch === '\n' || ch === '\r' || ch === '\f' || ch === '\v') {
      if (cur) {
        tokens.push(cur);
        cur = '';
      }
    } else {
      cur += ch;
    }
  }
  if (cur) tokens.push(cur);
  return tokens.join(' ').toUpperCase();
}

/**
 * True if `normalized` (from normalizeSqlWhitespace) contains a `DROP <obj>`
 * not immediately guarded by `IF EXISTS`. Regex-free substring scan.
 */
export function hasUnguardedDrop(normalized: string, obj: 'TABLE' | 'INDEX'): boolean {
  const needle = `DROP ${obj} `;
  let idx = normalized.indexOf(needle);
  while (idx !== -1) {
    if (!normalized.slice(idx + needle.length).startsWith('IF EXISTS')) return true;
    idx = normalized.indexOf(needle, idx + needle.length);
  }
  return false;
}

/**
 * Lints SQL for non-idempotent DDL that breaks re-application against an
 * environment where the object already exists (or is already gone).
 *
 * - `ALTER TABLE ... ADD CONSTRAINT` must be wrapped in
 *   `DO $$ BEGIN ... EXCEPTION WHEN duplicate_object THEN NULL; END $$`
 *   (no `ADD CONSTRAINT IF NOT EXISTS` exists in Postgres).
 * - `ALTER TABLE ... DROP CONSTRAINT` must use `IF EXISTS`.
 * - `DROP TABLE` / `DROP INDEX` must use `IF EXISTS` — a re-apply against an
 *   environment where the object is already gone otherwise errors `does not
 *   exist` (the 2026-05-23 0016_drop_revealcoin_tables non-idempotency gap).
 *
 * Caught the 2026-04-19 incident's first bug (unguarded ADD CONSTRAINT in
 * 0005 against a prod that already had the constraint).
 */
export function lintIdempotency(tag: string, sql: string): CheckResult {
  if (IDEMPOTENCY_LINT_ALLOWLIST.has(tag)) return { ok: true, errors: [] };

  // Strip DO $$ BEGIN ... END $$ blocks: anything inside a BEGIN/EXCEPTION
  // block is considered idempotency-wrapped.
  const stripped = sql.replace(/DO\s+\$\$[\s\S]*?END\s+\$\$\s*;?/gi, '');

  const errors: string[] = [];

  if (/ALTER\s+TABLE[\s\S]{1,500}?ADD\s+CONSTRAINT/i.test(stripped)) {
    errors.push(
      `${tag}.sql: ADD CONSTRAINT outside DO $$ BEGIN ... EXCEPTION WHEN duplicate_object THEN NULL; END $$ block.`,
    );
  }

  if (/DROP\s+CONSTRAINT(?!\s+IF\s+EXISTS)/i.test(stripped)) {
    errors.push(`${tag}.sql: DROP CONSTRAINT must use IF EXISTS.`);
  }

  // DROP TABLE / DROP INDEX must guard with IF EXISTS (regex-free per M2; the
  // CONSTRAINT checks above are pre-existing regex debt, not extended here).
  const normalized = normalizeSqlWhitespace(stripped);
  for (const obj of ['TABLE', 'INDEX'] as const) {
    if (hasUnguardedDrop(normalized, obj)) {
      errors.push(`${tag}.sql: DROP ${obj} must use IF EXISTS.`);
    }
  }

  if (errors.length === 0) return { ok: true, errors: [] };
  return {
    ok: false,
    errors: [
      ...errors,
      'Fix: see the idempotency rules table in packages/db/docs/migrations-discipline.md.',
    ],
  };
}

function validate(): void {
  const sqlTags = listSqlTags();
  const journal = loadJournal();
  const manifest = loadCustomManifest();

  const checks: Array<[string, CheckResult]> = [
    ['orphans', checkOrphans(sqlTags, journal)],
    ['ghosts', checkGhosts(sqlTags, journal)],
    ['monotonic-when', checkMonotonicWhen(journal)],
    ['snapshot-presence', checkSnapshotPresence(journal, manifest)],
    ['custom-manifest-shape', checkCustomManifestShape(manifest, journal)],
  ];

  for (const tag of sqlTags) {
    const sql = readFileSync(join(MIGRATIONS_DIR, `${tag}.sql`), 'utf-8');
    checks.push([`idempotency:${tag}`, lintIdempotency(tag, sql)]);
  }

  let failed = false;
  for (const [name, result] of checks) {
    if (!result.ok) {
      failed = true;
      console.error(`\n  migration-journal [${name}]:`);
      for (const err of result.errors) console.error(`    ${err}`);
    }
  }

  if (failed) {
    console.error('\n  See: packages/db/docs/migrations-discipline.md\n');
    process.exit(1);
  }

  console.log(
    `  migration-journal: ${sqlTags.length} SQL files, ${journal.entries.length} journal entries, all checks passed`,
  );
}

// Run when invoked directly (not when imported by tests).
const isMainModule = process.argv[1] ? import.meta.url === `file://${process.argv[1]}` : false;
if (isMainModule) validate();
