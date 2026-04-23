# Migration Discipline

How database migrations work in this monorepo, and the rules that prevent silent failures.

## Canonical Flow

All migrations follow this sequence:

```bash
# 1. Edit the Drizzle schema
#    packages/db/src/schema/*.ts

# 2. Generate the migration (creates BOTH the .sql AND the journal entry)
cd ~/suite/revealui && pnpm --filter @revealui/db db:generate

# 3. Review the generated files
#    packages/db/migrations/NNNN_<name>.sql   — the DDL
#    packages/db/migrations/meta/_journal.json — updated entry list
#    packages/db/migrations/meta/NNNN_snapshot.json — schema snapshot

# 4. Apply locally
cd ~/suite/revealui && pnpm db:migrate

# 5. Commit all generated files together
git add packages/db/migrations/
git commit -m "feat(db): add <description>"
```

`drizzle-kit generate` always emits the SQL file, the journal entry, and the snapshot as an atomic set. Never create one without the others.

## Hand-Written SQL Is Forbidden

Do not create `.sql` files manually in `packages/db/migrations/`. The migration runner (`drizzle-kit migrate`) reconciles SQL files against `meta/_journal.json`. An SQL file without a matching journal entry causes a **silent exit code 1** — no error message, no named file, no diagnostic output.

### Incident: 2026-04-18

Migrations `0003_shared_facts.sql`, `0004_yjs_document_patches.sql`, and `0005_shared_memory_scope.sql` were hand-written and committed without journal entries. `pnpm db:migrate` silently failed in CI. Debugging took a significant chunk of session time before the mismatch was located by comparing `ls migrations/*.sql | wc -l` against `_journal.json` entry count.

Fix: journal entries were retrofitted manually. This document exists to prevent the next occurrence.

### Incident: 2026-04-19 (follow-on)

The retroactive journal entries from 2026-04-18 surfaced two more failure modes the next time `drizzle-kit migrate` ran against production:

1. **Non-idempotent `ADD CONSTRAINT` in `0005_shared_memory_scope.sql`.** Production already had `agent_memories_scope_check` (applied out-of-band before the journal was retrofitted). Postgres has no `ADD CONSTRAINT IF NOT EXISTS` form, so the re-apply attempt threw `duplicate_object`, the migrator's transaction rolled back, `drizzle-kit` exited 1, and the message was eaten by the TTY spinner.
2. **Out-of-order `when` on `0006_must_rotate_password`.** Journal `when=1776579007043` was earlier than `0005.when=1776912000000`. The drizzle-orm migrator (`pg-core/dialect.js`) only applies entries where `when > last_applied_row.created_at`, so even with #1 fixed, **0006 would have been silently skipped on every future deploy** — the `must_rotate_password` column would never reach prod.

