# Secret rotation — full E2E runbook

`revvault` is the canonical store for every RevealUI production secret. This runbook
rotates the **production runtime + CI** secret set end-to-end — e.g. after a supply-chain
incident (npm token compromise, a dependency exfiltrating build env, a platform incident).
For routine single-secret changes, use [`vercel-env-sync.md`](./vercel-env-sync.md) instead.

> Scope: this rotates the **revealui prod runtime** secrets (the Vercel sync manifest,
> `scripts/sync/revvault-vercel.toml`) plus the **CI** secrets that mirror them. The vault
> holds other entries (other projects, personal credentials) that are out of scope unless
> they were independently exposed.

## Two downstream stores — both must match

| Store | Holds | Pushed by |
|---|---|---|
| **revvault → Vercel app runtime** | `revealui/prod/*` (app reads at runtime) | `pnpm vercel:sync:apply` (one-way; never deletes) |
| **GitHub Actions secrets → CI** | DB URL + Vercel token + Turbo token (migrations, deploy) | `gh secret set` |

The **Neon DB URL** and the **Vercel API token** live in *both* — rotating either means
updating revvault **and** the GitHub secret, or CI and runtime drift apart.

## Rules

- **Never put a secret value in a command or file.** `revvault generate` mints a value;
  `revvault set` reads it from stdin; mirroring to a GH secret uses a pipe. Nothing lands in
  shell history or on disk.
- **The Vercel sync overwrites, never deletes** — rotation is `set --force` →
  `vercel:sync:apply` → redeploy. Do **not** delete vars from the Vercel dashboard (the sync
  won't re-create them cleanly and you'll have a missing-var window).
- **Unlock revvault first.** Confirm it's alive:
  ```bash
  revvault --version
  revvault doctor --manifest scripts/sync/revvault-vercel.toml   # reads every manifest entry, validates shape
  ```

## Order matters — follow top to bottom

### Phase 0 — Vercel API token FIRST (the sync + deploy depend on it)

```bash
# Vercel → Settings → Tokens: revoke the old token, create a new one (scope: revealuistudio team)
revvault set revealui/prod/vercel/api-token --force          # paste new token at the prompt
revvault --json get revealui/prod/vercel/api-token | jq -r .value | \
  gh secret set VERCEL_TOKEN --repo RevealUIStudio/revealui   # mirror to CI (deploy.yml)
export VERCEL_TOKEN=$(revvault --json get revealui/prod/vercel/api-token | jq -r .value)
pnpm vercel:sync                                             # dry-run MUST auth (no 403) before continuing
```

### Phase 1 — External secrets (rotate at the provider, then `revvault set --force`)

revvault can't generate these — roll them in the provider dashboard, then store the new value.

```bash
# Stripe (Developers → API keys / Webhooks) — roll with grace period; revenue-critical
revvault set revealui/prod/stripe/secret-key --force
revvault set revealui/prod/stripe/webhook-secret --force
revvault set revealui/prod/stripe/webhook-secret-live --force
revvault set revealui/prod/stripe/publishable-key --force
# Other providers
revvault set revealui/prod/sentry/auth-token --force          # Sentry → Auth Tokens (DSN is semi-public, optional)
revvault set revealui/prod/blob/read-write-token --force      # Vercel → Storage → Blob
revvault set revealui/prod/api-keys/npm-automation-token --force  # npm runtime token (scope to actual need; likely read-only)
revvault set revealui/prod/google/private-key --force         # GCP IAM → SA → new key → paste private_key
revvault set revealui/prod/db/neon-api-key --force            # Neon → API keys
```

**Neon DB URL — highest-risk (old URL dies on password reset). Update both stores promptly, then redeploy:**
```bash
# Neon → reset role password → copy the new pooled connection string
revvault set revealui/prod/db/postgres-url --force
revvault --json get revealui/prod/db/postgres-url | jq -r .value | gh secret set PROD_POSTGRES_URL --repo RevealUIStudio/revealui
revvault --json get revealui/prod/db/postgres-url | jq -r .value | gh secret set DATABASE_URL    --repo RevealUIStudio/revealui
```

> Stripe webhook secret has a `STRIPE_WEBHOOK_SECRET_PREVIOUS` rotation slot (manifest-deferred)
> for zero-downtime cutover — accept old+new during the transition if you can't redeploy instantly.

