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

### Exception: Migrations Drizzle Can't Express

Rarely, you need SQL that `drizzle-kit generate` can't produce (complex data backfills, custom triggers, partial indexes with expressions). In that case:

1. Write the `.sql` file
2. **Manually add the journal entry** to `meta/_journal.json` with the correct `idx`, `tag`, and `when` timestamp
3. **Create the snapshot JSON** — copy the previous snapshot as `meta/NNNN_snapshot.json` and update it to reflect the new schema state
4. Commit all three files together
5. **Flag the PR for extra review** — hand-written migrations are a red flag

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

The `migration-journal` validator in `scripts/validate/migration-journal.ts` runs during the CI gate quality phase. It compares SQL file count against journal entry count and fails hard on mismatch, naming the orphaned files explicitly.