Fixes (PR1, [#434](https://github.com/RevealUIStudio/revealui/pull/434)):
- `0005` `ADD CONSTRAINT` wrapped in `DO $$ BEGIN ... EXCEPTION WHEN duplicate_object THEN NULL; END $$`.
- `0006.when` corrected to `1776912000001` (strictly greater than `0005.when`).

Production recovery: `__drizzle_migrations` rows for 0003/0004/0005 backfilled via `pnpm --filter @revealui/db db:backfill-migrations -- --tags=...` (see "Recovering from out-of-band SQL" below). Three rows inserted; idempotent re-run verified.

Prevention (PR2): the validator now hard-fails on monotonic-`when` violations, missing snapshots, and unguarded `ADD CONSTRAINT` / `DROP CONSTRAINT`. `deploy.yml`'s `Run migrations` step now strips carriage returns from drizzle-kit output so spinner-eaten errors are visible.

### Idempotency Rules for Hand-Written SQL

Whenever a migration touches an object that *might* already exist in the target environment (anything outside a fresh schema), the DDL must be idempotent:

| DDL | Idempotent form |
|---|---|
| `CREATE TABLE` | `CREATE TABLE IF NOT EXISTS` |
| `ALTER TABLE ... ADD COLUMN` | `ALTER TABLE ... ADD COLUMN IF NOT EXISTS` |
| `CREATE INDEX` | `CREATE INDEX IF NOT EXISTS` |
| `CREATE TRIGGER` | `CREATE OR REPLACE TRIGGER` (PG14+) |
| `CREATE FUNCTION` | `CREATE OR REPLACE FUNCTION` |
| `ALTER TABLE ... ADD CONSTRAINT` | `DO $$ BEGIN ALTER TABLE ... ADD CONSTRAINT ...; EXCEPTION WHEN duplicate_object THEN NULL; END $$;` |
| `DROP TABLE / INDEX / CONSTRAINT` | `... IF EXISTS` |

Prod state can drift from journal state for many reasons (manual psql, prior tooling, partial rollback). Idempotent DDL converges on re-apply; non-idempotent DDL leaves prod stuck.

The validator (`scripts/validate/migration-journal.ts`) hard-fails any new migration that uses `ADD CONSTRAINT` outside a `DO $$ BEGIN ... END $$` block or `DROP CONSTRAINT` without `IF EXISTS`. Other DDL forms above rely on convention; PR3 will broaden coverage via the `drizzle-kit generate` parity check.

### Recovering from Out-of-Band SQL

When SQL has been applied to a target environment outside the migrator (manual `psql`, prior tooling, partial rollback), the schema is correct but `drizzle.__drizzle_migrations` is missing rows. The next migrator run will then re-apply the SQL and either succeed (if idempotent) or fail (if not — see 2026-04-19).

Recovery procedure:

```bash
cd ~/suite/revealui

# 1. Pull the production POSTGRES_URL
vercel env pull .vercel/.env.production.local --environment=production
set -a; . .vercel/.env.production.local; set +a

# 2. Confirm what's actually in prod's tracking table (read-only)
psql "$POSTGRES_URL" -c \
  "SELECT id, hash, created_at FROM drizzle.__drizzle_migrations ORDER BY id"

# 3. Backfill the missing rows (explicit tag list — never implicit)
pnpm --filter @revealui/db db:backfill-migrations -- \
  --tags=0003_shared_facts,0004_yjs_document_patches,0005_shared_memory_scope

# 4. Re-run drizzle-kit migrate to apply anything new
pnpm --filter @revealui/db db:migrate
```

The script (`packages/db/src/scripts/backfill-migrations.ts`) is idempotent — re-running after rows exist is a no-op. It only inserts rows whose `created_at` is not already present in the table. Tag list is required; there is no implicit "backfill everything missing" mode (the script cannot infer which SQL files have actually been applied to a given environment).

### Exception: Migrations Drizzle Can't Express

Rarely, you need SQL that `drizzle-kit generate` can't produce (complex data backfills, custom triggers, partial indexes with expressions, vector indexes, etc). In that case:

1. Write the `.sql` file (idempotent per the rules table above).
2. **Manually add the journal entry** to `meta/_journal.json` with the correct `idx`, `tag`, and `when` timestamp (strictly greater than the prior entry's `when`).
3. **Create the snapshot JSON** — copy the previous snapshot as `meta/NNNN_snapshot.json` and update it to reflect the new schema state. If you genuinely cannot (the migration adds objects Drizzle's DSL doesn't model — triggers, vector indexes), you may set `missingSnapshot: true` in the manifest entry below.
4. **Add an entry to `meta/_custom.json`** declaring intent (see schema below). The validator hard-fails if a journal entry is missing a snapshot AND has no manifest entry.
5. Commit all four files together.
6. **Flag the PR for extra review** — hand-written migrations are a red flag.

#### `meta/_custom.json` schema

```json
{
  "version": 1,
  "doc": "Allowlist of migrations whose SQL was NOT produced by drizzle-kit generate.",
  "custom": [
    {
      "tag": "0042_some_hand_written_migration",
      "rationale": "Why drizzle-kit generate could not produce this. Must be >= 16 chars and a real reason a reviewer would accept.",
      "missingSnapshot": false,
      "snapshotDebtNote": "Required if missingSnapshot is true; describe the regen path or why the absence is permanent."
    }
  ]
}
```

The validator (`scripts/validate/migration-journal.ts`) enforces:
- Every entry's `tag` references a real journal entry.
- `rationale` is at least 16 characters (forces an actual reason).
- If `missingSnapshot: true`, `snapshotDebtNote` is required.
- No duplicate `tag` entries.

## Diagnostic: Silent Exit 1

If `pnpm db:migrate` exits 1 with no useful output:

```bash
# Count SQL files
ls packages/db/migrations/*.sql | wc -l

# Count journal entries
cat packages/db/migrations/meta/_journal.json | python3 -c \
  "import json,sys; j=json.load(sys.stdin); print(len(j['entries']))"

# Mismatch = the bug. Find the orphan:
diff <(ls packages/db/migrations/*.sql | xargs -I{} basename {} .sql | sort) \
     <(cat packages/db/migrations/meta/_journal.json | python3 -c \
       "import json,sys; [print(e['tag']) for e in json.load(sys.stdin)['entries']]" | sort)
```

## CI Validation

The `migration-journal` validator in `scripts/validate/migration-journal.ts` runs during the CI gate quality phase. It hard-fails on any of:

| Check | Catches |
|---|---|
| `orphans` | `.sql` files without a journal entry (2026-04-18 incident) |
| `ghosts` | Journal entries without a `.sql` file (deleted SQL not removed from journal) |
| `monotonic-when` | Journal `when` not strictly increasing across `idx` order (2026-04-19 bug #2 — drizzle-orm silently skips entries with non-monotonic `when`) |
| `snapshot-presence` | Journal entry without `meta/<NNNN>_snapshot.json` (breaks `drizzle-kit generate` for the next migration). Exempted only by entries in `meta/_custom.json` with `missingSnapshot: true`. |
| `custom-manifest-shape` | `meta/_custom.json` entries must reference real journal tags, have a non-trivial rationale, declare `snapshotDebtNote` when `missingSnapshot: true`, and not duplicate tags. |
| `idempotency` | Per-`.sql`: unguarded `ADD CONSTRAINT` or `DROP CONSTRAINT` without `IF EXISTS` (2026-04-19 bug #1) |

The deploy workflow's existing `Validate Migrations` job runs `drizzle-kit generate` against the current schema and fails if it produces any uncommitted output — i.e., if a TS schema edit landed without an accompanying generated migration. That gate plus `_custom.json` together close the hand-written-without-journal-entry loop: any new SQL file must either be drizzle-generated (caught by the parity check on schema drift) or explicitly declared in `_custom.json` (caught by the manifest-shape check at PR time).
