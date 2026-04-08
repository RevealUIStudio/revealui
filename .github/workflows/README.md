# GitHub Actions Workflows

## Active Workflows

### `ci.yml` — Continuous Integration

**Triggers:** Push to `main`/`test`, pull requests targeting those branches. `feature/*` branches are local-only (no CI).

Mirrors the local `pnpm gate` — same hard-fail/warn policy:

| Check                       | When                 | Fail policy |
| --------------------------- | -------------------- | ----------- |
| Biome lint                  | all                  | Hard fail   |
| Boundary validation         | all                  | Hard fail   |
| Typecheck                   | all (affected on PRs)| Hard fail   |
| Build                       | all (affected on PRs)| Hard fail   |
| Unit tests                  | all                  | Hard fail   |
| Integration tests           | main/test only       | Hard fail   |
| E2E smoke + accessibility   | after build          | Warn-only   |
| Audits, structure           | all                  | Warn-only   |

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
2. `pnpm changeset publish --provenance` — publishes packages that have pending changesets
3. Push git tags
4. Create GitHub releases for each published package

**One-time npm setup:** Configure trusted publishing on npmjs.org for each OSS package
(Package Settings > Publishing > Trusted Publishers > Add GitHub Actions, workflow: `release.yml`).

**Changesets must be applied before running** — run `pnpm changeset version` locally and commit first.

### `release-pro.yml` — Release Pro Packages (Legacy)

**Status:** No longer needed. Pro packages are now Fair Source (FSL-1.1-MIT) in the
public repo and publish through the normal changeset flow via `release.yml`.

### `deploy.yml` — Unified Deploy

**Triggers:** Push to `main`/`test`, manual `workflow_dispatch`

Deploys all 5 apps in parallel via matrix strategy. Branch→environment mapping:
- `main` → production (`*.revealui.com`)
- `test` → test (`test.*.revealui.com`)

Each app: `vercel pull` → `vercel build` → `vercel deploy --prebuilt` → alias to stable domain.
Smoke tests (health checks) run on production and test deploys.

## Disabled Workflows

Legacy workflows in `.github/workflows-disabled/` are superseded by `deploy.yml`:

| File                    | Purpose                                           | Superseded by   |
| ----------------------- | ------------------------------------------------- | ---------------- |
| `deploy-staging.yml`    | Auto-deploy CMS to Vercel staging on push to main | `deploy.yml`     |
| `deploy-production.yml` | Manual production deploy via `workflow_dispatch`  | `deploy.yml`     |
| `preview-pr.yml`        | Preview deploys on PRs                            | Vercel auto-preview |

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
