# Revvault → Vercel scoped sync (GAP-339)

Unscoped `revvault sync vercel --apply` rewrites **every** sensitive var the
manifest knows about. Vercel does not return secret values for comparison, so
those rows show `~` even when unchanged. If any vault path still holds a
non-prod value (especially `REVEALUI_LICENSE_PRIVATE_KEY`), a blanket apply can
brick hosted license verification.

## Sanctioned pattern

### 1. Prefer scoped apply (revvault ≥ this GAP-339 CLI)

```bash
cd ~/revfleet/revealui

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
