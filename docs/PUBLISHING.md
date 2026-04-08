---
title: "Package Publishing Guide"
description: "Versioning with Changesets and publishing to npm via CI"
category: operations
audience: maintainer
---

# Package Publishing

**Last Updated**: April 2026

All package versioning and publishing is managed through [Changesets](https://github.com/changesets/changesets) and CI workflows. There is no local npm publishing — all publishing goes through GitHub Actions with OIDC trusted publishing.

---

## Workflow

### 1. Create a changeset (local)

When you make a change that should bump a package version:

```bash
pnpm changeset
```

This prompts you to select affected packages, bump type (patch/minor/major), and write a summary. It creates a `.changeset/<random-name>.md` file.

### 2. Commit the changeset

Commit the changeset file along with your code changes. Changesets are reviewed in PRs like any other code.

### 3. Publishing happens in CI

| Workflow | Trigger | Versions | npm Tag |
|----------|---------|----------|---------|
| `release-canary.yml` | Push to `test` | `0.0.0-canary-<timestamp>` | `canary` |
| `release.yml` | Manual dispatch on `main` | Real semver from changesets | `latest` |

- **Canary**: Automatic on every push to `test` that includes changeset files. Ephemeral — no git tags, no GitHub releases.
- **Release**: Manual trigger from GitHub Actions UI. Creates git tags and GitHub releases.

### 4. Useful commands

```bash
pnpm changeset              # Create a new changeset
pnpm changeset:status       # Check pending changesets
pnpm changeset:version      # Apply versions locally (for review, CI does this)
pnpm release:status         # Full release status check
pnpm release:dry-run        # Simulate a release locally
```

---

## Authentication

### CI (GitHub Actions)

Both workflows use **OIDC trusted publishing** — no static npm tokens.

Prerequisites (one-time setup per package on npmjs.org):

1. Go to the package on npmjs.com > Settings > Publishing access > Trusted Publishers
2. Add GitHub Actions with:
   - Repository owner: `RevealUIStudio`
   - Repository name: `revealui`
   - Workflow: `release.yml` (and `release-canary.yml` for canaries)
   - Environment: `npm-publish`

Packages that need this configured:
`@revealui/animations`, `@revealui/auth`, `@revealui/cache`, `@revealui/cli`,
`@revealui/config`, `@revealui/contracts`, `@revealui/core`, `@revealui/db`,
`@revealui/editors`, `@revealui/mcp`, `@revealui/openapi`, `@revealui/presentation`,
`@revealui/resilience`, `@revealui/router`, `@revealui/security`, `@revealui/services`,
`@revealui/setup`, `@revealui/sync`, `@revealui/utils`, `create-revealui`

### Local

No npm auth is needed locally. `pnpm changeset` and `pnpm changeset version` don't touch the registry. Publishing is CI-only.

If you ever need emergency local publishing (avoid if possible):

```bash
npm login    # Interactive, writes to ~/.npmrc
```

---

## Pro Packages

`@revealui/ai` and `@revealui/harnesses` are **Fair Source** (FSL-1.1-MIT). They:

- Live in the public repo under `packages/ai/` and `packages/harnesses/`
- Are published through the standard changeset release workflow
- Are included in CI builds alongside OSS packages
- Use runtime license enforcement (`initializeLicense()`, `isLicensed()`)
- Convert to MIT after 2 years from each release

---

## Build Artifact Validation

Before publishing, both CI workflows and the local gate validate build output:

```bash
pnpm validate:artifacts     # Check all packages have correct dist/ or bin/ output
```

This is run automatically by:
- `release.yml` and `release-canary.yml` (after `pnpm build`)
- `pnpm gate` phase 3 (after build step)

The validation script (`scripts/validate/build-artifacts.ts`) checks:
- **Dist packages** (19): Must have `dist/` directory with `.js` files
- **Bin-only packages** (`create-revealui`): Must have `bin/` entry point

---

## Troubleshooting

### Canary publish fails with E404

OIDC trusted publishing is not configured for the failing package on npm.org. Follow the steps in the Authentication section above.

### "No changesets found — skipping canary release"

No `.changeset/*.md` files exist (excluding README). Create one with `pnpm changeset`.

### Package not included in canary

Only packages with changesets get new canary versions. Other packages show "is not being published because version X.Y.Z is already published on npm" — this is expected.

### Build artifacts validation fails

Run `pnpm build` first, then `pnpm validate:artifacts`. If a new package was added, update the package lists in `scripts/validate/build-artifacts.ts`.
