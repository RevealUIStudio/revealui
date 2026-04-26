---
title: "Launch Checklist"
description: "Pre-launch verification checklist for RevealUI open-core monorepo production deployment"
last-updated: 2026-04-12
status: pre-launch
---

# Launch Checklist

Production readiness checklist for the RevealUI open-core monorepo. Complete every section before cutting a release. Items marked **(blocking)** must pass; items marked **(advisory)** are strongly recommended but will not halt the launch.

Run `pnpm preflight` to automate checks 1 through 8 in a single pass (15 validations).

---

## 1. Code Quality Gates

All gates must pass on the `main` branch before deploy.

- [ ] `pnpm gate` passes all three phases (quality, typecheck, test + build) **(blocking)**
- [ ] `pnpm lint` reports zero errors (Biome 2) **(blocking)**
- [ ] `pnpm typecheck:all` clean across all 31 workspaces **(blocking)**
- [ ] `pnpm test` passes the full test suite **(blocking)**
- [ ] `pnpm build` succeeds for all apps and packages **(blocking)**
- [ ] `pnpm validate:structure` confirms workspace structure integrity **(blocking)**
- [ ] `pnpm audit:any` reports zero avoidable `any` types **(advisory)**
- [ ] `pnpm audit:console` reports zero production console statements **(advisory)**
- [ ] `pnpm deps:check` (syncpack) reports no version mismatches **(advisory)**
- [ ] CI workflow `ci.yml` is green on the `main` branch **(blocking)**
- [ ] All PR checks pass before merge to `main` **(blocking)**

---

## 2. Security Verification

- [ ] `pnpm gate:security` passes in CI (`security.yml`) **(blocking)**
- [ ] `pnpm audit --audit-level=high` reports zero high/critical vulnerabilities **(blocking)**
- [ ] `pnpm secrets:scan` (Gitleaks) finds zero leaked secrets **(blocking)**
- [ ] CodeQL alerts: zero open alerts on GitHub **(blocking)**
- [ ] Dependabot alerts: zero open alerts on GitHub **(blocking)**
- [ ] AST code-pattern analyzer clean (execSync injection, TOCTOU, ReDoS) **(blocking)**
- [ ] No `.env` files tracked by git (only `.env.template` and `.env.example`) **(blocking)**
- [ ] CSP, CORS, and HSTS headers configured in `@revealui/security` **(blocking)**
- [ ] `proxy.ts` strips `overrideAccess` from external requests **(blocking)**
- [ ] Session cookies set with `httpOnly`, `secure`, `sameSite=lax` **(blocking)**
- [ ] Bcrypt cost factor is 12 rounds **(blocking)**
- [ ] AES-256-GCM encryption keys are non-extractable by default **(blocking)**
- [ ] Rate limiting active on auth endpoints and `/api/webhooks` (100 req/min) **(blocking)**
- [ ] RBAC + ABAC policy engine tests pass (58 enforcement tests) **(blocking)**
- [ ] `SECURITY.md` exists at repository root **(blocking)**
- [ ] Incident response plan reviewed: `docs/security/INCIDENT_RESPONSE.md` **(advisory)**
- [ ] `docs/security/INFORMATION_SECURITY_POLICY.md` reviewed and current **(advisory)**
- [ ] Credential rotation plan documented and tested **(advisory)**

---

## 3. Infrastructure Readiness

### Vercel

- [ ] Vercel projects linked for `api`, `admin`, and `marketing` apps **(blocking)**
- [ ] `vercel.json` present in each deployed app directory **(blocking)**
- [ ] Vercel Git Integration is **disabled** (deploys via `deploy.yml` only) **(blocking)**
- [ ] `deploy.yml` workflow succeeds on push to `main` **(blocking)**
- [ ] `deploy-test.yml` tested via manual dispatch for preview URLs **(advisory)**
- [ ] Vercel environment variables set for production (see section 5) **(blocking)**
- [ ] Turbo remote cache configured (`TURBO_TOKEN`, `TURBO_TEAM`) **(advisory)**

### GitHub Actions

