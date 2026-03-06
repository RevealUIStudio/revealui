# GitHub Actions Workflows

## Active Workflows

### `ci.yml` — Continuous Integration
**Triggers:** Push to `main`, pull requests targeting `main`

Mirrors the local `pnpm gate` — same hard-fail/warn policy:

| Check | When | Fail policy |
|-------|------|-------------|
| Biome lint | PRs + main | Hard fail |
| Typecheck (all 24 packages) | PRs + main | Hard fail |
| Build (all packages) | main only | Hard fail |
| ESLint, audits, structure, boundary | PRs + main | Warn-only |
| Tests (Vitest) | PRs + main | Warn-only |

Build runs only on main pushes — at ~15 min it's too slow for PR feedback loops.

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

### `release-pro.yml` — Release Pro Packages
**Trigger:** Manual (`workflow_dispatch`)

Publishes Pro packages (`@revealui/ai`, `mcp`, `editors`, `services`, `harnesses`)
to **GitHub Packages** (`npm.pkg.github.com`).

**Prerequisites:**
- Remove `"private": true` from each Pro `package.json`
- Add `"publishConfig": { "registry": "https://npm.pkg.github.com" }` to each
- Create repository secret `GH_PACKAGES_TOKEN` (GitHub PAT with `write:packages`)

## Disabled Workflows

Workflows in `.github/workflows-disabled/` are not active:

| File | Purpose | Why disabled |
|------|---------|--------------|
| `deploy-staging.yml` | Auto-deploy CMS to Vercel staging on push to main | Vercel auto-deploy via GitHub integration is preferred |
| `deploy-production.yml` | Manual production deploy via `workflow_dispatch` | Same reason |
| `preview-pr.yml` | Preview deploys on PRs | Not yet configured |

To re-enable a workflow, move it to `.github/workflows/`.

## Local Release (Primary Flow)

For day-to-day releases, use the local CLI scripts instead of triggering GHA:

```bash
# OSS release (version → build → publish → GitHub releases)
pnpm release:oss

# OSS dry run
pnpm release:oss:dry

# Pro release (requires NODE_AUTH_TOKEN + non-private packages)
pnpm release:pro

# Pro dry run
pnpm release:pro:dry

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
