# leak-scan (canonical source)

No-regex leak scanner. Single source of truth for the fleet's
`check-no-private-leaks` gate, consolidating 8 drifting bash copies into one
TypeScript tool. Tracked by the `leak-scanner-consolidation` lane in the internal
coordination repo.

## Usage

```
node scripts/leak-scan/leak-scan.mjs [path...] [--json] [--leakignore=FILE] [--local-rules=FILE]
```

Scans the given paths (default: cwd). Exit `0` clean, `1` violations found, `2`
setup error. Reads `<root>/.leakignore` (allowlist) and `<root>/.leakrules.json`
(repo-local sensitive rules) by default. The bundle imports only `node:` builtins,
so consuming repos run it with plain `node` — no install, no `tsx`.

## Build

`node scripts/leak-scan/build.mjs` bundles the TS source to the committed
`leak-scan.mjs` via esbuild. `--check` mode fails if the committed bundle is
stale (drift gate). The `.mjs` lives at the tool root (not `dist/`, which is
git-ignored) and is skipped by Biome (`.mjs` is not in its `includes`) and by the
scanner's own self-exclude list.

## Modules

- `predicates.ts` — no-regex primitives: literal substring + a typed segment
  matcher (`lit` / `run` over `CharClass`). No `RegExp` anywhere in the tool.
- `rules.ts` — `BASE_RULES` (22 generic, public-safe) + `SENSITIVE_TAGS`.
- `glob.ts` — no-regex wildcard matcher for excludes + `.leakignore` globs.
- `scan.ts` — `scanContent` + `walkFiles` (excludes, symlink/binary skip) + `scanPaths`.
- `leakignore.ts` — allowlist parser + `makeIsIgnored` (revvault#45 `./` norm,
  revdev#55 non-exclusions).
- `config.ts` — `loadLocalRules` (repo-local sensitive rules: `literal` | `anyOf`).
- `report.ts` — text + JSON (`{violations,entries}`) output.
- `cli.ts` — `runCli` (pure, testable) + a `VITEST`-guarded launcher.
- `build.mjs` — esbuild bundle + drift-check.
- `__tests__/` — Vitest (92 tests). Run: `vitest run --config scripts/leak-scan/vitest.config.ts`.

## Trust boundary

This canonical source lives in the public `revealui` repo, so `BASE_RULES` carry
only shapes and non-secret names (mount paths, ID formats, internal doc names).
Sensitive literal values — internal hostname, customer / prospect / person names,
operator bank, partnership reference, personal email (see `SENSITIVE_TAGS`) — are
**never** hard-coded here. Each consuming repo supplies them via local config
(`.leakrules.json`, self-excluded from scanning). This fixes, rather than
cements, today's bash scanners, several of which embed those literals directly.

## Remaining (lane §6)

- **PR-time hardening**: pin `esbuild` as a direct devDep (reproducible bundle),
  wire `build.mjs --check` into CI, confirm gitleaks + check-client-leaks pass on
  the committed `.mjs`.
- revkit propagation of `leak-scan.mjs` into each repo + a render drift gate.
- per-repo cutover (base = test, one PR each, behind an old-vs-new parity harness).
- delete revealcoin's scanner (cancelled repo).
