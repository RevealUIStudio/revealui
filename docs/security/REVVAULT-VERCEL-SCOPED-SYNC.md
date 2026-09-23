# Revvault → Vercel scoped sync (GAP-339)

Unscoped `revvault sync vercel --apply` rewrites **every** sensitive var the
manifest knows about. Vercel does not return secret values for comparison, so
those rows show `~` even when unchanged. If any vault path still holds a
non-prod value (especially `REVEALUI_LICENSE_PRIVATE_KEY`), a blanket apply can
brick hosted license verification.

## Owner apply list (2026-09-23)

Live check: Vercel project env list with `decrypt=false` on team
`joshuas-projects-c07004e7`. Names, targets, and Vercel types only. This pass
did not run `revvault sync vercel --apply`, did not write env, and did not
decrypt values. `pnpm secret-path:drift:live` no-ops without the private
`ops/sync` inventory, so the comparison is the Vercel production name list
against `scripts/sync/secret-paths.ts` and the `KNOWN_DRIFT` orphan rows in
`scripts/sync/secret-path-drift.ts`.

These two production names are the tracked unvaulted pair (Vercel-only flags
whose vault reconciliation is still open). Both are present on the production
target.

| Env | Vercel project | Project id | Live targets | Vercel type | Vault path |
|-----|----------------|------------|--------------|-------------|------------|
| `REVEALUI_SIGNUP_OPEN` | `revealui-admin` | `prj_7sEFDg4MH6C26nJPjrukK86QdwfG` | production, preview | plain | `revealui/prod/admin/signup-open` |
| `REVEALUI_BUNDLE_PRO` | `revealui-api` | `prj_zk6EQijYXwd9L7BccuBssi436ktM` | production, preview | encrypted | `revealui/prod/api/bundle-pro` |

The same two names are absent on `revealui-admin-staging`,
`revealui-api-staging`, `revealui-marketing`, and `revealui-docs`. Scoped
apply is the two projects in the table.

`REVEALUI_BUNDLE_PRO` is `encrypted` on Vercel. `SECRET_PATHS` marks
`revealui/prod/api/bundle-pro` as `public-config` (not sensitive). Confirm
manifest sensitivity before scoped apply so the Vercel type stays what you
intend. `REVEALUI_SIGNUP_OPEN` is `plain`, which matches `public-config`.

Vault membership was not re-listed on this machine (no revvault CLI, no age
identity, no private manifest). On a vault-private terminal, list the parent
prefixes and confirm each leaf before `revvault set`.

### Owner steps

Joshua runs these. Agents do not.

1. Vault the current intended prod value. Vault-private terminal only. Do not
   paste values into chat, issues, or this repo.

   ```bash
   revvault set revealui/prod/admin/signup-open
   revvault set revealui/prod/api/bundle-pro
   ```

2. Dry-run, then apply, one project and one key. Repeat for the second key.
   Commands are in [Sanctioned pattern](#sanctioned-pattern)
   (`REVEALUI_SIGNUP_OPEN` on `revealui-admin`, `REVEALUI_BUNDLE_PRO` on
   `revealui-api`).

3. Both keys also have a preview target on that same project. Confirm the
   scoped sync leaves the preview binding in place.

4. Leave unscoped `pnpm vercel:sync:apply` and `revvault sync vercel --apply`
   unused.

5. Promote only when a new deployment should pick up the env.

6. After sync no longer reports these two as Orphan, drop their `KNOWN_DRIFT`
   rows in a follow-up. Leave the allowlist in place until that sync is clean.

### Separate known drift (not this apply)

Shape violations, still listed in `KNOWN_DRIFT`, still present as production
names on both `revealui-api` and `revealui-admin`:

- `ELECTRIC_SECRET`
- `ELECTRIC_SERVICE_URL`

GAP-230 / GAP-231. Keep them out of this scoped apply.

### Revvault repository

Out of scope for this revealui checkout. No revvault tree is mounted here, and
the private planning-repo `ops/sync` inventory is not on disk. The vault path
names above are the revealui contract (`SECRET_PATHS` plus this runbook). The
owner writes the two entries in the revvault store, then runs scoped sync from
a revealui checkout that can resolve the manifest.

## Sanctioned pattern

### 1. Prefer scoped apply (revvault ≥ this GAP-339 CLI)

```bash
cd ~/revealfleet/revealui

# Manifest resolves from private planning-repo ops/sync/ (or
# REVEALUI_SYNC_MANIFEST_DIR / JV_REPO). Prefer stream-safe token inject.
MANIFEST="$(tsx scripts/sync/print-manifest-path.ts vercel)"

# Dry-run one project + one key (no writes)
revvault run --env VERCEL_TOKEN=revealui/prod/api-keys/vercel-token -- \
  revvault sync vercel \
  --manifest "$MANIFEST" \
  --project revealui-admin \
  --key REVEALUI_SIGNUP_OPEN

# Apply only that key after the vault value is verified correct
revvault run --env VERCEL_TOKEN=revealui/prod/api-keys/vercel-token -- \
  revvault sync vercel \
  --manifest "$MANIFEST" \
  --project revealui-admin \
  --key REVEALUI_SIGNUP_OPEN \
  --apply
```

Repeat `--project` / `--key` as needed. Never run unscoped `--apply` until every
`~` row has been verified vault == intended prod (owner checklist on GAP-339).

### 2. Single-key break-glass (vault-private terminal only)

When the CLI is older than scoped filters, or for one-off fixes:

```bash
# Vault-private terminal (REVVAULT_ALLOW_PRINT / vault-private). Never on stream.
# Paths only on argv; value never appears in chat or agent tool logs.

revvault get --full revealui/prod/admin/signup-open | \
  vercel env add REVEALUI_SIGNUP_OPEN production --force
```

Prefer `revvault run` / `with-secrets` patterns for app commands. Full print is
break-glass only (ADR stream-safe secrets).

### 3. New vars from this gap

| Env | Project | Vault path | Owner set |
|-----|---------|------------|-----------|
| `REVEALUI_SIGNUP_OPEN` | revealui-admin | `revealui/prod/admin/signup-open` | `true` / `false` string |
| `REVEALUI_BUNDLE_PRO` | revealui-api | `revealui/prod/api/bundle-pro` | as deployed |

```bash
revvault set revealui/prod/admin/signup-open   # enter true or false
revvault set revealui/prod/api/bundle-pro
```

Then scoped sync as above. Agents do **not** run `--apply` without named owner auth.

### 4. Related

- GAP-260 P4-4 license private key drop (separate owner cutover)
- GAP-230 / GAP-231 Electric corrupt rows
- Manifest SSOT: private planning repo `ops/sync/revvault-vercel.toml`
  (public resolver: [`scripts/sync/README.md`](../../scripts/sync/README.md),
  `print-manifest-path.ts`)
- Unscoped day-to-day: `pnpm vercel:sync` / `pnpm vercel:sync:apply`
