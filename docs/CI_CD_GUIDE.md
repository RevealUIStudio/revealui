---
title: "CI/CD & Deployment"
description: "GitHub Actions workflows, Vercel deploy pipeline, Fleet self-hosted Docker stack, rollback"
category: operations
audience: maintainer
---

# RevealUI CI/CD & Deployment Guide

**Scope:** how the live CI gates and production deploy actually work in this monorepo, plus the Fleet self-hosted Docker path (the runtime kit RevForge produces). For env-var details see [Environment Variables Guide](./ENVIRONMENT-VARIABLES-GUIDE.md). For local dev see [Quick Start](./QUICK_START.md).

> **Secrets policy:** revvault is the source of truth for every credential. `.env.development.local` is acceptable as a developer convenience populated from `revvault export-env`; never as a primary store. CI mirrors revvault into GitHub Actions secrets at deploy time. See [`SECURITY.md`](../SECURITY.md) and [Environment Variables Guide](./ENVIRONMENT-VARIABLES-GUIDE.md) for detail.

---

## Branch pipeline

```
feature/* ──PR──▶ test ──PR──▶ main
                    │              │
                   CI         production deploy
```

| Branch | Environment | CI gate | Deploy |
|--------|------------|---------|--------|
| `main` | production | Full gate + integration + E2E + coverage | Auto on push (`deploy.yml`) |
| `test` | QA / staging | Full gate (quality + typecheck + tests + build) | Manual only (`deploy-test.yml` workflow_dispatch) |
| `feature/*` | local | PR-level: affected-only typecheck + build, unit tests | None |

- Default branch: `test` (PRs target it by default).
- Production deploys: `deploy.yml` on push to `main` only — Vercel Git Integration is disabled.
- Test previews: `deploy-test.yml` is `workflow_dispatch`-only; produces Vercel preview URLs (Hobby-tier deploy quota).
- npm releases: manual dispatch via `release.yml` (OIDC, SLSA B2 provenance).

Source: [`CLAUDE.md`](../CLAUDE.md) §Branch Pipeline.

---

## Workflows

All workflows live in [`.github/workflows/`](../.github/workflows/).

| File | Trigger | Purpose |
|------|---------|---------|
| [`ci.yml`](../.github/workflows/ci.yml) | push/PR to `test`/`main` | Two-tier CI gate: quality + typecheck + tests + build (test); + integration + E2E + coverage (main) |
| [`security.yml`](../.github/workflows/security.yml) | push/PR + weekly Mon 09:00 UTC | Native security gate: `pnpm audit`, custom secret/credential checks |
| [`deploy.yml`](../.github/workflows/deploy.yml) | push to `main`, workflow_dispatch | Production deploy: validate → migrate → detect-affected → matrix deploy → smoke test → auto-rollback on failure |
| [`deploy-test.yml`](../.github/workflows/deploy-test.yml) | workflow_dispatch | On-demand QA preview deploys (Vercel preview env, manual only) |
| [`release.yml`](../.github/workflows/release.yml) | workflow_dispatch | OSS npm publish via OIDC trusted publishing (SLSA Build Level 2 provenance) |
| [`docker.yml`](../.github/workflows/docker.yml) | workflow_dispatch | Build & push Fleet self-hosted Docker images (`server` + `admin`) to GHCR |
| [`db-backup.yml`](../.github/workflows/db-backup.yml) | scheduled | NeonDB-side backup hooks (PITR coordination) |
| [`reconciliation-crons.yml`](../.github/workflows/reconciliation-crons.yml) | scheduled | Stripe + RVC reconciliation jobs |
| [`webhook-reconciliation.yml`](../.github/workflows/webhook-reconciliation.yml) | scheduled | Stripe webhook event-replay safety net |
| [`regen-visual-snapshots.yml`](../.github/workflows/regen-visual-snapshots.yml) | workflow_dispatch | Regenerate Playwright visual-regression snapshots |
| [`system-tune-snapshot.yml`](../.github/workflows/system-tune-snapshot.yml) | scheduled | Performance-baseline snapshot |
| [`no-submodules.yml`](../.github/workflows/no-submodules.yml) | push/PR | Hard-fail if a `.gitmodules` is added |

Pinned action versions and SHAs are kept in lockstep with Renovate (`renovate.json5`).

---

## Production deploy (`deploy.yml`)

The real pipeline is six stages, all defined in [`deploy.yml`](../.github/workflows/deploy.yml):