- [ ] `ci.yml` runs on push/PR to `test` and `main` **(blocking)**
- [ ] `deploy.yml` triggers on push to `main` **(blocking)**
- [ ] `security.yml` runs on push, PR, and weekly schedule **(blocking)**
- [ ] `release.yml` configured for manual dispatch on `main` **(blocking)**
- [ ] `release-canary.yml` configured for push to `test` **(advisory)**
- [ ] Branch protection rules enforced on `main` and `test` **(blocking)**
- [ ] Required status checks configured (CI must pass before merge) **(blocking)**

### External Services

- [ ] NeonDB production database provisioned and accessible **(blocking)**
- [ ] Supabase project provisioned (vectors, auth) **(blocking)**
- [ ] ElectricSQL sync proxy running and connected to NeonDB **(blocking)**
- [ ] Vercel Blob Storage configured (`BLOB_READ_WRITE_TOKEN`) **(blocking)**

---

## 4. Database State

- [ ] `pnpm db:migrate` runs clean against production database **(blocking)**
- [ ] Migration drift check passes (validated in `deploy.yml`) **(blocking)**
- [ ] All 81 tables exist with correct schemas **(blocking)**
- [ ] `pnpm db:seed` populates required initial data (admin user, default site) **(blocking)**
- [ ] Indexes verified for high-traffic queries **(blocking)**
- [ ] `circuit_breaker_state` table exists (Stripe resilience) **(blocking)**
- [ ] Supabase vector tables provisioned and accessible **(blocking)**
- [ ] Database connection pooling configured for production load **(advisory)**
- [ ] Backup schedule confirmed for NeonDB and Supabase **(advisory)**
- [ ] Cross-DB cleanup tested: `@revealui/db/cleanup` for orphaned Supabase data **(advisory)**

---

## 5. Environment Variables

Refer to `docs/ENVIRONMENT-VARIABLES-GUIDE.md` for the full reference.

### Required (all environments)

- [ ] `REVEALUI_SECRET` set (session signing, CSRF, HMAC) **(blocking)**
- [ ] `REVEALUI_KEK` set (key-encryption key for AES-256-GCM) **(blocking)**
- [ ] `REVEALUI_PUBLIC_SERVER_URL` set **(blocking)**
- [ ] `NEXT_PUBLIC_SERVER_URL` set **(blocking)**
- [ ] `POSTGRES_URL` set (NeonDB connection string) **(blocking)**
- [ ] `BLOB_READ_WRITE_TOKEN` set (Vercel Blob Storage) **(blocking)**
- [ ] `STRIPE_SECRET_KEY` set (live key, not `sk_test_*`) **(blocking)**
- [ ] `STRIPE_WEBHOOK_SECRET` set (live webhook signing secret) **(blocking)**
- [ ] `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` set (live key, not `pk_test_*`) **(blocking)**

### Optional (recommended for production)

- [ ] `REVEALUI_ADMIN_EMAIL` and `REVEALUI_ADMIN_PASSWORD` set for initial admin **(advisory)**
- [ ] `REVEALUI_CORS_ORIGINS` configured for production domains **(blocking)**
- [ ] Supabase variables set: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_DATABASE_URI` **(blocking)**
- [ ] ElectricSQL variables set: `NEXT_PUBLIC_ELECTRIC_SERVICE_URL`, `ELECTRIC_SERVICE_URL` **(blocking)**
- [ ] Sentry variables set: `NEXT_PUBLIC_SENTRY_DSN`, `SENTRY_AUTH_TOKEN`, `SENTRY_ORG`, `SENTRY_PROJECT` **(advisory)**

### Validation

- [ ] `.env.template` contains all required variable names **(blocking)**
- [ ] No secrets hardcoded in source code **(blocking)**
- [ ] Production env vars differ from test/development values **(blocking)**
- [ ] `SKIP_ENV_VALIDATION` is **not** set in production **(blocking)**

---

## 6. Stripe and Billing Verification

Complete the Stripe checkout checklist at `docs/checklists/stripe-checkout-verification.md` before switching to live keys.

### Configuration

- [ ] Stripe account in **live mode** (not test mode) **(blocking)**
- [ ] Live API keys set in production environment **(blocking)**
- [ ] Webhook endpoint registered: `https://api.yourdomain.com/api/webhooks/stripe` **(blocking)**
- [ ] Webhook signing secret set for live endpoint **(blocking)**
- [ ] Webhook events configured: `checkout.session.completed`, `invoice.paid`, `invoice.payment_failed`, `customer.subscription.updated`, `customer.subscription.deleted` **(blocking)**

