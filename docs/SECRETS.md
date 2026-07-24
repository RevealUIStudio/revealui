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
# Stripe TEST-mode keys (dev namespace) — used by local dev + the CI integration suite.
revealui/dev/stripe/restricted-ci-test     # rk_test_* restricted (Write: PaymentIntents/Products/Prices/Checkout) — mirrored to CI as STRIPE_SECRET_KEY (see CI / publishing)
revealui/dev/stripe/secret-key             # sk_test_* full test secret (broader; CI uses the restricted key above)
revealui/dev/stripe/restricted-ro-test     # rk_test_* read-only
revealui/dev/stripe/restricted-ro-live     # rk_live_* read-only
revealui/dev/stripe/publishable-key        # pk_test_*
revealui/dev/stripe/webhook-secret         # whsec_* (test)
# revealui/dev/stripe/{pro,max,enterprise}-price-id also exist for local dev
```

#### Production runtime

These paths are the canonical source for the Vercel + Fly sync manifests
(`scripts/sync/revvault-vercel.toml`, `scripts/sync/revvault-fly.toml`) and the
CI secret mirrors. The table below is a DERIVED VIEW of the machine spec at
`scripts/sync/secret-paths.ts` - do not hand-edit it (see the marker note).

The `revealui/staging/*` rows below (GAP-343) are synced by a SEPARATE
manifest, `scripts/sync/revvault-vercel-staging.toml`, deliberately never the
prod one - see that file's header for the `git_branch` preview-scoping
mechanics and `scripts/setup/gen-staging-secrets.ts` for the owner-run
generator that fills the "fresh value" paths.

<!-- BEGIN GENERATED:secret-paths -->

_Machine-generated from [`scripts/sync/secret-paths.ts`](../scripts/sync/secret-paths.ts) by
`scripts/sync/render-secrets-md.ts` - do NOT hand-edit. The lockstep test
(`scripts/sync/__tests__/secret-paths-lockstep.test.ts`) fails CI if this drifts from the
spec, the Vercel/Fly sync manifests, or their sensitivity markers. Change `secret-paths.ts`
and re-run the renderer._

Production runtime paths synced to Vercel + Fly (109 paths). `sensitive` = the
value is never UI/API-revealable after write (credentials + private signing keys).

| Path | Kind | Sensitive | Consumers | Notes |
| --- | --- | --- | --- | --- |
| `revdev/license-signing-private-key` | signing-private | yes | vercel:api, vercel:admin, fly:worker, with-secrets:license-signing | → migrating to `revealui/prod/license/private-key` (since 2026-06-28); Ed25519 license-signing key - the fleet crown jewel; only api mints |
| `revdev/license-signing-public-key` | signing-public | no | vercel:api, vercel:admin, fly:worker, with-secrets:license | → migrating to `revealui/prod/license/public-key` (since 2026-06-28); Ed25519 verification key - rotating invalidates all issued customer licenses |
| `revealui/prod/admin/api-key` | credential | yes | vercel:api, vercel:admin, fly:worker |  |
| `revealui/prod/admin/email` | public-config | no | vercel:admin |  |
| `revealui/prod/admin/password` | credential | yes | vercel:admin |  |
| `revealui/prod/alert-email` | public-config | no | vercel:api, fly:worker | required@boot; required at prod boot - apps/server refuses to start without it |
| `revealui/prod/audit/signing-private-key` | signing-private | yes | vercel:api, vercel:admin, fly:worker | required@boot; Ed25519 PKCS#8 PEM - signs every audit row; only signing surfaces read it, no fallback |
| `revealui/prod/audit/signing-public-key` | signing-public | no | vercel:api, vercel:admin, fly:worker | Ed25519 SPKI PEM - published for offline receipt verification; derivable from the private key. See docs/security/AUDIT_RECEIPTS.md (Stage 4: row verify free; root download Max) |
| `revealui/prod/billing/portal-config-id` | public-config | no | fly:worker | → migrating to `revealui/prod/stripe/billing-portal-config-id` (since 2026-07-01); R18 - Fly-side duplicate of the stripe/ canonical; converge in P3-3 |
| `revealui/prod/cors-origin` | public-config | no | vercel:api, fly:worker |  |
| `revealui/prod/cron-secret` | credential | yes | vercel:api, vercel:admin, fly:worker |  |
| `revealui/prod/db/neon-api-key` | credential | yes | vercel:admin |  |
| `revealui/prod/db/postgres-url` | credential | yes | vercel:api, vercel:admin, fly:worker | required@boot; canonical Neon pooled url - feeds POSTGRES_URL + DATABASE_URL |
| `revealui/prod/electric/secret` | credential | yes | vercel:api, vercel:admin, fly:worker | currently empty in the vault (GAP-230/231); the worker does not require it |
| `revealui/prod/electric/service-url` | public-config | no | vercel:api, vercel:admin, fly:worker |  |
| `revealui/prod/email/from` | public-config | no | vercel:api, vercel:admin, fly:worker, vercel:api-staging, vercel:admin-staging |  |
| `revealui/prod/email/reply-to` | public-config | no | vercel:api, vercel:admin, fly:worker, vercel:api-staging, vercel:admin-staging |  |
| `revealui/prod/google/private-key` | credential | yes | vercel:api, vercel:admin, fly:worker, vercel:api-staging, vercel:admin-staging | PKCS8 PEM - Gmail SA domain-wide delegation; also read by staging (GAP-343) |
| `revealui/prod/google/service-account-email` | public-config | no | vercel:api, vercel:admin, fly:worker, vercel:api-staging, vercel:admin-staging |  |
| `revealui/prod/kek` | credential | yes | vercel:api, vercel:admin, fly:worker | REVEALUI_KEK - AES-256-GCM envelope key; has a NEXT dual-slot rotation story |
| `revealui/prod/marketplace-connect-return-url` | public-config | no | vercel:api, fly:worker |  |
| `revealui/prod/passkey/origin` | public-config | no | vercel:api, vercel:admin, fly:worker |  |
| `revealui/prod/passkey/rp-id` | public-config | no | vercel:api, vercel:admin, fly:worker |  |
| `revealui/prod/passkey/rp-name` | public-config | no | vercel:api, vercel:admin, fly:worker |  |
| `revealui/prod/preview-token-secret` | credential | yes | vercel:api | HMAC-SHA256 key for edit-session preview tokens - short-lived read-only credential |
| `revealui/prod/public/api-url` | public-config | no | vercel:api, vercel:admin, vercel:marketing, vercel:docs | required@boot; api self-origin: REVEALUI_API_URL (+ NEXT_PUBLIC_API_URL twin). Governed MCP tools fail without it. |
| `revealui/prod/public/is-live` | public-config | no | vercel:admin, vercel:marketing | NEXT_PUBLIC_IS_LIVE - Stripe live-mode feature flag |
| `revealui/prod/public/server-url` | public-config | no | vercel:api, vercel:admin, vercel:marketing, fly:worker |  |
| `revealui/prod/r2/access-key-id` | credential | yes | vercel:api, vercel:admin, fly:worker |  |
| `revealui/prod/r2/account-id` | public-config | no | vercel:api, vercel:admin, fly:worker |  |
| `revealui/prod/r2/bucket` | public-config | no | vercel:api, vercel:admin, fly:worker |  |
| `revealui/prod/r2/public-base-url` | public-config | no | vercel:api, vercel:admin, fly:worker |  |
| `revealui/prod/r2/secret-access-key` | credential | yes | vercel:api, vercel:admin, fly:worker |  |
| `revealui/prod/secret` | credential | yes | vercel:api, vercel:admin, fly:worker | REVEALUI_SECRET - session/CSRF/internal-token signer |
| `revealui/prod/sentry/auth-token` | credential | yes | vercel:admin | CI/CD source-map upload (build-time) |
| `revealui/prod/sentry/dsn` | public-config | no | vercel:api, fly:worker | required@boot; server DSN - required by validate-startup REQUIRED_IN_PRODUCTION_HOSTED |
| `revealui/prod/sentry/dsn-admin` | public-config | no | vercel:admin |  |
| `revealui/prod/sentry/org` | public-config | no | vercel:admin |  |
| `revealui/prod/sentry/project-admin` | public-config | no | vercel:admin |  |
| `revealui/prod/session-cookie-domain` | public-config | no | vercel:api, vercel:admin, fly:worker |  |
| `revealui/prod/stripe/agent-meter-event-name` | public-config | no | vercel:api, fly:worker, vercel:api-staging |  |
| `revealui/prod/stripe/agent-overage-price-id` | price-id | no | vercel:api, fly:worker |  |
| `revealui/prod/stripe/billing-portal-config-id` | public-config | no | vercel:api | canonical billing-portal config id (Vercel api) |
| `revealui/prod/stripe/credits-scale-price-id` | price-id | no | vercel:api, fly:worker |  |
| `revealui/prod/stripe/credits-standard-price-id` | price-id | no | vercel:api, fly:worker |  |
| `revealui/prod/stripe/credits-starter-price-id` | price-id | no | vercel:api, fly:worker |  |
| `revealui/prod/stripe/enterprise-annual-price-id` | price-id | no | vercel:api, vercel:admin |  |
| `revealui/prod/stripe/enterprise-price-id` | price-id | no | vercel:api, vercel:admin, fly:worker |  |
| `revealui/prod/stripe/max-annual-price-id` | price-id | no | vercel:api, vercel:admin, fly:worker |  |
| `revealui/prod/stripe/max-price-id` | price-id | no | vercel:api, vercel:admin, fly:worker |  |
| `revealui/prod/stripe/perpetual-enterprise-price-id` | price-id | no | vercel:api, vercel:admin, fly:worker |  |
| `revealui/prod/stripe/perpetual-max-price-id` | price-id | no | vercel:api, vercel:admin, fly:worker |  |
| `revealui/prod/stripe/perpetual-pro-price-id` | price-id | no | vercel:api, vercel:admin, fly:worker |  |
| `revealui/prod/stripe/pro-annual-price-id` | price-id | no | vercel:api, vercel:admin |  |
| `revealui/prod/stripe/pro-price-id` | price-id | no | vercel:api, vercel:admin, fly:worker |  |
| `revealui/prod/stripe/publishable-key` | public-config | no | vercel:admin | pk_live_* - publishable by design (client SDK) |
| `revealui/prod/stripe/renewal-enterprise-price-id` | price-id | no | vercel:api |  |
| `revealui/prod/stripe/renewal-max-price-id` | price-id | no | vercel:api |  |
| `revealui/prod/stripe/renewal-pro-price-id` | price-id | no | vercel:api |  |
| `revealui/prod/stripe/secret-key` | credential | yes | vercel:api, vercel:admin | sk_live_* - set Fly-direct (mode-gated), not synced to the worker |
| `revealui/prod/stripe/webhook-secret` | credential | yes | vercel:api, vercel:admin, fly:worker |  |
| `revealui/prod/stripe/webhook-secret-live` | credential | yes | vercel:api, fly:worker |  |
| `revealui/staging/admin/api-key` | credential | yes | vercel:api-staging, vercel:admin-staging |  |
| `revealui/staging/admin/email` | public-config | no | vercel:admin-staging | owner sets by hand - fresh staging bootstrap admin user |
| `revealui/staging/admin/password` | credential | yes | vercel:admin-staging | owner sets by hand - fresh staging bootstrap admin user |
| `revealui/staging/alert-email` | public-config | no | vercel:api-staging | owner sets by hand - not derivable, not generated by gen-staging-secrets.ts |
| `revealui/staging/cors-origin` | public-config | no | vercel:api-staging |  |
| `revealui/staging/cron-secret` | credential | yes | vercel:api-staging, vercel:admin-staging |  |
| `revealui/staging/db/postgres-url` | credential | yes | vercel:api-staging, vercel:admin-staging | Phase 1 (owner-run empty Neon branch + full migrate) fills this |
| `revealui/staging/kek` | credential | yes | vercel:api-staging, vercel:admin-staging | fresh staging value (scripts/setup/gen-staging-secrets.ts) |
| `revealui/staging/license/private-key` | signing-private | yes | vercel:api-staging, vercel:admin-staging | fresh Ed25519 pair, isolated from revdev/license-signing-* (GAP-343 decision 1) |
| `revealui/staging/license/public-key` | signing-public | no | vercel:api-staging, vercel:admin-staging |  |
| `revealui/staging/passkey/origin` | public-config | no | vercel:api-staging, vercel:admin-staging | the admin app origin, https://admin.staging.revealui.com |
| `revealui/staging/passkey/rp-id` | public-config | no | vercel:api-staging, vercel:admin-staging |  |
| `revealui/staging/passkey/rp-name` | public-config | no | vercel:api-staging, vercel:admin-staging |  |
| `revealui/staging/public/api-url` | public-config | no | vercel:api-staging, vercel:admin-staging, vercel:marketing-staging | the api own origin (MCP loopback + OpenAPI); also VITE_API_URL on marketing (anti-cross-wire, GAP-343) |
| `revealui/staging/public/server-url` | public-config | no | vercel:api-staging, vercel:admin-staging, vercel:marketing-staging | the admin app own origin (parity with the prod server-url leaf) |
| `revealui/staging/r2/access-key-id` | credential | yes | vercel:api-staging, vercel:admin-staging |  |
| `revealui/staging/r2/account-id` | public-config | no | vercel:api-staging, vercel:admin-staging |  |
| `revealui/staging/r2/bucket` | public-config | no | vercel:api-staging, vercel:admin-staging |  |
| `revealui/staging/r2/public-base-url` | public-config | no | vercel:api-staging, vercel:admin-staging |  |
| `revealui/staging/r2/secret-access-key` | credential | yes | vercel:api-staging, vercel:admin-staging |  |
| `revealui/staging/secret` | credential | yes | vercel:api-staging, vercel:admin-staging | must match across api + admin - CSRF tokens are cross-verified |
| `revealui/staging/sentry/auth-token` | credential | yes | vercel:admin-staging |  |
| `revealui/staging/sentry/dsn` | public-config | no | vercel:api-staging | separate staging Sentry project - prod error budget stays clean |
| `revealui/staging/sentry/dsn-admin` | public-config | no | vercel:admin-staging |  |
| `revealui/staging/sentry/org` | public-config | no | vercel:admin-staging |  |
| `revealui/staging/sentry/project-admin` | public-config | no | vercel:admin-staging |  |
| `revealui/staging/session-cookie-domain` | public-config | no | vercel:api-staging, vercel:admin-staging |  |
| `revealui/staging/stripe/agent-overage-price-id` | price-id | no | vercel:api-staging |  |
| `revealui/staging/stripe/billing-portal-config-id` | public-config | no | vercel:api-staging |  |
| `revealui/staging/stripe/credits-scale-price-id` | price-id | no | vercel:api-staging |  |
| `revealui/staging/stripe/credits-standard-price-id` | price-id | no | vercel:api-staging |  |
| `revealui/staging/stripe/credits-starter-price-id` | price-id | no | vercel:api-staging |  |
| `revealui/staging/stripe/enterprise-annual-price-id` | price-id | no | vercel:api-staging, vercel:admin-staging |  |
| `revealui/staging/stripe/enterprise-price-id` | price-id | no | vercel:api-staging, vercel:admin-staging |  |
| `revealui/staging/stripe/max-annual-price-id` | price-id | no | vercel:api-staging, vercel:admin-staging |  |
| `revealui/staging/stripe/max-price-id` | price-id | no | vercel:api-staging, vercel:admin-staging |  |
| `revealui/staging/stripe/perpetual-enterprise-price-id` | price-id | no | vercel:api-staging, vercel:admin-staging |  |
| `revealui/staging/stripe/perpetual-max-price-id` | price-id | no | vercel:api-staging, vercel:admin-staging |  |
| `revealui/staging/stripe/perpetual-pro-price-id` | price-id | no | vercel:api-staging, vercel:admin-staging |  |
| `revealui/staging/stripe/pro-annual-price-id` | price-id | no | vercel:api-staging, vercel:admin-staging |  |
| `revealui/staging/stripe/pro-price-id` | price-id | no | vercel:api-staging, vercel:admin-staging |  |
| `revealui/staging/stripe/publishable-key` | public-config | no | vercel:admin-staging | pk_test_* |
| `revealui/staging/stripe/renewal-enterprise-price-id` | price-id | no | vercel:api-staging |  |
| `revealui/staging/stripe/renewal-max-price-id` | price-id | no | vercel:api-staging |  |
| `revealui/staging/stripe/renewal-pro-price-id` | price-id | no | vercel:api-staging |  |
| `revealui/staging/stripe/secret-key` | credential | yes | vercel:api-staging, vercel:admin-staging | sk_test_* - isolated staging Stripe test account (Phase 2) |
| `revealui/staging/stripe/webhook-secret` | credential | yes | vercel:api-staging, vercel:admin-staging |  |

<!-- END GENERATED:secret-paths -->

> **Not in the machine-checked synced set (documented for completeness):**
> - `revealui/prod/api-keys/vercel-token` - `VERCEL_TOKEN`; the token that DRIVES sync/deploy,
>   not a value synced BY it (also mirrored to the GH `VERCEL_TOKEN` secret).
> - `revealui/prod/sentry/project-server` - `SENTRY_PROJECT` for apps/server; referenced by code
>   but not currently emitted by either sync manifest.
> Both fold into the spec in a later phase.

> **Stale duplicates slated for owner delete (P3-3) - do not add consumers:**
> `revealui/prod/neon/postgres-url` + `revealui/db/neon-production` - both leftover from an
> earlier scheme; the manifests + all code use the canonical `revealui/prod/db/postgres-url`.
> The billing-portal config id is a LIVE unconverged duplicate - the Fly worker reads
> `revealui/prod/billing/portal-config-id` while Vercel reads the canonical
> `revealui/prod/stripe/billing-portal-config-id`; both appear in the table above (the Fly path
> marked migrating). Converging the two onto the stripe/ canonical is also P3-3.

> **GitHub Actions secret mirrors of the Neon URL** (all sourced from `revealui/prod/db/postgres-url`):
> `POSTGRES_URL` + `DATABASE_URL` (db-backup.yml, webhook-reconciliation.yml) and `PROD_POSTGRES_URL`
> (deploy.yml migrate job - `vercel env pull` returns empty for the Sensitive Vercel `POSTGRES_URL`, so
> the value is needed out-of-band). Rotating the value means updating all three repo secrets.

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
revdev/license-signing-private-key       # Ed25519 license signing key (canonical keypair) - prod-consumed; see the Production runtime table (migrating to revealui/prod/license/*)
revdev/license-signing-public-key        # Ed25519 license verification key (canonical keypair) - prod-consumed; see the Production runtime table
revdev/github-token                      # perpetual license GitHub provisioning
revdev/tauri-signing-private-key          # Tauri updater signing key (Studio auto-update; generated 2026-06-11)
revdev/tauri-signing-private-key-password # password for the Tauri updater key
revdev/tauri-signing-public-key           # updater public key (also embedded in revdev's apps/studio tauri.conf.json)
# The retired legacy pair (revdev/license-signing-key + revdev/license-public-key) is
# superseded by the canonical Ed25519 keypair above.
# CI mirror: TAURI_SIGNING_PRIVATE_KEY + TAURI_SIGNING_PRIVATE_KEY_PASSWORD repo secrets
# on RevealUIStudio/revdev (consumed by studio-release.yml) are mirrored FROM the two
# tauri-signing vault paths above — re-mirror after any rotation, never hand-type.
# Rotating the updater key orphans installed Studio builds; see revdev docs/KEY_GENERATION.md §1.
```

### Licensing (RevealUI)

The canonical license-signing keypair (`revdev/license-signing-{private,public}-key`) is a
production-runtime secret - it appears in the machine-checked Production runtime table above,
carrying its declared migration target `revealui/prod/license/{private,public}-key` (the
value-move is P3-4, owner-gated). The `revealui/env/license` bundle below is the local-dev
`with-secrets` mirror of that keypair, consumed by `~/revfleet/revealui/.envrc` via
`revvault export-env`.

```
revealui/env/license   # Multi-key bundle for local dev: REVEALUI_LICENSE_PRIVATE_KEY + REVEALUI_LICENSE_PUBLIC_KEY
# Reserved: revealui/prod/license/{private,public}-key - the DECLARED Ed25519 migration target (P3-4).
# It previously held a pre-cutover RSA/RS256 pair. The target is UNVERIFIED: a stale RSA-era value
# may still occupy this path (RSA is incompatible with the Ed25519 runtime verifier), so the P3-4
# value-move is gated on a computeKeyId readback. Adversarial verification of the target is in flight.
```

**Deployment mode (GAP-260 P4-1):** set `REVEALUI_DEPLOYMENT_MODE=hosted` or `forge` on each
runtime (api + admin). Prefer explicit MODE over private-key sniffing so hosted admin can boot
without the signing private key (signer isolation). When MODE is unset, runtimes still fall
back to "private key present → hosted". `MODE=forge` with a private key present fails boot.

### LLM / AI providers

```
credentials/openai/api-key              # AI features + test setup
credentials/groq/api-key                # Groq inference
credentials/huggingface/token           # HF model access
credentials/xai/api-key                 # xAI (Grok) inference - BYOK adapter dev/test only, never a hosted key
credentials/tavily/api-key              # Tavily search
credentials/exa/api-key                 # Exa search
```

### CI / publishing

```
# npm publish: OIDC trusted publishing only (no token). The 2FA-bypass automation token at
# revealui/api-keys/npm-automation-token (+ prod mirror) was revoked on npm.org + removed from
# the vault 2026-05-23 — see revealui#1016. (The credentials/npm/token path never existed.)
credentials/sentry/auth-token           # error tracking (CI + runtime)
# revealui CI integration tests (the "Integration Tests (extended)" job): the Stripe billing
# contract test reads a least-privilege TEST restricted key, mirrored into revealui's Actions
# secrets as STRIPE_SECRET_KEY (value piped, never echoed or written to disk):
#   revvault --json get revealui/dev/stripe/restricted-ci-test | jq -r .value | gh secret set STRIPE_SECRET_KEY -R RevealUIStudio/revealui
# The job self-activates only when the secret is present (RUN_INTEGRATION is gated on it in
# .github/workflows/ci.yml). Rotation: create a new rk_test_ key in the Stripe TEST dashboard
# (Write on PaymentIntents/Products/Prices/Checkout), revvault set --force the path, re-mirror
# the Actions secret, then revoke the old key.
```

### Shared / cross-project credentials

```
credentials/github/personal-access-token
credentials/github/actions-secrets-mirror
# revfleet-backflow GitHub App (Contents + Pull requests r/w) — authenticates the
# org-shared backflow-reusable.yml caller at .github/workflows/backflow-main-into-test.yml
# in every fleet repo. Mirrored into each repo's Actions secrets as BACKFLOW_APP_ID /
# BACKFLOW_APP_PRIVATE_KEY (publish step — value piped, never echoed or written to disk;
# the App installation must also include the repo or the caller fails at token mint):
#   revvault --json get credentials/github/backflow-app/app-id | jq -r .value | gh secret set BACKFLOW_APP_ID -R RevealUIStudio/<repo>
#   revvault --json get credentials/github/backflow-app/private-key | jq -r .value | gh secret set BACKFLOW_APP_PRIVATE_KEY -R RevealUIStudio/<repo>
# Rotation: generate a new private key on the App's settings page, revvault set --force
# both paths, re-mirror to every repo carrying the caller, then delete the old key from
# the App (multiple keys can be valid simultaneously, so rotation is zero-downtime).
credentials/github/backflow-app/app-id
credentials/github/backflow-app/private-key
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

### Harness gateway bootstrap pairing secret

**Path:** `~/.local/share/revealui/pairing-secret` (mode `0600`,
machine-local; NOT in revvault)

**Rationale:** the `@revealui/harnesses` HTTP gateway's bootstrap
credential is intentionally filesystem-rooted rather than revvault-rooted.
The party who can read a `0600` file in the daemon's own data dir is, by
definition, the machine owner, and that is the trust anchor a never-paired
daemon uses to admit its first pairing (the same bootstrap paradox SSH
resolves the same way). Storing it in revvault would invert the design: it
would require a working revvault unlock to reach a locally-running daemon,
and it would move the credential off the single machine it authenticates.
The daemon generates the secret on first start
(`HttpGateway.initAuth()`, `packages/harnesses/src/server/http-gateway.ts`);
only its SHA-256 hash is ever persisted (the `gateway_bootstrap` table),
never the plaintext. See the harnesses README's "Remote Gateway (HTTP)"
section for the pairing flow.

**Review date:** 2027-07-18 (annual)
**Owner:** RevealUI Studio (harness daemon maintainer)
