---
title: RevealUI Documentation System
description: How RevealUI guarantees every documentation line is true (generated from code or validated on every CI run) and how internal and public docs are separated and guarded.
visibility: internal
status: verified
audience: maintainer
owner: RevealUI Studio
last_verified: 2026-07-29
---

This is the canonical specification for how documentation works in the RevealUI
monorepo. It supersedes the stale `scripts/validate/README.md`.

## The guarantee

> Every factual assertion in a tracked Markdown doc is either **generated from
> the codebase**, or **mechanically validated against the codebase on every CI
> run**, or **explicitly marked narrative and dated**. No doc merges unless all
> three hold. Therefore any doc a human or agent reads carries a known, enforced
> trust level.

"100% true, always" is not achievable by hoping authors keep prose in sync. It
is achievable by (a) generating everything that has a code source of truth, (b)
gating every machine-checkable claim as a hard CI failure, and (c) confining the
remainder to dated narrative with a visible trust marker. This document defines
all three mechanisms and the internal/public boundary that wraps them.

## Content classes

Every doc is exactly one of three classes, declared in frontmatter `status`:

| Class | Meaning | Drift protection | Trust |
|-------|---------|------------------|-------|
| `generated` | Produced by a generator from code. Carries a `DO NOT EDIT` banner. | CI re-runs the generator and fails on any diff. | True by construction |
| `verified` | Hand-written, but every factual claim is in a machine-checkable form (links, paths, scripts, imports, counts, symbols). | The doc-integrity gate resolves every such claim against the tree on each run. | Claims enforced |
| `narrative` | Explanation / rationale (blog, ADR context) whose prose claims cannot all be machine-checked. | Carries `last_verified`; aspirational claims must cite a tracker. | Dated, lower |

The default for a new prose doc is `verified`. Reach for `narrative` only when a
doc genuinely needs unverifiable prose; keep those docs small and dated.

## Frontmatter contract

Required on **every** tracked doc. The gate fails closed: a missing or invalid
`visibility` is treated as `internal` **and** flagged as an error.

**Exception — changesets-owned changelogs.** `packages/*/CHANGELOG.md` are
machine files owned by changesets and MUST NOT carry frontmatter:
`@changesets/apply-release-plan` prepends each new version section by
replacing the file's first newline, which injects the section inside a
leading frontmatter block and strands its keys below it (the 2026-06-12
version run injected release sections inside the frontmatter of 18 such
changelogs; the 6 not bumped that day were primed to corrupt on their next
release). They are out of
doc-system scope, like `.changeset/`: `scripts/docs/apply-frontmatter.ts`
skips them, and `pnpm validate:changelogs`
(`scripts/validate/changelog-format.ts`, CI hard-fail) enforces the inverse —
a package changelog must start with its `# <package>` H1. Anything the docs
surface wants to say about a package changelog is derived from
`packages/*/package.json`, never embedded in the changelog.

```yaml
---
title: <string>                 # required
description: <string>           # required, one line
visibility: public | internal   # required — fail-closed
status: generated | verified | narrative  # required
audience: user | contributor | maintainer | agent  # required
# when status: generated
generated_by: <script path>     # e.g. scripts/docs/generate-reference.ts
source: <code path or glob>     # the source of truth the generator reads
# when status: verified | narrative
last_verified: <YYYY-MM-DD or commit-sha>
owner: <handle or team>
---
```