### Track A: SaaS Subscriptions

- [ ] Pro ($49/mo), Max ($149/mo), Enterprise ($299/mo) price IDs created in Stripe **(blocking)**
- [ ] Trial period configured if applicable (`REVEALUI_TRIAL_DAYS`) **(advisory)**
- [ ] Subscription lifecycle tested: create, upgrade, downgrade, cancel **(blocking)**
- [ ] License records created in DB on `checkout.session.completed` **(blocking)**

### Track B: Agent Credits

- [ ] Metered billing product created in Stripe ($0.001/task) **(blocking)**
- [ ] Usage reporting pipeline verified **(blocking)**

### Track C: Perpetual Licenses

- [ ] Pro ($299), Max ($799), Enterprise ($1,999) one-time price IDs created **(blocking)**
- [ ] `support_expires_at` set correctly (1 year from purchase) **(blocking)**

### Track D: Professional Services

- [ ] Service products created in Stripe (architecture review, migration, consulting) **(advisory)**

### Circuit Breaker

- [ ] Stripe circuit breaker tested (DB-backed `circuit_breaker_state` table) **(advisory)**
- [ ] Graceful degradation verified when Stripe is unreachable **(advisory)**

---

## 7. DNS and Domains

- [ ] Production domain configured (e.g., `revealui.com`) **(blocking)**
- [ ] `admin.yourdomain.com` points to Vercel admin project **(blocking)**
- [ ] `api.yourdomain.com` points to Vercel API project **(blocking)**
- [ ] Marketing site at root domain points to Vercel marketing project **(blocking)**
- [ ] SSL/TLS certificates provisioned and valid (Vercel auto-manages these) **(blocking)**
- [ ] DNS propagation verified for all subdomains **(blocking)**
- [ ] `REVEALUI_PUBLIC_SERVER_URL` and `NEXT_PUBLIC_SERVER_URL` use final production URLs **(blocking)**
- [ ] CORS origins updated to match production domains **(blocking)**
- [ ] Email domain verified (MX, SPF, DKIM, DMARC) for `@revealui.com` **(advisory)**

---

## 8. Documentation Completeness

The `pnpm preflight` script checks for these files automatically.

- [ ] `docs/LAUNCH-CHECKLIST.md` (this file) **(blocking)**
- [ ] `docs/ENVIRONMENT-VARIABLES-GUIDE.md` **(blocking)**
- [ ] `SECURITY.md` at repository root **(blocking)**
- [ ] `LICENSE` at repository root (MIT for OSS packages) **(blocking)**
- [ ] `README.md` at repository root **(blocking)**
- [ ] `CHANGELOG.md` generated by Changesets **(blocking)**
- [ ] `docs/QUICK_START.md` **(blocking)**
- [ ] `docs/guides/deployment.md` **(blocking)**
- [ ] `docs/guides/authentication.md` **(advisory)**
- [ ] `docs/guides/billing.md` **(advisory)**
- [ ] `docs/PUBLISHING.md` **(advisory)**
- [ ] `docs/security/INCIDENT_RESPONSE.md` **(advisory)**
- [ ] Each publishable package has a `README.md` and `license` field in `package.json` **(blocking)**
- [ ] `docs/PRO.md` covers Fair Source licensing terms (FSL-1.1-MIT) **(blocking)**
- [ ] API documentation (`docs/api/`) is current **(advisory)**

---

## 9. npm Package Publishing

Refer to `docs/PUBLISHING.md` for the full workflow.

### Pre-publish

- [ ] All changesets committed and reviewed **(blocking)**
- [ ] `pnpm changeset:status` shows expected version bumps **(blocking)**
- [ ] `pnpm release:dry-run` succeeds locally **(blocking)**
- [ ] OIDC trusted publishing configured on npmjs.org for each package **(blocking)**
- [ ] `release.yml` workflow has `id-token: write` permission **(blocking)**
- [ ] npm `npm-publish` environment configured in GitHub repo settings **(blocking)**