1. **`validate`** — install, build `@revealui/db`, run `drizzle-kit generate` to detect uncommitted schema drift; pull Vercel `production` env for the `api` project; run `pnpm validate:prod-env` (mirrors `validateStartup` in [`apps/server/src/lib/validate-startup.ts`](../apps/server/src/lib/validate-startup.ts) — presence + format checks for every required var, including the `sk_test_` / live-mode mismatch trap and the `REVEALUI_CRON_SECRET ≥ 32 chars` rule that closed GAP-125).
2. **`migrate`** — run `pnpm db:backfill-migrations` (defense against half-applied state), then `pnpm --filter @revealui/db db:migrate` (drizzle-kit), then `pnpm db:assert-migration-count` (post-migrate row-count assertion). Output forced to non-color and tee'd through `tr '\r' '\n'` so drizzle-kit's spinner doesn't eat the trailing error message on failure.
3. **`detect`** — diff `HEAD~1..HEAD` to compute the affected-app list. Apps known to the matrix: `api`, `admin`, `marketing`, `docs`, `revealcoin`. Shared package or root config change → all apps. Workflow `inputs.apps` allows manual override (`all`, comma-list, or `auto`).
4. **`deploy`** — fan-out matrix; each app pulls its own Vercel project env, builds via `vercel build --prod`, and publishes via `vercel deploy --prebuilt --prod`. Project IDs are hardcoded in the workflow (one per app).
5. **`smoke-test`** — poll `${API_URL}/health/ready` (12 × 10 s) and `${ADMIN_URL}` for HTTP 200. The api `/health/ready` checks DB + memory + config (see [`apps/server/src/routes/health.ts`](../apps/server/src/routes/health.ts) and [`apps/admin/src/app/api/health/ready/route.ts`](../apps/admin/src/app/api/health/ready/route.ts)).
6. **`smoke-test` failure path** — auto-rollback. Per-app: `vercel ls --prod` → take 2nd-most-recent ready URL → `vercel rollback <url>` → re-poll `vercel ls` to confirm the alias moved (GAP-128: `vercel rollback` with no URL is a status query, not an action — the URL must be passed). On any rollback failure, the workflow exits non-zero so the broken-deploy-still-live signal surfaces immediately.

### Required GitHub Secrets