Frontmatter is parsed with a flat, zero-dependency key:value scan (the same
no-regex approach already used by the fleet's M1 doc validators), never a YAML
library and never authored regex.

## Internal vs public

The boundary is **frontmatter-driven, single-source, and fail-closed**.

### Two paths, one SoT

| Path | Role |
|------|------|
| **`docs/`** | **Source of truth.** Edit here only. |
| **`apps/docs/public/**/*.md`** | **Generated serve mirror** for docs.revealui.com. Filled by `copy-docs.sh` + Vite `docsCopyPlugin`. Gitignored. Never edit or commit. |
| **`apps/docs/public/docs-pro/`** | Hand-authored Pro exception (tracked). |

A local disk full of `apps/docs/public/*.md` after `pnpm dev` is build output.
Scanners (`doc-currency`, claim-gates) skip that mirror; agents should use
`.cursorignore` / `.ignore` the same way.

Rules enforced by the gate:

1. **Classification is mandatory.** Every doc declares `visibility`. No default
   to public, ever. A doc with no valid `visibility` fails CI.
2. **Physical home.** Internal docs live under `docs/internal/` (and related
   internal paths). Anything under `docs/internal/` must be
   `visibility: internal`. The tree and the frontmatter must agree.
3. **The mirror reads frontmatter.** The docs-app publish step serves a doc only
   when `visibility: public`. `copy-docs.sh` + `prune-non-public.mjs` and the
   Vite plugin read that single source (no hand-maintained denylist).
4. **Leak guard on public docs.** Every `visibility: public` doc is scanned for
   internal-only content: absolute developer home paths, Windows user-profile
   paths, the private internal planning repo and its paths, revvault secret
   paths, internal hostnames, customer or prospect names, and any link to a
   `visibility: internal` doc. The token set is owned by the fleet no-regex leak
   scanner (the consolidated scanner from PR #1284), which this gate reuses
   rather than re-implementing. Any hit fails CI.

Internal docs are exempt from the leak guard (they are allowed to name internal
things) but are still subject to the integrity gate (links, paths, counts).

## The doc-integrity gate

One AST / typed-predicate checker, **zero authored regex** (fleet M2 hardline),
CI **hard-fail**. It replaces the seven overlapping validators. Checks:

1. **Frontmatter** present and schema-valid; `visibility`/`status` enums honored.
2. **Internal links** — every `](relative/path)` resolves to a file on disk.
3. **Path references** — repo-path-shaped tokens in inline code resolve.
4. **Script references** — `pnpm <name>` resolves to a script in the nearest
   `package.json`.
5. **Code-fence imports** — `import { X } from '@revealui/Y'` resolves to a real
   export (the existing `docs-import-drift` logic, extended to all docs and
   promoted from warn-only to hard-fail; it currently finds 5 stale imports in
   `docs/STANDARDS.md` that have been ignored because the check does not block).
6. **Counts** — packages, apps, components, MCP servers, DB tables, test files,
   license split (the existing `claim-drift` logic, re-implemented AST/no-regex
   to close GAP-192).
7. **Generated freshness** — re-run every generator; fail on any diff.
8. **Leak guard** — public-doc internal-content scan (above).
9. **Aspirational claims** — future-tense / blocklisted features must cite a
   tracker (the existing claim-drift guards, folded in).

## Generators

Each generator writes a `status: generated` doc with a `DO NOT EDIT` banner and
is covered by the freshness check.

| Output | Source of truth | Generator |
|--------|-----------------|-----------|
| Package API reference (replaces the 4954-line hand-written `docs/REFERENCE.md`) | `packages/*/package.json` `exports` + TSDoc on `src` | `scripts/docs/generate-reference.ts` |
| Component catalog (replaces the 1572-line hand-written `docs/COMPONENT_CATALOG.md`) | `packages/presentation/src/components/*.tsx` | `scripts/docs/generate-components.ts` |
| Environment-variable reference | the Zod config schema in `@revealui/config` | `scripts/docs/generate-env.ts` |
| Documentation index (replaces hand-curated `docs/INDEX.md`) | every doc's frontmatter | `scripts/docs/generate-index.ts` |
| Per-package README scaffold | `package.json` + `packages/PACKAGE-CONVENTIONS.md` template | `scripts/docs/generate-package-readme.ts` |
| REST API reference | `examples/api/openapi.json` | `scripts/docs/generate-api.ts` (exists; wire the snapshot refresh so it cannot stale) |

## Trust surface for agents and UI

- **Agents** read frontmatter (`status`, `visibility`, `last_verified`,
  `source`) to know a doc's trust level before relying on it, and consult a
  generated machine-readable manifest (`docs/manifest.json`) listing every doc
  with its trust metadata.
- **The docs UI** (wired in the docs-app session) renders a badge from `status`
  (Generated / Verified / Dated) and never serves `visibility: internal`.
- **The green gate** is the backstop: because the integrity gate is CI
  hard-fail, a doc on `main` cannot contain an unresolved claim.

## File layout

```
README.md, CLAUDE.md, AGENTS.md, CONTRIBUTING.md,   # root — kept here for tool
SECURITY.md, CODE_OF_CONDUCT.md, CHANGELOG.md       #   discovery; visibility: public
docs/                  # public engineering docs (visibility: public)
  reference/           # generated API + component + env reference
  guides/              # how-to (task-oriented)
  tutorials/           # learning-oriented
  explanation/         # concepts + public ADRs
  fleet/               # companion-product overviews
  blog/                # narrative
  internal/            # visibility: internal ONLY (ops, business, secrets, strategy)
packages/<name>/README.md   # scaffolded from template; visibility: public
```

Root `CLAUDE.md` and `AGENTS.md` stay at the repository root: agent tooling
auto-discovers them there. (The legacy `validate-root-markdown.ts` wanted to
move them into `docs/`, which would break that discovery; it is retired.)

## What this replaces

| Today | Disposition |
|-------|-------------|
| `scripts/validate/verify-claims.ts` | DELETE — broken (ENOENT on a missing audit file), unwired, reports nonsense counts |
| `scripts/validate/validate-docs.ts`, `validate-docs-comprehensive.ts` | REPLACE with the integrity gate, then DELETE — noisy, false-positive-prone, unwired |
| `scripts/validate/validate-root-markdown.ts` | RETIRE — encodes a wrong policy (move CLAUDE.md/AGENTS.md) and points fixes at nonexistent dirs |
| `scripts/validate/claim-drift.ts` | KEEP the counting logic; re-implement AST/no-regex and fold into the gate (closes GAP-192) |
| `scripts/validate/docs-import-drift.ts` | KEEP; extend to all docs; promote warn-only -> hard-fail |
| `scripts/docs/generate-api.ts` | KEEP; wire the OpenAPI snapshot refresh into CI |
| `scripts/validate/README.md` | REWRITE to a short pointer at this spec |
| denylist in `copy-docs.sh` + `vite.config.ts` | DONE — frontmatter `visibility: public` + prune-non-public (single source); public/*.md is generated mirror only |

## Execution phases

- **P0** — branch, this spec, per-file audit. (current)
- **P1** — frontmatter contract: add `visibility` + `status` to every doc; create
  `docs/internal/` and migrate internal docs into it; define the frontmatter-
  driven visibility contract the docs app will consume.
- **P2** — the doc-integrity gate (AST, no-regex); measure the real drift
  baseline; fix everything it flags.
- **P3** — generators (reference, components, env, index, package-README); add the
  freshness check.
- **P4** — consolidation: merge duplicate docs, retire the monoliths (REFERENCE
  and COMPONENT_CATALOG become generated; STANDARDS and ARCHITECTURE split),
  delete dead docs per the audit.
- **P5** — wire the gate to CI hard-fail; delete the superseded validators;
  rewrite `scripts/validate/README.md` as a pointer here.
