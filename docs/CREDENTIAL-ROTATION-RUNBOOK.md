---
title: "Credential Rotation Runbook"
description: "Operational reference for rotating all credentials in the RevealUI stack."
visibility: internal
status: verified
audience: maintainer
---

# Credential Rotation Runbook

Operational reference for rotating all credentials in the RevealUI stack.
Cross-reference `docs/ENVIRONMENT-VARIABLES-GUIDE.md` for env var details.

---

## Rotation Schedule

| Cadence | Credentials |
|---------|------------|
| **90 days** | REVEALUI_SECRET, REVEALUI_KEK*, REVEALUI_LICENSE_ENCRYPTION_KEY*, REVEALUI_CRON_SECRET, REVEALUI_ADMIN_API_KEY, ANTHROPIC_API_KEY, OPENAI_API_KEY, TAVILY_API_KEY, HF_TOKEN, VERCEL_API_KEY, NEON_API_KEY, MCP_API_KEY |
| **Quarterly** | STRIPE_SECRET_KEY, GOOGLE_CLIENT_SECRET, GOOGLE_PRIVATE_KEY, GITHUB_CLIENT_SECRET, REVEALUI_GITHUB_TOKEN, SENTRY_AUTH_TOKEN, ELECTRIC_API_KEY, ELECTRIC_DATABASE_URL (password), R2_SECRET_ACCESS_KEY |
| **Annually** | REVEALUI_LICENSE_PRIVATE_KEY (Ed25519 pair), GOOGLE_CLIENT_ID, GITHUB_CLIENT_ID, VERCEL_CLIENT_ID, YOUTUBE_API_KEY |