| Secret | Used by | Source of truth |
|--------|---------|-----------------|
| `VERCEL_TOKEN` | every Vercel-touching job | revvault `revealui/prod/vercel/api-token` |
| `VERCEL_ORG_ID` | env var | revvault |
| `PROD_POSTGRES_URL` | `migrate` job (mirrored from Vercel `api` project's `POSTGRES_URL` because `vercel env pull` returns empty string for Sensitive vars) | revvault `revealui/prod/db/postgres-url` |
| `TURBO_TOKEN` | turbo remote cache (falls back to `VERCEL_TOKEN`) | revvault |
| `GITHUB_TOKEN` | provided automatically; used by `docker.yml` to push to GHCR | n/a |

GitHub Actions secrets are downstream mirrors of revvault — never primary. Rotation = `revvault set --force <path>` then re-publish to GitHub Actions / Vercel.

> **Long-term:** `revvault-vercel-sync` Phase 5 replaces the `PROD_POSTGRES_URL` mirror by using revvault as the canonical source for both Vercel and the workflow secret. Until then, the mirror is the documented exception.

---

## CI gate (`ci.yml`)

The gate is two-tier (test branch = lighter, main branch = full). Quality phase runs first and is hard-fail for:

- `pnpm lint` (Biome)
- `pnpm validate:structure`, `pnpm validate:versions`
- `pnpm validate:boundary` (workspace import boundaries)
- `pnpm validate:claims` (claim-drift validator)
- `pnpm validate:migrations` (migration journal)
- `pnpm validate:raw-sql` (no raw SQL outside of allowlisted callsites)
- `pnpm validate:empty-catch`
- `pnpm validate:changesets` (catches mixed ignored / non-ignored changeset frontmatter pre-merge)

Warn-only: `pnpm audit:any`, `pnpm audit:console`.

Then the migration-apply job runs every PR/push against a fresh Postgres (catches DDL errors PGlite tests can't see). Then typecheck, unit tests, build. On `main`, also: integration tests, E2E (Playwright smoke + visual regression), coverage.

### Local CI gate

```bash
pnpm gate           # Full CI gate (quality + types + tests + build)
pnpm gate:quick     # Phase 1 only (quality)
pnpm gate:security  # Security gate
pnpm gate:types     # Typecheck only
```

Source: [`scripts/gates/ci-gate.ts`](../scripts/gates/ci-gate.ts).

---

## Vercel deployment

### Project layout

Each app is a separate Vercel project (own project ID, own env scope). Build command for every project:

```bash
pnpm vercel-build   # = "cd ../.. && pnpm turbo build --filter=<app>"
```

Each app's `vercel-build` script lives in `apps/<app>/package.json`. Output directory is the standard Next.js `.next` (admin) or Vite `dist` (docs / marketing / revealcoin).

### Standalone output (admin)

[`apps/admin/next.config.mjs`](../apps/admin/next.config.mjs) sets `output: 'standalone'` so the production image bundles only required dependencies. The `Dockerfile.forge` build (which produces the Fleet self-hosted image) relies on this path layout.

### Manual deploy / promote

```bash
vercel ls --prod                                    # list current production deploys
vercel logs <deployment-url>                        # live logs
vercel inspect <deployment-url>                     # deployment metadata
vercel rollback <previous-good-url> --token=...     # alias swap (the rollback path used by deploy.yml)
```

Hardcoded Vercel project IDs are stored in [`deploy.yml`](../.github/workflows/deploy.yml) (one per app: `api`, `admin`, `marketing`, `docs`, `revealcoin`).

---

## Required environment variables

The complete list is in [Environment Variables Guide](./ENVIRONMENT-VARIABLES-GUIDE.md). Minimum production set:

```env
# Core
REVEALUI_SECRET=<openssl rand -hex 32>
REVEALUI_PUBLIC_SERVER_URL=https://admin.revealui.com
NEXT_PUBLIC_SERVER_URL=https://admin.revealui.com

# Database
POSTGRES_URL=postgresql://user:pass@host/db?sslmode=require

# Storage
BLOB_READ_WRITE_TOKEN=vercel_blob_rw_xxx

# Stripe (live keys for prod)
STRIPE_SECRET_KEY=sk_live_xxx
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_live_xxx
STRIPE_WEBHOOK_SECRET=whsec_xxx
```

Generate `REVEALUI_SECRET`:

```bash
bash scripts/generate-secret.sh
```

`POSTGRES_URL` MUST include `sslmode=require` for production (NeonDB requires SSL). The `validate:prod-env` gate fails the deploy if any required var is missing or malformed.

---

## Monitoring

### Sentry

Configured at [`apps/admin/next.config.mjs`](../apps/admin/next.config.mjs) (top-of-file `import sentryModule from '@sentry/nextjs'`). Activated when `NEXT_PUBLIC_SENTRY_DSN` is set in the environment. Manual capture:

```typescript
import * as Sentry from '@sentry/nextjs'

try {
  // ...
} catch (error) {
  Sentry.captureException(error, { tags: { component: 'user-service' } })
}
```

User context: `Sentry.setUser({ id, email })`.

### Vercel Analytics + Speed Insights

Wired into [`apps/admin/src/instrumentation.ts`](../apps/admin/src/instrumentation.ts) and the admin root layout. Speed Insights captures Core Web Vitals (LCP, FID, CLS) plus RUM. View metrics in the Vercel dashboard for each project.

### Health endpoints

| Endpoint | Path | Returns |
|----------|------|---------|
| api ready | `https://api.revealui.com/health/ready` | DB + memory + config (200 = ready) |
| api live | `https://api.revealui.com/health/live` | process up (200 = live) |
| admin | `https://admin.revealui.com/api/health` | basic OK |
| admin live | `https://admin.revealui.com/api/health/live` | process up |
| admin ready | `https://admin.revealui.com/api/health/ready` | DB + dependencies |

These are the URLs the deploy-time smoke test polls.

---

## Rollback

### Auto-rollback

`deploy.yml` runs the `smoke-test` job after `deploy`. On any health-check failure, the workflow:

1. Lists production deploys for each affected Vercel project.
2. Picks the 2nd-most-recent ready URL (the most-recent IS the broken deploy).
3. Calls `vercel rollback <url>` to swap the alias.
4. Re-polls `vercel ls --prod` to verify the alias moved.
5. On rollback failure or no-history, exits non-zero and emits `::error::` annotations so the broken deploy is visibly still live.

### Manual rollback (Vercel dashboard)

1. https://vercel.com/dashboard → select project.
2. Deployments tab → find the last known-good deploy.
3. "..." menu → "Promote to Production".
4. Verify: `curl https://api.revealui.com/health/ready` and `curl https://admin.revealui.com/api/health`.

### Manual rollback (Git revert)

A `git revert` on `main` re-runs the full `deploy.yml` pipeline (validate → migrate → deploy → smoke). Migrations are additive-only by convention, so a code revert won't roll back the schema — schema reversion is a separate, manually-authored migration.

```bash
git checkout main && git pull --ff-only origin main
git revert <bad-sha>
git push origin main          # triggers deploy.yml
```

### Database rollback

NeonDB provides point-in-time recovery (7 days free, 30 days Pro). Restore via the Neon console or CLI. There is no `pnpm db:rollback` script — schema is forward-only, and reverting requires authoring a new additive migration.

---

## Fleet self-hosted Docker stack

`docker.yml` (workflow_dispatch) builds two images and pushes them to `ghcr.io/revealuistudio`:

| Image | Built from |
|-------|-----------|
| `ghcr.io/revealuistudio/revealui-api:<tag>` | [`apps/server/Dockerfile.forge`](../apps/server/Dockerfile.forge) |
| `ghcr.io/revealuistudio/revealui-admin:<tag>` | [`apps/admin/Dockerfile.forge`](../apps/admin/Dockerfile.forge) |

Image tags applied: `:latest`, `:sha-<short-sha>` (immutable), `:v<version>` (when `inputs.version` is provided).

Self-hosting customers run the Forge stack via:

```bash
cp .env.template .env.forge       # fill in required vars
docker compose -f docker-compose.forge.yml --env-file .env.forge up -d
```

Required `.env.forge` vars (from [`docker-compose.forge.yml`](../docker-compose.forge.yml) header):

- `REVFORGE_LICENSE_KEY` — enterprise license
- `REVFORGE_LICENSED_DOMAIN` — domain this instance serves
- `POSTGRES_PASSWORD`
- `REVEALUI_SECRET` — 32+ chars
- `JWT_SECRET` — 32+ chars
- `REVEALUI_PUBLIC_KEY` / `REVEALUI_PRIVATE_KEY` — RSA key pair for license verify/issue
- `RESEND_API_KEY` — optional (transactional email)

The dev compose file (root `docker-compose.yml`) is for local self-hosting demos; the Forge compose adds resource limits, real secrets management, and license enforcement.

### ElectricSQL production

If using ElectricSQL (`infrastructure/docker-compose/services/electric.yml`), ensure for production:

- `ELECTRIC_INSECURE` is **unset or `false`** — never `true` in prod.
- `ELECTRIC_SECRET` is set to a 32+-char random value (`openssl rand -hex 32`).
- `AUTH_MODE=jwt` with `AUTH_JWT_KEY` configured.
- Database URL uses `sslmode=require`.

The dev `electric.yml` is `ELECTRIC_INSECURE=true` for ergonomics; that flag is a hard-fail in production.

---

## Common commands (real, registered scripts)

### Database

```bash
pnpm db:init                       # initialize tables
pnpm db:migrate                    # drizzle-kit migrate
pnpm db:reset                      # drop + reinit (local only)
pnpm db:seed                       # admin + billing seeds
pnpm db:backfill-migrations        # recover from drift
pnpm db:assert-migration-count     # post-migrate sanity check
```

Source: [`package.json`](../package.json) scripts block.

### Quality / gates

```bash
pnpm lint                          # Biome lint
pnpm typecheck:all                 # TS across all workspaces
pnpm gate                          # Full CI gate locally
pnpm gate:quick                    # Phase 1 only
pnpm gate:security                 # Security gate
pnpm validate:prod-env             # Mirror of deploy.yml's prod-env validation
pnpm validate:claims               # Claim-drift
pnpm preflight                     # Full pre-launch checklist
```

### Tests

```bash
pnpm test                          # all unit + integration (Vitest)
pnpm test:coverage
pnpm test:e2e                      # Playwright E2E
pnpm test:integration
```

### Release (npm)

```bash
pnpm changeset                     # author a changeset
pnpm changeset:version             # bump versions per changesets
pnpm changeset:status              # which changesets are pending
pnpm release                       # tsx scripts/cli/release.ts
pnpm release:dry-run               # preview without publishing
pnpm release:status
```

The `release.yml` workflow is the canonical npm publisher (OIDC, SLSA B2 provenance). Triggered manually from the GitHub Actions UI.

---

## Troubleshooting

### Pre-deploy `validate:prod-env` fails

The validator mirrors [`apps/server/src/lib/validate-startup.ts`](../apps/server/src/lib/validate-startup.ts). Common causes:

- A `sk_test_*` Stripe key with `STRIPE_LIVE_MODE=true`.
- `REVEALUI_CRON_SECRET` shorter than 32 chars.
- Missing `REVEALUI_LICENSE_PRIVATE_KEY` in Forge mode.
- Sensitive var (`POSTGRES_URL`) returned empty by `vercel env pull` — fix at the Vercel project's env config.

### `migrate` job fails

Output is forced through `tr '\r' '\n'` because drizzle-kit's spinner overwrites lines and eats the error. Search the log for `error:` or the SQL filename. Defense layers:

- `db:backfill-migrations` (pre-migrate) — catches the `__drizzle_migrations` row missing for a journal entry (the 2026-04-20 incident class).
- `db:assert-migration-count` (post-migrate) — fails if applied count ≠ journal entries.

If migrations diverged, generate a corrective additive migration locally via `drizzle-kit generate` and commit before re-running.

### `smoke-test` fails → auto-rollback ran

Check the Actions log for the rollback summary:

```
=== Rollback summary ===
Failed:     N
No history: M
```

If `Failed > 0` or `No history > 0`, the broken deploy may still be live — `vercel ls --prod` to confirm and roll the alias manually with `vercel rollback <url>`.

### Build failures

- Missing env var → `validate:prod-env` should have caught it. If it didn't, add the var to the validator's required list.
- Type errors → run `pnpm typecheck:all` locally; CI's `Phase 2` job catches these but they should fail PR earlier.
- Module-resolution errors → most often a missing `workspace:*` dep or a pro-package alias mismatch. Check [`apps/admin/next.config.mjs`](../apps/admin/next.config.mjs)'s `proAIAliases` block.

### Health check failures (smoke-test)

- `/health/ready` returns 503 → DB connectivity, memory, or config check failed. Check Vercel function logs for the failing branch.
- `/health/live` returns OK but `/health/ready` doesn't → process is up but a dependency is degraded.
- Use `vercel logs <deployment-url>` to tail logs.

### CI `Drizzle migration apply` fails

This job runs every migration against a fresh Postgres. Catches DDL errors PGlite-based unit tests can't see (non-idempotent `ADD CONSTRAINT`, missing extensions, type mismatches, out-of-band `.sql` files).

---

## Security checklist

- [ ] `REVEALUI_SECRET` ≥ 32 chars, unique per environment.
- [ ] Stripe live keys in production; test keys in dev.
- [ ] `POSTGRES_URL` uses `sslmode=require`.
- [ ] All secrets sourced from revvault, mirrored to GitHub Actions / Vercel as needed.
- [ ] `validate:prod-env` is green before merge to `main`.
- [ ] `ELECTRIC_INSECURE` is unset or `false` in any production stack.
- [ ] No `.env*` files committed (pre-commit hook enforces).
- [ ] CodeQL + Dependabot warnings reviewed weekly (Actions Security tab).
- [ ] CSP / CORS / HSTS headers verified in [`@revealui/security`](../packages/security/).

---

## Why no Kubernetes manifests in this repo

RevealUI ships two deployment paths and only two: Vercel for hosted SaaS (via [`deploy.yml`](../.github/workflows/deploy.yml)) and Fleet self-hosted Docker images via [`docker.yml`](../.github/workflows/docker.yml) → GHCR for enterprise customers (consumed by [`docker-compose.forge.yml`](../docker-compose.forge.yml); filename keeps the `forge` prefix because RevForge is the operator-side stamping tool that produces the Fleet kit). Vercel and Cloudflare are friendly deploy targets — RevealUI runs on both. Kubernetes is not a supported target.

Earlier scaffolding under `infrastructure/k8s/`, `scripts/{deploy,rollback}.sh`, `infrastructure/docker-compose/production.yml`, and `infrastructure/scripts/deployment/staging-deploy.sh` was aspirational and never wired to production. It was removed alongside this guide's shrink — see [`docs/decisions/2026-05-08-deployment-target-vercel-not-k8s.md`](./decisions/2026-05-08-deployment-target-vercel-not-k8s.md) for the full decision record, including the recovery path if a future Kubernetes pivot becomes necessary.

---

## Related documentation

- [Environment Variables Guide](./ENVIRONMENT-VARIABLES-GUIDE.md) — every env var, with revvault paths
- [Database Guide](./DATABASE.md) — schema, migrations, NeonDB
- [Quick Start](./QUICK_START.md) — local dev setup
- [Testing Guide](./TESTING.md)
- [Troubleshooting Guide](./TROUBLESHOOTING.md) — broader troubleshooting beyond CI/CD
- [`SECURITY.md`](../SECURITY.md) — security posture (CSP, headers, RBAC, audit)
- [`CLAUDE.md`](../CLAUDE.md) — branch pipeline + package map (canonical)
