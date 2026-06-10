---
title: "Secrets Architecture"
description: "**All secrets in RevFleet live in revvault, encrypted by an"
visibility: internal
status: verified
audience: maintainer
---

# Secrets Architecture

## One-sentence summary

**All secrets in RevFleet live in revvault, encrypted by an
age identity that doesn't leave the developer's machine.**

If that sentence ever becomes false — even for one secret — we have a
trust story that doesn't hold up under scrutiny. This doc is the
architectural contract that keeps it true.

## The rule

Every secret the suite depends on is stored in revvault. No secret
lives in a `.env`, a `.env.local`, a CI environment variable as its
primary store, a password manager as its primary store, or committed
config. Revvault is canonical; everything downstream is a mirror.

Full cross-fleet rule: see `~/.claude/rules/secrets.md`.

## What counts as a secret

| Category | Examples |
|---|---|
| Database credentials | `POSTGRES_URL` (Neon) |
| Auth | `REVEALUI_SECRET` (JWT / session), OAuth client secrets, session-cookie signing keys |
| Third-party API keys | `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `RESEND_API_KEY` |
| Sync infrastructure | `ELECTRIC_SERVICE_URL`, `ELECTRIC_SECRET` |
| Deployment | Vercel token |
| Licenses | `REVEALUI_LICENSE_KEY`, RVUI-format keys |
| SSH / signing | Age identity, SSH keys, PGP/GPG keys, code-signing certs |

If in doubt — it's a secret. Put it in revvault.

## Canonical path conventions

Paths are lower-kebab, grouped by project, then by subsystem.

### Revealui

#### Local development

The vault holds a small set of dev paths used for running `pnpm dev:admin`,
probes, and scripts. Local dev otherwise reads from `.env.local` populated
via `revvault export-env` at session start — those values are NOT stored as
individual dev paths.

Paths that actually exist in the vault:

```
revealui/dev/admin-base-url
revealui/dev/admin-email
revealui/dev/admin-password
revealui/dev/admin-session-cookie
revealui/dev/electric/service-url
revealui/dev/founder-license-key    # RVUI-<tier>-<32hex>; founder dev license consumed by revdev daemon
```

#### Production runtime

These paths are the canonical source for Vercel sync
(`scripts/sync/revvault-vercel.toml`) and CI secrets.

**Core app secrets**

```
revealui/prod/secret                 # REVEALUI_SECRET — JWT/session signing, ≥32 chars
revealui/prod/cron-secret            # REVEALUI_CRON_SECRET — cron endpoint auth
revealui/prod/kek                    # REVEALUI_KEK — envelope encryption key; see rotation landmines
revealui/prod/audit-hmac-secret      # REVEALUI_AUDIT_HMAC_SECRET — audit-log HMAC; rotating breaks prior log verification
revealui/prod/cors-origin            # CORS_ORIGIN — allowed origin for the API
revealui/prod/session-cookie-domain  # SESSION_COOKIE_DOMAIN
revealui/prod/alert-email            # REVEALUI_ALERT_EMAIL — required at prod boot; apps/api refuses to start without it
revealui/prod/marketplace-connect-return-url  # MARKETPLACE_CONNECT_RETURN_URL
```

**Admin subsystem**

```
revealui/prod/admin/api-key          # REVEALUI_ADMIN_API_KEY
revealui/prod/admin/email            # REVEALUI_ADMIN_EMAIL
revealui/prod/admin/password         # REVEALUI_ADMIN_PASSWORD
```

**Database**

```
revealui/prod/db/postgres-url        # POSTGRES_URL + DATABASE_URL — canonical Neon pooled connection string
revealui/prod/db/neon-api-key        # NEON_API_KEY — Neon control-plane API (admin + migrations)
```

> **Stale duplicate:** `revealui/prod/neon/postgres-url` exists in the vault as a leftover
> from an earlier naming scheme. The manifest and all consuming code use `revealui/prod/db/postgres-url`.
> The `neon/postgres-url` entry is slated for deletion by the owner — do not add new consumers.

> **GitHub Actions secret mirrors of this value** (all sourced from `revealui/prod/db/postgres-url`):
> - `POSTGRES_URL` + `DATABASE_URL` — consumed by `db-backup.yml` and `webhook-reconciliation.yml`.
> - `PROD_POSTGRES_URL` — consumed by `deploy.yml`'s migrate job. Needed because `vercel env pull`
>   returns empty strings for the Sensitive Vercel `POSTGRES_URL`, so the migrate step requires the
>   actual value out-of-band. (`revvault-vercel-sync` Phase 5 will retire this mirror.)
>
> These three repo secrets hold the same prod Neon URL; consolidating the names is an owner
> repo-settings task (not a code change). Rotating the value means updating all three.

**Electric (real-time sync)**

```
revealui/prod/electric/service-url   # ELECTRIC_SERVICE_URL
revealui/prod/electric/secret        # ELECTRIC_SECRET — rotating also requires updating the Electric service
```

**Stripe**

```
revealui/prod/stripe/secret-key               # STRIPE_SECRET_KEY — sk_live_*
revealui/prod/stripe/publishable-key          # NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY — pk_live_*
revealui/prod/stripe/webhook-secret           # STRIPE_WEBHOOK_SECRET
revealui/prod/stripe/webhook-secret-live      # STRIPE_WEBHOOK_SECRET_LIVE (live endpoint duplicate)
revealui/prod/stripe/agent-meter-event-name   # STRIPE_AGENT_METER_EVENT_NAME
revealui/prod/stripe/agent-overage-price-id
revealui/prod/stripe/pro-price-id
revealui/prod/stripe/max-price-id
revealui/prod/stripe/max-annual-price-id
revealui/prod/stripe/enterprise-price-id
revealui/prod/stripe/perpetual-pro-price-id
revealui/prod/stripe/perpetual-max-price-id
revealui/prod/stripe/perpetual-enterprise-price-id
revealui/prod/stripe/credits-starter-price-id
revealui/prod/stripe/credits-standard-price-id
revealui/prod/stripe/credits-scale-price-id
```

**Email transport (Gmail service account)**

```
revealui/prod/google/service-account-email   # GOOGLE_SERVICE_ACCOUNT_EMAIL
revealui/prod/google/private-key             # GOOGLE_PRIVATE_KEY — PKCS8 PEM
revealui/prod/email/from                     # EMAIL_FROM — sending address (Workspace user with domain-wide delegation)
revealui/prod/email/reply-to                 # EMAIL_REPLY_TO
```

**License signing (Ed25519)**

```
revealui/prod/license/private-key   # REVEALUI_LICENSE_PRIVATE_KEY — migrated RS256 → Ed25519 (CR8-P0-01 Phase D 2026-05-04)
revealui/prod/license/public-key    # REVEALUI_LICENSE_PUBLIC_KEY — rotating invalidates all issued customer licenses
```

**Passkeys**

```
revealui/prod/passkey/origin    # PASSKEY_ORIGIN
revealui/prod/passkey/rp-id     # PASSKEY_RP_ID
revealui/prod/passkey/rp-name   # PASSKEY_RP_NAME
```

**Observability (Sentry)**

```
revealui/prod/sentry/dsn           # SENTRY_DSN — server (Hono); required by validate-startup.ts in REQUIRED_IN_PRODUCTION_HOSTED
revealui/prod/sentry/dsn-admin     # NEXT_PUBLIC_SENTRY_DSN — admin (Next.js); enables withSentryConfig wrapper
revealui/prod/sentry/auth-token    # SENTRY_AUTH_TOKEN — CI/CD source-map upload
revealui/prod/sentry/org           # SENTRY_ORG — org slug
revealui/prod/sentry/project-server  # SENTRY_PROJECT for apps/server
revealui/prod/sentry/project-admin   # SENTRY_PROJECT for apps/admin
```

**Storage**

```
revealui/prod/r2/account-id          # R2_ACCOUNT_ID — Cloudflare R2 account ID (canonical object-storage backend)
revealui/prod/r2/access-key-id       # R2_ACCESS_KEY_ID — R2 API token Access Key ID
revealui/prod/r2/secret-access-key   # R2_SECRET_ACCESS_KEY — R2 API token Secret Access Key
revealui/prod/r2/bucket              # R2_BUCKET — R2 bucket name (canonical: revealui-media)
revealui/prod/r2/public-base-url     # R2_PUBLIC_BASE_URL — public-read base; sticky (baked into stored media URLs)
revealui/prod/blob/read-write-token  # BLOB_READ_WRITE_TOKEN — legacy Vercel Blob fallback (retiring once R2 verified)
```

**Billing**

```
revealui/prod/billing/portal-config-id  # Stripe customer-portal configuration ID
```

**Public / non-secret config (kept canonical for reproducibility)**

```
revealui/prod/public/api-url     # NEXT_PUBLIC_API_URL + REVEALUI_API_URL
revealui/prod/public/server-url  # NEXT_PUBLIC_SERVER_URL + REVEALUI_PUBLIC_SERVER_URL
revealui/prod/public/is-live     # NEXT_PUBLIC_IS_LIVE — feature-flag: Stripe live mode
```

**Deployment tokens (prod)**

```
revealui/prod/api-keys/vercel-token         # VERCEL_TOKEN — Vercel API token for sync + deploy; also mirrored to GH secret VERCEL_TOKEN
```

#### API keys namespace

Workspace-scoped keys for inference and services (not project-specific prod runtime):

```
revealui/api-keys/ai-gateway
revealui/api-keys/github-pat
revealui/api-keys/huggingface
revealui/api-keys/mcp
revealui/api-keys/openai-codex
revealui/api-keys/openai-reveal-framework
revealui/api-keys/openai-test
revealui/api-keys/resend
revealui/api-keys/vultr
revealui/api-keys/vultr-new
revealui/api-keys/vultr-revealui-infer
```

#### Env bundles (local dev, exported via `revvault export-env`)

These are multi-var bundles consumed by `.envrc`:

```
revealui/env/ai
revealui/env/backup
revealui/env/cms-url
revealui/env/core
revealui/env/cron
revealui/env/license        # REVEALUI_LICENSE_PRIVATE_KEY + REVEALUI_LICENSE_PUBLIC_KEY
revealui/env/npm
revealui/env/services
revealui/env/stripe
revealui/env/stripe/STRIPE_CREDITS_SCALE_PRICE_ID
revealui/env/stripe/STRIPE_CREDITS_SCALE_PRODUCT_ID
revealui/env/stripe/STRIPE_CREDITS_STANDARD_PRICE_ID
revealui/env/stripe/STRIPE_CREDITS_STANDARD_PRODUCT_ID
revealui/env/stripe/STRIPE_CREDITS_STARTER_PRICE_ID
revealui/env/stripe/STRIPE_CREDITS_STARTER_PRODUCT_ID
revealui/env/supabase
```

### RevDev

```
revdev/license-signing-private-key       # Ed25519 license signing key (canonical keypair)
revdev/license-signing-public-key        # Ed25519 license verification key (canonical keypair)
revdev/github-token                      # perpetual license GitHub provisioning
# The retired legacy pair (revdev/license-signing-key + revdev/license-public-key) is
# superseded by the canonical Ed25519 keypair above.
```

### Licensing (RevealUI)

```
revealui/env/license                     # Multi-key bundle for local dev: REVEALUI_LICENSE_PRIVATE_KEY + REVEALUI_LICENSE_PUBLIC_KEY (consumed by ~/revfleet/revealui/.envrc via `revvault export-env`)
revealui/prod/license/private-key        # Ed25519 license signing key (production; mirrored to Vercel `revealui-api` + `revealui-admin`)
revealui/prod/license/public-key         # Ed25519 license verification key (production; mirrored to Vercel `revealui-api` + `revealui-admin`)
```

### LLM / AI providers

```
credentials/openai/api-key              # AI features + test setup
credentials/groq/api-key                # Groq inference
credentials/huggingface/token           # HF model access
credentials/tavily/api-key              # Tavily search
credentials/exa/api-key                 # Exa search
```

### CI / publishing

```
# npm publish: OIDC trusted publishing only (no token). The 2FA-bypass automation token at
# revealui/api-keys/npm-automation-token (+ prod mirror) was revoked on npm.org + removed from
# the vault 2026-05-23 — see revealui#1016. (The credentials/npm/token path never existed.)
credentials/sentry/auth-token           # error tracking (CI + runtime)
```

### Shared / cross-project credentials

```
credentials/github/personal-access-token
credentials/github/actions-secrets-mirror
credentials/anthropic/api-key
credentials/ssh/github                   # if distinct from system SSH
```

## Reading secrets — consumer patterns

### From a Node / TypeScript script

```ts
import { spawnSync } from 'node:child_process';

