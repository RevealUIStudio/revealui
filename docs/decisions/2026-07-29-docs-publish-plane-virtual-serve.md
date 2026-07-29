---
title: "Docs publish plane: virtual serve (no public markdown mirror)"
description: "Monorepo docs/ is the only authoring SoT; public markdown is served virtually in dev and emitted to dist only at build."
visibility: public
status: verified
audience: maintainer
owner: RevealUI Studio
last_verified: 2026-07-29
---

# ADR: Docs publish plane — virtual serve

**Date:** 2026-07-29  
**Status:** Accepted  
**Supersedes:** Materialize-to-`apps/docs/public/*.md` via `copy-docs.sh` + Vite `docs-copy` plugin (CHIP-3 D5a URL layout retained)

## Context

For over a year, operators and agents repeatedly confused two on-disk trees:

| Path | Intended role |
|------|----------------|
| `docs/` | Authoring source of truth |
| `apps/docs/public/**/*.md` | Build-time copy for Vite static serve |

The copy was gitignored and documented as a build artifact, but after `pnpm dev` it looked like a second documentation tree. That caused dual edits, wrong PR paths, claim/doc-currency double scans, and stale private citations of `apps/docs/public/...`.

Hygiene (gitignore, scanner skips, README notes) reduced but did not eliminate the failure class: **an authoring-shaped mirror will keep being edited**.

## Decision

**There is only one path that looks like documentation source: monorepo `docs/`.**

The public site is a **view** of that tree:

1. **Visibility** — fail-closed `visibility: public` in frontmatter (`apps/docs/scripts/served-docs.mjs`).
2. **Dev** — Vite middleware (`docs-publish` plugin) serves public markdown from `docs/` over HTTP. No materialize into `apps/docs/public/*.md`.
3. **Build** — same set is emitted into Vite `outDir` (`apps/docs/dist/`) only, so production `fetch('/ADMIN_GUIDE.md')` keeps working.
4. **Hand-authored exception** — `apps/docs/public/docs-pro/` remains tracked Pro content under `public/`.
5. **Static assets** — favicons, `robots.txt`, `llms.txt`, etc. stay in `public/` (real files, not doc copies).
6. **CHIP-3 D5a URLs** — flat site paths (`/admin-guide` → `ADMIN_GUIDE.md`) unchanged.

Legacy `scripts/copy-docs.sh` becomes a **clean leftover mirror** entry only (does not re-copy).

## Consequences

### Positive

- Agents and humans no longer see a second full markdown tree under the docs app after `pnpm dev`.
- Claim / doc-currency scanners need not special-case a materialize mirror for correctness of authoring.
- Single module owns the served set: `apps/docs/scripts/docs-publish.mjs`.

### Negative / costs

- Dev depends on the Vite plugin middleware (must not regress to publicDir shadowing).
- Production still ships static `.md` files inside `dist/` (CDN-friendly); that is build output, not a workspace SoT.
- Callers that still expect `copy-docs.sh` to populate `public/*.md` must update (link check already uses the publish plane).

### Non-goals

- Moving SoT into `apps/docs/content/`
- Symlinking `public` → `docs`
- Bundling all markdown into JS (`import.meta.glob`) in this ADR (optional future)

## Implementation map

| Piece | Path |
|-------|------|
| Publish plane | `apps/docs/scripts/docs-publish.mjs` |
| Visibility | `apps/docs/scripts/served-docs.mjs` |
| Vite plugin | `apps/docs/vite.config.ts` (`docs-publish`) |
| Link check | `apps/docs/scripts/check-links.ts` |
| Operator note | `apps/docs/public/DOCS-PUBLISH-PLANE.txt` |
| Spec pointer | `docs/internal/documentation-system.md` |

## Acceptance

- [x] `pnpm --filter docs dev` does not populate `public/**/*.md` from monorepo `docs/`
- [x] `pnpm --filter docs build` emits public markdown under `dist/`
- [x] `pnpm --filter docs check:links` uses monorepo `docs/` + visibility, not a public mirror
- [x] SPA `loadMarkdownFile` still `fetch`es `/*.md` URLs
- [x] `docs-pro/` remains hand-authored and tracked
