---
title: "GitHub Actions Workflows"
description: "**Triggers:** Push to `main`/`test`, pull requests targeting those branches. `feature/*` branches are local-only (no CI)."
visibility: internal
status: verified
audience: maintainer
---

# GitHub Actions Workflows

## Active Workflows

### `ci.yml` — Continuous Integration

**Triggers:** Push to `main`/`test`, pull requests targeting those branches. `feature/*` branches are local-only (no CI).

Mirrors the local `pnpm gate` — same hard-fail/warn policy:

| Check                       | When                              | Fail policy |
| --------------------------- | --------------------------------- | ----------- |
| Biome lint                  | all                               | Hard fail   |
| Boundary / claim-drift      | all                               | Hard fail   |
| Migration apply (Postgres)  | all                               | Hard fail   |
| Typecheck                   | all (affected on PRs)             | Hard fail   |
| Build                       | all (affected on PRs)             | Hard fail   |
| Unit tests                  | all                               | Hard fail   |
| Integration tests           | PRs + push to main                | Hard fail   |
| Integration tests (extended)| PRs + push to main (advisory)     | Hard fail   |
| Coverage                    | main and PRs targeting main       | Hard fail   |
| E2E smoke                   | main and PRs targeting main       | Hard fail   |
| Accessibility (E2E)         | main and PRs targeting main       | Hard fail   |
| Visual regression (E2E)     | main and PRs targeting main       | Hard fail   |
| Audits (any / console)      | all (quality job)                 | Hard fail   |
| Structure / version policy  | all (quality job)                 | Hard fail   |

**Optimizations:**
- **Turbo remote cache**: build artifacts shared across jobs via `TURBO_TOKEN`
- **PR `--affected` mode**: only build/typecheck packages changed in the PR
- **Parallel execution**: build runs alongside typecheck (turbo cache deduplicates)
- **E2E jobs** wait for build completion, then get near-instant cache hits

### `release.yml` — Release OSS Packages

**Trigger:** Manual (`workflow_dispatch`)

Publishes OSS packages to npm using **OIDC trusted publishing** (no long-lived `NPM_TOKEN`).
Generates **SLSA Build Level 2 provenance attestations** via `--provenance`.

Steps:

1. Install + build all packages (`SKIP_ENV_VALIDATION=true`)
2. `pnpm changeset publish` with `NPM_CONFIG_PROVENANCE=true` — publishes packages that have pending changesets
3. Push git tags
4. Create GitHub releases for each published package

**One-time npm setup:** Configure trusted publishing on npmjs.org for each OSS package
(Package Settings > Publishing > Trusted Publishers > Add GitHub Actions, workflow: `release.yml`).

**Changesets must be applied before running** — run `pnpm changeset version` locally and commit first.

### `release-pro.yml` — Release Pro Packages (Removed)

**Status:** File no longer exists. Pro packages are now Fair Source (FSL-1.1-MIT) in the
public repo and publish through the normal changeset flow via `release.yml`.

### `deploy.yml` — Unified Deploy

**Triggers:** Push to `main`/`test`, manual `workflow_dispatch`

Deploys all 4 apps (api, admin, marketing, docs) in parallel via matrix strategy. Branch→environment mapping:
- `main` → production (`*.revealui.com`)
- `test` → test (`test.*.revealui.com`)

Each app: `vercel pull` → `vercel build` → `vercel deploy --prebuilt` → alias to stable domain.
Smoke tests (health checks) run on production and test deploys.

## Disabled / Removed Workflows

The `.github/workflows-disabled/` directory no longer exists. The legacy staging and production deploy workflows have been removed entirely; all deployment is handled by `deploy.yml`.

## Local Release (Primary Flow)

For day-to-day releases, use the local CLI scripts instead of triggering GHA:

```bash
# OSS release (version → build → publish → GitHub releases)
pnpm release:oss

# OSS dry run
pnpm release:oss:dry

# Pro packages now publish via normal changeset flow (Fair Source, FSL-1.1-MIT)

# Check pending changesets
pnpm release status
```

## CI Gate (local)

The gate also runs locally via Husky pre-push hook:

```bash
pnpm gate        # full: lint + typecheck + test + build
pnpm gate:quick  # phase 1 only (lint + structure)
```

`ci.yml` is the GitHub Actions counterpart — same checks, same policy.