function revvault(path: string): string {
  const bin = process.env.REVVAULT ?? `${process.env.HOME}/.cargo/bin/revvault`;
  const r = spawnSync(bin, ['get', '--full', path], { encoding: 'utf8' });
  if (r.status !== 0) {
    throw new Error(`revvault path '${path}' missing; set with: echo <val> | revvault set ${path}`);
  }
  return r.stdout.trimEnd();
}

const electricUrl = revvault('revealui/dev/electric/service-url');
```

### From a shell script

```bash
#!/usr/bin/env bash
set -euo pipefail
ELECTRIC_URL=$(revvault get --full revealui/dev/electric/service-url)
```

### From the Next.js admin app (runtime)

The admin app reads from `process.env` at runtime (Next.js contract).
Env vars are populated from revvault at deploy time via a mirror step,
not hand-typed in the Vercel UI:

```bash
# Driven by the Vercel sync manifest (scripts/sync/revvault-vercel.toml):
pnpm vercel:sync          # dry-run — review diffs
pnpm vercel:sync:apply    # apply to Vercel production
```

## Writing a new secret

1. Generate or receive the secret value.
2. Pick the canonical path (add it to this doc under the right section
   if it's new).
3. Store:
   ```bash
   echo "<value>" | revvault set <path>
   ```
   Or interactively: `revvault set <path>` and paste.
4. Update the consuming code to pull from revvault via the pattern
   above.
5. If it needs to mirror into CI or a deploy platform, document the
   mirror step here.

## Rotating a secret

1. Generate the new value.
2. `revvault set --force <path>` — overwrite.
3. Redeploy long-lived consumers (Vercel). They pick up the
   new env on next invocation.
4. Log the rotation in `docs/SECURITY.md` or the relevant security log.
5. If the old value was leaked: `revvault delete <path>` after
   rotation, audit logs for usage, follow incident-response in
   `docs/SECURITY.md`.

## What this rules out

- `.env` and `.env.local` as sources of truth. They're acceptable as
  **local-dev convenience files that are populated from revvault at
  session start** (via `revvault export-env` or a wrapper), but the
  revvault entries are authoritative.
- Pasting secrets into chat, AI tools, issues, docs, or anywhere
  except revvault itself.
- Committing any credential-shaped string. Tests may use obvious
  placeholder patterns (see `revdev/.gitleaks.toml` for the per-repo
  allowlist).
- Using a password manager as the primary store for system secrets.
  Password managers are for human-memorable entries (the revvault
  unlock passphrase) and emergency break-glass only.

## Age identity — the key that gates everything else

The revvault store is unlocked by a single X25519 age identity at
`$HOME/.age-identity/keys.txt` (or `REVVAULT_IDENTITY`). Losing that
file means losing every secret in RevFleet.

Backup policy for the age identity is documented in
[`SECURITY.md`](./SECURITY.md#age-identity-backup). Summary:

1. Passphrase-encrypted `.age` blob on an offline USB drive.
2. Passphrase stored in a password manager under a memorable label.
3. Paper copy of the raw identity in a geographically separate
   location (printer / handwritten, stored in a safe or trusted
   offsite).

Each copy gets an annual "can we still restore?" audit. Losing two
out of three isn't recoverable.

## Known deviations / escape hatches

None currently. Any exception to this architecture must land here with
a rationale, a review date, and a named owner.
