---
title: Deployment Runbook
description: Step-by-step procedures for deploying RevealUI apps, publishing npm packages, running migrations, and handling rollbacks.
last-updated: 2026-04-12
status: active
---

# Deployment Runbook

Operational procedures for deploying the RevealUI monorepo. Covers standard releases, hotfixes, rollbacks, database migrations, and npm package publishing.

## Table of Contents

1. [Pre-Deployment Checklist](#1-pre-deployment-checklist)
2. [Standard Deployment (test to main)](#2-standard-deployment)
3. [Hotfix Deployment](#3-hotfix-deployment)
4. [Rollback Procedures](#4-rollback-procedures)
5. [Database Migration Steps](#5-database-migration-steps)
6. [npm Package Publishing](#6-npm-package-publishing)
7. [Environment Variable Management](#7-environment-variable-management)
8. [Monitoring and Verification](#8-monitoring-and-verification)
9. [Incident Response](#9-incident-response)

---

## 1. Pre-Deployment Checklist

Run these checks before promoting any code to `main`.

### Local Validation

```bash
# Run the full CI gate locally
pnpm gate

# If gate:quick is sufficient for a focused check
pnpm gate:quick
```

The gate runs three phases in order:

1. **Quality** (parallel): Biome lint (hard fail), any-type audit, console audit, structure validation, boundary validation
2. **Typecheck** (serial): `pnpm -r typecheck` across all workspaces
3. **Test + Build** (parallel): Vitest (hard fail), Turborepo build (hard fail)

### Confirm These Before Merging to main

- [ ] All CI checks pass on the `test` branch PR
- [ ] No uncommitted database migration drift (`drizzle-kit generate` produces no new files)
- [ ] Changesets are committed for any packages that need version bumps
- [ ] Environment variables for new features are set in Vercel (see [Section 7](#7-environment-variable-management))
- [ ] If a preview deploy is needed, trigger `deploy-test.yml` manually and verify preview URLs
- [ ] PR has been reviewed and approved

---

## 2. Standard Deployment

The standard flow promotes code from `test` to `main`, which triggers automatic production deployment.

### Branch Pipeline

```
feature/* --PR--> test --PR--> main
                   |             |
             CI + canary    production deploy (auto)
```

### Step-by-Step

1. **Merge feature branch into test.**
   Open a PR from `feature/*` to `test`. CI runs automatically (quality, typecheck, tests, build). Canary npm packages are published on merge via `release-canary.yml`.

2. **Verify on test branch.**
   After CI passes on `test`, optionally trigger a preview deploy:
   - Go to Actions > Deploy Test (Preview) > Run workflow
   - Select apps to deploy (default: all)
   - Review the preview URLs in the workflow output

3. **Open PR from test to main.**
   CI runs the full gate including integration tests and E2E on the PR. All checks must pass before merge.

4. **Merge to main.**
   On push to `main`, the `deploy.yml` workflow runs automatically:
   - **Validate**: Checks for migration drift
   - **Migrate**: Applies pending database migrations (runs before deploy so new schema exists before new code)
   - **Detect**: Identifies affected apps via git diff (shared package changes deploy all apps)
   - **Deploy**: Builds and deploys affected apps to Vercel production in parallel
   - **Smoke test**: Health checks against `api.revealui.com/health/ready` and `admin.revealui.com`
   - **Auto-rollback**: If smoke tests fail, all deployed apps are rolled back automatically

5. **Verify production.** See [Section 8](#8-monitoring-and-verification).

### Deployed Apps

| App | Framework | Production URL |
|-----|-----------|---------------|
| api | Hono REST | api.revealui.com |
| admin | Next.js 16 | admin.revealui.com |
| marketing | Next.js | revealui.com |
| docs | Vite/React | docs.revealui.com |

### Manual Production Deploy

If the automatic deploy needs to be re-triggered or scoped to specific apps:

```
Actions > Deploy > Run workflow
  apps: "api,admin"    (comma-separated, or "all")
```

---

## 3. Hotfix Deployment

For urgent production fixes that cannot wait for the standard test-to-main flow.

### Procedure

1. **Create a hotfix branch from main.**

   ```bash
   git checkout main
   git pull origin main
   git checkout -b fix/critical-issue-description
   ```

2. **Apply the fix, run the gate.**

   ```bash
   # Make your changes
   pnpm gate:quick          # fast local validation
   pnpm gate                # full gate if time permits
   ```

3. **Open a PR directly to main.**
   CI runs the full gate (quality, typecheck, tests, build, integration, E2E). Mark the PR as urgent in the description.

4. **Merge to main.**
   Production deploy triggers automatically. Monitor the deploy workflow and smoke tests.

5. **Backport to test.**
   After the hotfix is live, cherry-pick or merge `main` back into `test` to keep branches in sync:

   ```bash
   git checkout test
   git pull origin test
   git merge main
   git push origin test
   ```

---

## 4. Rollback Procedures

### Automatic Rollback (Smoke Test Failure)

The `deploy.yml` workflow includes automatic rollback. If post-deploy smoke tests fail, all affected apps are rolled back to the previous production deployment via `vercel rollback`.

### Manual Rollback via Vercel CLI

```bash
# Install Vercel CLI if needed
pnpm add -g vercel@latest

# Roll back a specific app
VERCEL_ORG_ID=<org-id> VERCEL_PROJECT_ID=<project-id> \
  vercel rollback --token="$VERCEL_TOKEN"
```

Project IDs for each app:

| App | Project ID |
|-----|-----------|
| api | `prj_zk6EQijYXwd9L7BccuBssi436ktM` |
| admin | `prj_7sEFDg4MH6C26nJPjrukK86QdwfG` |
| marketing | `prj_frTIYlnONVPLNIjKnQpINiGb5lm0` |
| docs | `prj_OPwr0FrgcK17AOBCyoj4JIilJ9S1` |

### Manual Rollback via Git

If a code-level revert is needed:

```bash
git checkout main
git revert <commit-sha>    # revert the problematic merge commit
git push origin main        # triggers deploy.yml with the reverted code
```

### Database Rollback

Database migrations are additive-only by convention. If a migration must be reversed:

1. Write a new migration that undoes the change (e.g., drop the added column).
2. Commit the new migration and deploy through the standard pipeline.
3. Never manually edit or delete existing migration files.

See [Section 5](#5-database-migration-steps) for details.

---

## 5. Database Migration Steps

### Architecture

- **Primary database**: NeonDB (PostgreSQL, Drizzle ORM)
- **Secondary database**: Supabase (vectors, auth)
- **Schema definitions**: `packages/db/src/schema/` (86 tables)
- **Migration files**: `packages/db/migrations/`
- **ORM config**: `packages/db/drizzle.config.ts`

### Creating a Migration

```bash
# 1. Edit schema files in packages/db/src/schema/
# 2. Generate the migration
pnpm --filter @revealui/db exec drizzle-kit generate

# 3. Review the generated SQL in packages/db/migrations/
# 4. Commit the migration file with your schema changes
```

### Migration Execution in CI

Migrations run automatically during production deploy (`deploy.yml`), after validation but before app deployment:

1. **Validate**: `drizzle-kit generate` confirms no uncommitted drift
2. **Migrate**: `pnpm db:migrate` applies pending migrations against production NeonDB
3. **Deploy**: Apps deploy with the new schema already in place

This ordering ensures new schema exists before new code references it.

### Local Development

```bash
pnpm db:init       # Initialize local database
pnpm db:migrate    # Apply migrations locally
pnpm db:seed       # Seed sample data
pnpm db:reset      # Reset and re-seed (destructive)
```

### Migration Safety Rules

- Migrations are **additive-only**. Do not drop columns or tables in the same deploy that removes code references.
- For destructive changes, use a two-phase approach:
  1. First deploy: remove code references, keep schema.
  2. Second deploy: drop the unused schema.
- Always test migrations locally before committing.
- The deploy pipeline blocks if migration drift is detected.

---

## 6. npm Package Publishing

All `@revealui/*` packages are published through CI. There is no local npm publishing.

### Canary Releases (Automatic)

Triggered on every push to `test` that includes changeset files.

- Workflow: `release-canary.yml`
- Versions: `0.0.0-canary-<timestamp>`
- npm tag: `canary`
- No git tags or GitHub releases

```bash
# Install a canary version
pnpm add @revealui/core@canary
```

### Production Releases (Manual)

Triggered manually from the GitHub Actions UI.

- Workflow: `release.yml` (Actions > Release OSS Packages > Run workflow)
- Authentication: OIDC trusted publishing (no long-lived NPM_TOKEN)
- Provenance: SLSA Build Level 2 attestations
- Creates git tags and GitHub releases

### Changeset Workflow

```bash
# 1. Create a changeset when making version-worthy changes
pnpm changeset

# 2. Commit the changeset file with your code changes

# 3. After merging to main, apply versions
pnpm changeset:version

# 4. Commit version bumps, then trigger release.yml

# 5. Check status at any time
pnpm changeset:status
pnpm release:status
pnpm release:dry-run
```

### Dry Run

The `release.yml` workflow supports a dry-run input. Use it to verify build artifacts without publishing:

```
Actions > Release OSS Packages > Run workflow > dry-run: true
```

---

## 7. Environment Variable Management

### Secret Management

Secrets are managed via **RevVault** locally and **Vercel environment variables** in production.

```bash
# Export secrets to local environment
revvault export-env
```

### Vercel Environment Variables

Environment variables are configured per-project in the Vercel dashboard or via the CLI:

```bash
# List current env vars for a project
vercel env ls production --token="$VERCEL_TOKEN"

# Pull env vars locally
vercel pull --yes --environment=production --token="$VERCEL_TOKEN"
```

### Required Variables (All Server Apps)

| Variable | Purpose |
|----------|---------|
| `POSTGRES_URL` | NeonDB connection string |
| `REVEALUI_SECRET` | Session signing, CSRF, HMAC operations |
| `REVEALUI_PUBLIC_SERVER_URL` | Public server URL |

### Additional Required Variables (API)

| Variable | Purpose |
|----------|---------|
| `STRIPE_SECRET_KEY` | Stripe payments |
| `STRIPE_WEBHOOK_SECRET` | Webhook signature verification |
| `REVEALUI_CRON_SECRET` | Cron job authentication |
| `REVEALUI_LICENSE_PRIVATE_KEY` | License signing |
| `REVEALUI_KEK` | Key encryption key |

### Pre-Deploy Validation

The `deploy.yml` workflow validates critical environment variables before deploying `api` and `admin`. Missing variables block the deploy with an error. Email provider variables are advisory (warnings only).

### Adding New Environment Variables

1. Add the variable to the Vercel project dashboard for all environments (production, preview, development).
2. Update `packages/config/` with the new Zod schema if it needs runtime validation.
3. Update `docs/ENVIRONMENT-VARIABLES-GUIDE.md` with the new variable.
4. If the variable is required for deploy, add it to the validation step in `deploy.yml`.

---

## 8. Monitoring and Verification

### Post-Deploy Smoke Tests (Automated)

The deploy workflow runs these automatically:

- **API readiness probe**: `GET api.revealui.com/health/ready` (checks DB, memory, config)
  - Retries: 12 attempts, 10 seconds apart (2 minutes total)
- **Admin health check**: `GET admin.revealui.com` (HTTP 200)
  - Same retry pattern

### Manual Verification Checklist

After a production deploy, verify:

- [ ] API health endpoint returns healthy: `curl https://api.revealui.com/health/ready`
- [ ] Admin dashboard loads and authenticates
- [ ] Marketing site renders correctly
- [ ] Stripe webhooks are processing (check Stripe dashboard)
- [ ] Database connections are active (check NeonDB dashboard)
- [ ] No elevated error rates in Vercel function logs

### Monitoring Endpoints

| Endpoint | Purpose |
|----------|---------|
| `api.revealui.com/health/ready` | Full readiness probe (DB + memory + config) |
| `api.revealui.com/health` | Basic liveness check |

### Vercel Dashboard

Check the Vercel dashboard for:

- Deployment status and build logs
- Function invocation logs and errors
- Edge network performance
- Build duration trends

---

## 9. Incident Response

For security incidents, data breaches, or critical production failures, follow the Incident Response Plan:

**[docs/security/INCIDENT_RESPONSE.md](./security/INCIDENT_RESPONSE.md)**

### Severity Quick Reference

| Level | Definition | Target Response | Target Resolution |
|-------|-----------|----------------|-------------------|
| P0 (Critical) | Active exploitation or data breach | 1 hour | 4 hours |
| P1 (High) | Exploitable vulnerability, no active exploitation | 4 hours | 24 hours |
| P2 (Medium) | Vulnerability with limited impact | 24 hours | 1 week |

### Immediate Actions for Production Outage

1. Check Vercel deployment status and function logs.
2. If a bad deploy caused the issue, roll back immediately (see [Section 4](#4-rollback-procedures)).
3. If the issue is database-related, check NeonDB and Supabase dashboards.
4. If the issue is a security incident, escalate per the Incident Response Plan.
5. Contact: security@revealui.com (security), founder@revealui.com (general).

---

## Quick Reference: Workflow Files

| Workflow | File | Trigger | Purpose |
|----------|------|---------|---------|
| CI | `ci.yml` | Push/PR to test, main | Quality gate (lint, typecheck, test, build) |
| Deploy | `deploy.yml` | Push to main, manual | Production deployment to Vercel |
| Deploy Test | `deploy-test.yml` | Manual (workflow_dispatch) | Preview deployment for QA |
| Release Canary | `release-canary.yml` | Push to test | Canary npm packages (`@canary` tag) |
| Release OSS | `release.yml` | Manual (workflow_dispatch) | Production npm publish with provenance |
| Security | `security.yml` | Scheduled, manual | CodeQL, Gitleaks, dependency audit |
