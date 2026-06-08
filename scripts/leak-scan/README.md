# leak-scan (canonical source)

No-regex leak scanner. Single source of truth for the fleet's
`check-no-private-leaks` gate, consolidating 8 drifting bash copies into one
TypeScript tool. Tracked by the `leak-scanner-consolidation` lane in the internal coordination repo.

## Status — increment 1

- `predicates.ts` — no-regex matching primitives: literal substring + a typed
  segment matcher (`lit` / `run` over `CharClass` predicates). No `RegExp`.
- `rules.ts` — `BASE_RULES` (generic, public-safe) + `SENSITIVE_TAGS` (repo-local).
- `__tests__/` — Vitest. Run: `vitest run --config scripts/leak-scan/vitest.config.ts`.

## Trust boundary

This canonical source lives in the public `revealui` repo, so `BASE_RULES`
carry only shapes and non-secret names (mount paths, ID formats, internal doc
names). Sensitive literal values — internal hostname, customer / prospect /
person names, operator bank, partnership reference, personal email (see
`SENSITIVE_TAGS`) — are **never** hard-coded here. Each consuming repo supplies
them via local config. This fixes, rather than cements, today's bash scanners,
several of which embed those literals directly.

## Remaining (lane §6)

file-walk + exclude-dirs/files, `.leakignore` allowlist parser (path-glob +
tag, with the revvault#45 `./` normalization and the revdev#55 non-exclusions),
repo-local sensitive-rule loader, JSON output mode, exit-code CLI entry,
dependency-free `.mjs` bundle, revkit propagation + drift gate, per-repo cutover
(base = test, one PR each), and the old-vs-new parity harness.
