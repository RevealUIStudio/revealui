# Vercel env sync — operator runbook

`revvault` is the canonical store for every Vercel-runtime secret in this monorepo. This runbook covers the day-to-day workflow.

## Prerequisites (one-time)

1. **revvault binary** with PR [RevealUIStudio/revvault#40](https://github.com/RevealUIStudio/revvault/pull/40) (per-var path overrides).

   ```bash
   cd ~/revfleet/revvault && cargo install --path crates/cli
   revvault --version  # 0.1.0+ with `vars` table support
   ```

2. **VERCEL_TOKEN** environment variable. Create at [Vercel → Settings → Tokens](https://vercel.com/account/tokens) (scope: project access, `revealuistudio` org). Export from your shell profile:

   ```bash
   export VERCEL_TOKEN=...
   ```

   Or pass `--token` per-command.

3. **Manifest:** [`scripts/sync/revvault-vercel.toml`](../../scripts/sync/revvault-vercel.toml). Drives sync — see comments inside for the schema.

## Common workflows

### Add a new secret

```bash
# 1. Add the value to revvault at its canonical path
revvault set revealui/prod/<subsystem>/<name-kebab>

# 2. Map it in the manifest (scripts/sync/revvault-vercel.toml)
#    Add a [projects.<slug>.vars] entry: VERCEL_VAR_NAME = "revealui/prod/..."

# 3. Dry-run first to see what'd change
pnpm vercel:sync

# 4. Apply
pnpm vercel:sync:apply

# 5. Redeploy the affected Vercel project so the new env hits runtime
```

### Rotate an existing secret

```bash
# 1. Set the new value in revvault (overwrites old)
revvault set <canonical-path> --force

# 2. Dry-run shows it as Update
pnpm vercel:sync

# 3. Apply
pnpm vercel:sync:apply

# 4. Redeploy
```

### Backfill (bootstrap a fresh vault from existing Vercel vars)

There is **no `--pull` command.** `revvault sync` is strictly one-way —
vault → Vercel — as of revvault 0.2.0. The reverse direction was removed
in the durable redesign after the 2026-05-09 corruption incident, where a
Vercel API change caused `--pull` to overwrite canonical vault paths with
ciphertext/empty values. See the revvault `CHANGELOG.md` for the rationale.

Seeding a fresh vault from secrets that currently only exist on Vercel is a
deliberate **one-shot manual operation**, not a recurring sync command — for
each var, read the value out of Vercel and `revvault set` it at its canonical
path. Once the vault holds the value, `pnpm vercel:sync:apply` keeps Vercel in
sync from then on.

### Drift check (read-only)

For CI or pre-deploy validation:

```bash
pnpm vercel:drift-check
```

Outputs JSON describing every variable's diff state per project (Add / Update / Orphan / Skip). Non-blocking — sync drift is a warning, not a build failure.

## What the diff actions mean

| Symbol | Action | Meaning |
|---|---|---|
| `+` | Add | Vault has a value, Vercel doesn't — push will create |
| `~` | Update | Both sides have the value — push will overwrite Vercel from vault |
| `!` | Orphan | Vercel has a value, vault doesn't — manual cleanup needed (sync never deletes from Vercel) |
| `-` | Skip | In manifest's `skip` list — sync never touches |

## Anti-patterns to avoid

- **Editing Vercel env directly via the dashboard** — sync drift inevitable. Always go through revvault + `pnpm vercel:sync:apply`.
- **Storing secrets in `.env.local` or env files committed to git** — pre-commit hook blocks `.env*`; if the hook ever fails, the file becomes the canonical source instead of revvault. Revvault first, always.
- **`pnpm vercel:sync:apply` without a dry-run first** — habit, not a hard rule. Dry-run is the default for a reason.

## When sync goes sideways

| Symptom | Likely cause | Fix |
|---|---|---|
| `Cannot read manifest` | working directory mismatch | run from `~/revfleet/revealui` (root); pnpm scripts handle this |
| `403 Forbidden` from Vercel | `VERCEL_TOKEN` wrong/expired | regenerate token; export new value |
| Var shows as `Add` even though it's already on Vercel | `vault_prefix` mismatch | check the manifest's project block matches the actual Vercel project ID |
| `Orphan` warnings stack up | values added directly via Vercel UI | for each: add to manifest's `vars` table OR add to `skip` list with reason |
| Vault path resolution surprises | `vars` override vs. prefix-derived collision | run `pnpm vercel:sync` (dry-run, JSON mode) and check the resolved paths in the diff |

## Out of scope (deferred to v2)

- Preview + development env target sync — production-only in v1 per [`vercel-env-canonical-mapping.md`](../../../revealui-jv/docs/vercel-env-canonical-mapping.md) Q4
- Per-var Sensitive flag policy — gated on revvault adding `var_type` plumbing per concern C2 in the design doc
- Auto-rotation chain — `revvault rotate <path>` triggering Vercel sync; design doc Phase 5

## See also

- Design doc: [`~/revfleet/.jv/docs/revvault-vercel-sync.md`](https://github.com/RevealUIStudio/revealui-jv/blob/main/docs/revvault-vercel-sync.md)
- Canonical env-var mapping: [`~/revfleet/.jv/docs/vercel-env-canonical-mapping.md`](https://github.com/RevealUIStudio/revealui-jv/blob/main/docs/vercel-env-canonical-mapping.md)
- Secrets rule: [`~/revfleet/.claude/rules/secrets.md`](../../../.claude/rules/secrets.md)