### Publishable OSS Packages

Verify each package is ready for its initial publish:

- [ ] `@revealui/core` **(blocking)**
- [ ] `@revealui/contracts` **(blocking)**
- [ ] `@revealui/db` **(blocking)**
- [ ] `@revealui/auth` **(blocking)**
- [ ] `@revealui/presentation` **(blocking)**
- [ ] `@revealui/router` **(blocking)**
- [ ] `@revealui/config` **(blocking)**
- [ ] `@revealui/utils` **(blocking)**
- [ ] `@revealui/cli` (already published @0.3.4) **(blocking)**
- [ ] `@revealui/setup` **(blocking)**
- [ ] `@revealui/sync` **(blocking)**
- [ ] `@revealui/dev` **(blocking)**
- [ ] `create-revealui` (already published @0.3.4) **(blocking)**

### Post-publish

- [ ] Verify packages appear on npmjs.org with correct versions **(blocking)**
- [ ] Provenance attestations present (SLSA Build Level 2) **(blocking)**
- [ ] `npm install @revealui/core` works in a clean project **(blocking)**
- [ ] Canary releases tested via `release-canary.yml` before stable publish **(advisory)**

---

## 10. Post-Launch Monitoring

Set up within the first 24 hours after launch.

### Error Tracking

- [ ] Sentry configured and receiving events from all deployed apps **(blocking)**
- [ ] Error alerting thresholds set (e.g., spike detection) **(advisory)**
- [ ] Source maps uploaded to Sentry for each deployment **(advisory)**

### Uptime and Health

- [ ] Health check endpoint live: `GET /api/health` returns 200 **(blocking)**
- [ ] Uptime monitoring configured (e.g., Vercel Checks, external ping) **(blocking)**
- [ ] Database connection health monitored **(advisory)**
- [ ] ElectricSQL sync proxy health monitored **(advisory)**

### Billing

- [ ] Stripe webhook delivery monitored in Stripe Dashboard **(blocking)**
- [ ] Failed payment alerts configured **(advisory)**
- [ ] License creation flow verified end-to-end in production **(blocking)**

### Performance

- [ ] Core Web Vitals baselined for admin and marketing apps **(advisory)**
- [ ] API response time baseline established **(advisory)**
- [ ] Turbo remote cache hit rate monitored **(advisory)**

### Security (ongoing)

- [ ] `security.yml` weekly schedule confirmed running **(blocking)**
- [ ] GitHub secret scanning enabled **(blocking)**
- [ ] Dependabot auto-PRs enabled for security updates **(blocking)**

---

## 11. Rollback Plan

Document and test the rollback procedure before launch.

### Vercel Rollback

- [ ] Identify current production deployment IDs for `api`, `admin`, `marketing` **(blocking)**
- [ ] Verify Vercel instant rollback works: `vercel rollback <deployment-url>` **(blocking)**
- [ ] Confirm rollback does not require a new build (Vercel keeps previous builds) **(blocking)**

### Database Rollback

- [ ] NeonDB point-in-time restore tested **(blocking)**
- [ ] Migration rollback scripts exist for the latest migration **(advisory)**
- [ ] Supabase backup restore procedure documented **(advisory)**

### npm Rollback

- [ ] Know how to deprecate a broken package version: `npm deprecate @revealui/core@x.y.z "reason"` **(advisory)**
- [ ] Know how to unpublish within 72 hours if critical issue found **(advisory)**

### Communication

- [ ] Status page or communication channel ready for incident updates **(advisory)**
- [ ] Incident response contacts confirmed: `security@revealui.com`, `founder@revealui.com` **(blocking)**

### Rollback Decision Criteria

If any of the following occur within the first 48 hours, initiate rollback:

1. Unrecoverable data corruption in production database.
2. Authentication bypass or credential exposure.
3. Stripe webhook processing failure rate exceeds 5%.
4. Health check endpoint returns non-200 for more than 10 consecutive minutes.
5. Error rate in Sentry exceeds 100 events per minute.

---

## Sign-off

| Role | Name | Date | Signature |
|------|------|------|-----------|
| Engineering | | | |
| Security | | | |
| Operations | | | |