### Phase 2 — Generatable secrets (revvault mints them)

Safe to loop (effect on redeploy only; `revealui/prod/secret` also invalidates all sessions — desired post-compromise):
```bash
for p in \
  revealui/prod/secret \
  revealui/prod/cron-secret \
  revealui/prod/admin/api-key \
  revealui/prod/admin/revalidation-key \
  revealui/prod/admin/draft-secret ; do
  revvault generate "$p" --force --length 48 --no-symbols --no-ambiguous && echo "rotated $p"
done
```
Rotate **individually, with awareness** (each has a side effect):
```bash
revvault generate revealui/prod/audit-hmac-secret --force --length 48 --no-symbols --no-ambiguous
#   ↑ pre-rotation audit-log HMACs stop verifying
revvault generate revealui/prod/admin/password     --force --length 32 --no-ambiguous
revvault generate revealui/prod/cms/admin-password --force --length 32 --no-ambiguous
#   ↑ admin login changes — retrieve the new value from revvault to log in
revvault generate revealui/prod/electric/secret    --force --length 48 --no-symbols --no-ambiguous
#   ↑ ALSO set the Electric service to the same value, or realtime sync breaks
```

### Phase 3 — Landmines (skip unless confirmed exposed)

- **`revealui/prod/kek`** — do NOT `generate`. Rotating the KEK needs the `REVEALUI_KEK_NEXT`
  two-key re-encrypt migration, or data encrypted under the old KEK becomes unreadable.
- **`revealui/prod/license/private-key` + `public-key`** — rotating **invalidates every issued
  customer license**. Only with a reissue plan.

### Phase 4 — Remaining CI-only secrets

```bash
gh secret set TURBO_TOKEN --repo RevealUIStudio/revealui     # Turborepo remote cache (paste via stdin)
```
(`NPM_TOKEN` retired with the canary workflow; `VERCEL_ORG_ID` is an identifier, not a secret.)

### Phase 5 — Push revvault → Vercel runtime

```bash
pnpm vercel:sync          # DRY-RUN — review every "~ Update"; confirm only rotated paths changed
pnpm vercel:sync:apply    # overwrites Vercel from vault
```

### Phase 6 — Redeploy (runtime picks up new env)

Env-only changes require a fresh deploy. Per project (`revealui-api`, `revealui-admin`, + marketing/docs if their vars changed):
```bash
vercel redeploy <latest-prod-url> --token=$VERCEL_TOKEN
# or re-run deploy.yml on main (standard path; Vercel Git Integration is disabled)
```

### Phase 7 — Verify E2E

```bash
revvault doctor --manifest scripts/sync/revvault-vercel.toml   # vault shape OK
pnpm vercel:drift-check                                        # every var Skip/Update-clean — no Orphan/Add surprises
```
Then smoke prod: log in (rotated session secret → fresh login works), exercise a Stripe-backed
path, confirm DB connectivity (Neon rotated), check apps healthy post-redeploy, and watch the
next CI run to confirm the rotated `VERCEL_TOKEN` / `PROD_POSTGRES_URL` / `TURBO_TOKEN` work.

## Do NOT rotate (config / public — not secrets)

Rotating these is pointless churn or breakage:

Stripe price IDs (`*-price-id`) + `agent-meter-event-name` · passkey `origin`/`rp-id`/`rp-name` ·
all `NEXT_PUBLIC_*` + `public/server-url` + `public/api-url` + `public/is-live` ·
`session-cookie-domain` · `cors-origin` · `email/from` + `email/reply-to` · `alert-email` ·
`marketplace-connect-return-url` · `electric/service-url` · `sentry/org` + `sentry/project*` +
`sentry/dsn*` (DSNs are embeddable) · `google/service-account-email` · `admin/email` +
`cms/admin-email` · `VERCEL_ORG_ID`.

## See also
- [`vercel-env-sync.md`](./vercel-env-sync.md) — day-to-day single-secret sync workflow
- [`../SECRETS.md`](../SECRETS.md) — canonical secret index + paths
- Manifest: [`../../scripts/sync/revvault-vercel.toml`](../../scripts/sync/revvault-vercel.toml)