> The Supabase keys (`SUPABASE_SERVICE_ROLE_KEY`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_DATABASE_URI`) are no longer on the active RevealUI rotation cadence. Supabase was removed as an internal datastore (ADR `2026-05-01-supabase-removal.md`); the legacy rotation steps below are retained only for self-hosted installs that have not yet completed migration.
| **As-needed** | STRIPE_WEBHOOK_SECRET (endpoint change), REVFORGE_LICENSE_KEY (renewal), X402_RECEIVING_ADDRESS (wallet change), POSTGRES_URL (provider migration) |

\* Requires data re-encryption migration. Schedule maintenance window.

---

## Procedures by Category

### Encryption Keys (Maintenance Window Required)

#### REVEALUI_KEK (AES-256-GCM field encryption) -- rotatable via dual-key migration

Used by `@revealui/db/crypto` for the two `encryptField()` surfaces: API keys
(`api_keys.encrypted_key`) and TOTP/MFA secrets (`users.mfa_secret`).

> **Status: rotatable (tooling shipped 2026-05-05).** Use the two-key `REVEALUI_KEK_NEXT`
> migration, never a naive `revvault generate` (which would make data encrypted under the old
> key unreadable).
>
> Procedure, `pnpm kek:rotate` (`scripts/security/rotate-kek.ts`): set `REVEALUI_KEK_NEXT` to the
> new key (boot then encrypts with NEXT and decrypts try NEXT first, falling back to
> `REVEALUI_KEK`, see `getKekPair()` in `packages/db/src/crypto.ts`), re-encrypt the two surfaces,
> then promote `REVEALUI_KEK_NEXT` to `REVEALUI_KEK` and remove `REVEALUI_KEK_NEXT`. Zero downtime.
> Validate with `pnpm validate:kek-rotation`. Full steps:
> [`docs/runbooks/secret-rotation.md`](./runbooks/secret-rotation.md) Phase 3.

**Risk:** bounded. Only the two columns above are KEK-encrypted, and the dual-key fallback keeps
existing ciphertext readable throughout. revvault is unaffected (separate AGE identity). The prior
"NOT YET ROTATABLE / GAP-126" framing predates the shipped tooling.

#### REVEALUI_LICENSE_PRIVATE_KEY (Ed25519 license signing)

```bash
# 1. Generate new key pair
openssl genpkey -algorithm Ed25519 -out private.pem
openssl pkey -in private.pem -pubout -out public.pem

# 2. Convert to single-line PEM for env vars
PRIV=$(awk 'NF {sub(/\r/, ""); printf "%s\\n",$0;}' private.pem)
PUB=$(awk 'NF {sub(/\r/, ""); printf "%s\\n",$0;}' public.pem)

# 3. Update both keys in RevVault + Vercel
revvault set revealui/env/license REVEALUI_LICENSE_PRIVATE_KEY "$PRIV"
revvault set revealui/env/license REVEALUI_LICENSE_PUBLIC_KEY "$PUB"

# 4. Re-sign all active licenses (existing licenses won't validate)
#    Note: a `licenses:resign` script is on the roadmap; until it ships,
#    re-sign by reissuing each license through the standard checkout/reissue
#    flow or by writing a one-off script that uses `signLicense` from
#    `packages/services/src/license/sign.ts` directly.

# 5. Redeploy + verify
```

**Risk:** Existing license JWTs become invalid. Coordinate with license holders.

#### REVEALUI_LICENSE_ENCRYPTION_KEY (license key encryption at rest)

Same shape as REVEALUI_KEK rotation — and like REVEALUI_KEK, the rekey tool (`licenses:rekey`) does not yet ship. Track GAP-126 for tooling status. Until then, treat this key as no-rotate or schedule a coordinated maintenance window with manual re-encryption.

### Session & Auth Secrets

#### REVEALUI_SECRET (session signing, CSRF, HMAC)

```bash
NEW_SECRET=$(openssl rand -hex 32)
revvault set revealui/env/core REVEALUI_SECRET "$NEW_SECRET"
# Deploy: all active sessions are invalidated — users must re-login
```

**Impact:** Every logged-in user is signed out. Schedule during low-traffic window and communicate.

#### REVEALUI_CRON_SECRET

```bash
openssl rand -hex 32  # → new value
revvault set revealui/env/cron REVEALUI_CRON_SECRET "$(openssl rand -hex 32)"
```

**Impact:** CRON_SECRET requires updating cron job headers.

#### REVEALUI_ADMIN_API_KEY (inter-service auth)

```bash
NEW_KEY=$(openssl rand -hex 32)
revvault set revealui/env/admin REVEALUI_ADMIN_API_KEY "$NEW_KEY"
# Must update in BOTH admin and api apps simultaneously
```

### Stripe

#### STRIPE_SECRET_KEY

1. Stripe Dashboard > Developers > API Keys > Roll key
2. Stripe provides a 72-hour overlap window with both keys valid
3. Update `revvault set revealui/env/stripe STRIPE_SECRET_KEY "sk_live_..."`
4. Redeploy api + admin
5. Verify: `curl -s https://api.revealui.com/health/ready | jq .status` (the consolidated readiness endpoint exercises the Stripe client during initialization)
6. Delete old key in Stripe after 24h observation

#### STRIPE_WEBHOOK_SECRET

1. Stripe Dashboard > Developers > Webhooks > Add endpoint (same URL, new secret)
2. Update `revvault set revealui/env/stripe STRIPE_WEBHOOK_SECRET "whsec_..."`
3. Redeploy api
4. Verify events arrive: check `processed_webhook_events` table
5. Delete old endpoint after 24h

### Database

#### POSTGRES_URL (NeonDB)

1. Neon Console > Connection pooling > Rotate password
2. Update connection string in RevVault
3. Redeploy all apps simultaneously (coordinate to minimize gap)
4. Verify with: `curl -s https://api.revealui.com/health/ready | jq .` (returns `db: healthy` plus connection details)

**Risk:** Brief downtime if stale connection pools exist. Use rolling deploy.

#### SUPABASE_DATABASE_URI — Legacy

> **Legacy — retired per ADR `2026-05-01-supabase-removal.md`. Current stack: Neon (primary) + ElectricSQL (sync).** Steps below are preserved for any legacy install that has not yet completed migration.

1. Supabase Dashboard > Project Settings > Database > Reset password
2. Update connection URI in RevVault
3. Redeploy
4. Verify vector search operations work

### AI / LLM Providers

All follow the same pattern — rotate in provider dashboard, update RevVault, redeploy, test:

| Provider | Dashboard | Env Var | Verify With |
|----------|-----------|---------|------------|
| Anthropic | console.anthropic.com | ANTHROPIC_API_KEY | Agent task execution |
| OpenAI | platform.openai.com | OPENAI_API_KEY | Chat completion |
| Tavily | app.tavily.com | TAVILY_API_KEY | Agent web search |
| Hugging Face | huggingface.co/settings/tokens | HF_TOKEN | Model downloads |

```bash
# Example: rotate Anthropic key
revvault set revealui/env/services ANTHROPIC_API_KEY "sk-ant-api03-..."
# Redeploy api, then test:
curl -X POST https://api.revealui.com/api/agent/health -H "Authorization: Bearer $TOKEN"
```

### OAuth Providers

#### Google (OAuth + Service Account)

```bash
# OAuth: Google Cloud Console > APIs > Credentials > OAuth 2.0
revvault set revealui/env/services GOOGLE_CLIENT_SECRET "GOCSPX-..."

# Service account: Console > IAM > Service Accounts > Keys > Add Key
revvault set revealui/env/services GOOGLE_PRIVATE_KEY "-----BEGIN PRIVATE KEY..."
revvault set revealui/env/services GOOGLE_SERVICE_ACCOUNT_EMAIL "...@...iam.gserviceaccount.com"
```

#### GitHub

```bash
# OAuth app: GitHub > Settings > Developer settings > OAuth Apps
revvault set revealui/env/services GITHUB_CLIENT_SECRET "..."

# Fine-grained PAT: Settings > Developer settings > Personal access tokens
revvault set revealui/env/services REVEALUI_GITHUB_TOKEN "github_pat_..."
```

### Deployment & CI

```bash
# Vercel API token: vercel.com > Settings > Tokens
revvault set revealui/env/core VERCEL_API_KEY "..."
# Also update in GitHub repo secrets: Settings > Secrets > VERCEL_TOKEN

# Sentry: sentry.io > Settings > Auth Tokens
# Update in GitHub repo secrets: SENTRY_AUTH_TOKEN

# Neon API: console.neon.tech > Account > API Keys
revvault set revealui/env/core NEON_API_KEY "..."
```

### Storage

```bash
# Cloudflare R2 (canonical object-storage backend): Cloudflare Dashboard > R2 > Manage API Tokens
# Rotate the R2 API token (Access Key ID + Secret Access Key are issued together).
revvault set revealui/prod/r2/access-key-id "..."
revvault set revealui/prod/r2/secret-access-key "..."
# Redeploy api + admin to pick up the new credentials.
```

---

## Post-Rotation Checklist

After every rotation:

- [ ] Verify app health endpoints return 200
- [ ] Check error monitoring (Sentry) for new auth failures
- [ ] Confirm webhook events still flow (Stripe, GitHub)
- [ ] Test sign-in flow (session secret rotation)
- [ ] Test AI agent task execution (LLM key rotation)
- [ ] Confirm cron jobs fire on schedule
- [ ] Update RevVault with new values
- [ ] Update Vercel env vars for all affected scopes (production, preview, development)
- [ ] Update GitHub Actions secrets if applicable
- [ ] Securely delete old keys/tokens from provider dashboards

---

## Emergency Rotation (Security Incident)

If a credential is compromised:

1. **Immediately revoke** the compromised key at the provider
2. Generate replacement following the procedure above
3. Deploy with `vercel deploy --prod --force` (skip cache)
4. Audit access logs for the compromised credential's scope
5. If REVEALUI_KEK or REVEALUI_SECRET: assume all encrypted data / sessions compromised
6. Notify affected users if PII was at risk (GDPR Article 34)
7. File incident report in the audit log

---

## RevVault Namespaces

All secrets are managed through RevVault. Namespace mapping:

| Namespace | Contains |
|-----------|---------|
| `revealui/env/core` | REVEALUI_SECRET, REVEALUI_KEK, VERCEL_API_KEY, NEON_API_KEY |
| `revealui/prod/r2` | R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET, R2_PUBLIC_BASE_URL |
| `revealui/env/license` | REVEALUI_LICENSE_PRIVATE_KEY, REVEALUI_LICENSE_PUBLIC_KEY, REVEALUI_LICENSE_ENCRYPTION_KEY |
| `revealui/env/stripe` | STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET, STRIPE_PUBLISHABLE_KEY, price IDs |
| `revealui/env/supabase` | SUPABASE_DATABASE_URI, SUPABASE_SERVICE_ROLE_KEY, anon key — **Legacy** (retired per ADR `2026-05-01-supabase-removal.md`) |
| `revealui/env/services` | ANTHROPIC_API_KEY, OPENAI_API_KEY, Google/GitHub OAuth, Workspace Gmail (`GOOGLE_SERVICE_ACCOUNT_EMAIL`, `GOOGLE_PRIVATE_KEY`, `EMAIL_FROM`) |
| `revealui/env/cron` | REVEALUI_CRON_SECRET |
| `revealui/env/admin` | REVEALUI_ADMIN_API_KEY, REVEALUI_ADMIN_EMAIL |
| `revealui/env/admin-url` | ADMIN_URL, API_URL |
| `revealui/env/npm` | NPM_TOKEN |
