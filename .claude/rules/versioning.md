# Versioning Convention

Authoritative rule: **`~/.claude/rules/versioning.md`** (global). All RevealUI packages and artifacts follow it.

Summary:
- Every new versioned artifact starts at `0.1.0`. Never `1.0.0`.
- Inside 0.x: meaningful behavior change / breaking change = minor bump; bugfix / typo = patch bump. Never bump major within 0.x.
- Promote to `1.0.0` only when the artifact has real external consumers AND a stable contract across the prior release cycle.
- After 1.0.0: standard SemVer 2.0.0 — patch/minor/major mean what SemVer says.

Reconciliation note (2026-06-14): the prior maturity-ladder rule (0.1=scaffold → 0.9=RC) was superseded; the global rule is the single source of truth.

## RevealUI-specific publish workflow

The 3-stage release pipeline still applies inside this repo:

1. **Create changesets** — `pnpm changeset` in the working branch. One changeset per logical group of changes.
2. **Version** — `pnpm changeset:version` bumps `package.json` versions, generates CHANGELOGs, runs `pnpm install --no-frozen-lockfile` to update the lockfile.
3. **Publish** — two paths:
   - **Canary** (automatic): `release-canary.yml` runs on every push to `test`. Publishes snapshot versions (`@canary` dist-tag) if changesets exist.
   - **Stable** (manual): `release.yml` is `workflow_dispatch` only. Builds, validates artifacts, generates SBOM, publishes with OIDC provenance, creates GitHub releases.

**After `changeset:version`, commit the version bump before pushing.** The canary workflow consumes changeset files — if they're gone (already versioned), canary skips. If they're present, canary publishes snapshots.

## Changeset config

Key settings in `.changeset/config.json`:

- `updateInternalDependencies: "patch"` — cascading patch bumps only.
- `baseBranch: "main"` — changesets compares against main.
- `ignore` list is `server`, `admin`, `docs`, `marketing`, `@revealui/test`, `@revealui/scripts`, `@revealui/dev` — the four apps plus the non-publishable packages. It does NOT include the Pro packages.

**Pro packages (ai, harnesses, mcp, services) are present and tracked in the public repo, and version through the same changesets pipeline as the OSS packages.** They are Fair Source (FSL-1.1-MIT), source-visible, converting to MIT two years after each release; `.gitignore` carries a comment header noting this but no actual ignore pattern for them. `@revealui/engines` is `"private": true` and unpublished (an npm-publish-scope choice, unrelated to gitignore or the changeset ignore list), but it still carries a normal version and CHANGELOG.

## Internal dependencies

All intra-workspace dependencies use `workspace:*` (regular deps), never `peerDependencies`. Internal `@revealui/*` peer deps were eliminated — they caused major-version cascades on changeset version bumps. See memory: `project_peer_dep_cascade_fix.md`.
