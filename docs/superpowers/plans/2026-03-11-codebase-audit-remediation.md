# Codebase Audit Remediation Plan

**Created:** 2026-03-11
**Source:** Exhaustive 6-dimension codebase audit (code quality, security, architecture, build config, test coverage, dependencies)
**Overall Grade:** B+ — professionally built with launch-blocking gaps

---

## Phase 1: P0 — Launch Blockers (3 items)

### 1.1 Fix DatabaseStorage.incr() race condition
- **File:** `packages/auth/src/server/storage/database.ts:77-82`
- **Problem:** Non-atomic read-modify-write allows rate limit bypass under concurrent load
- **Fix:** Replace with `atomicUpdate()` pattern (already implemented at line 101 in same file)
- **Verify:** Add concurrent increment test, run `pnpm --filter @revealui/auth test`
- **Effort:** 30 min

### 1.2 Fix @revealui/services version mismatch
- **File:** `apps/cms/package.json:48`
- **Problem:** Pinned `"0.0.2"` instead of `workspace:*`, breaks `pnpm deps:check`
- **Fix:** Change to `workspace:*`, run `pnpm install`
- **Verify:** `pnpm deps:check` exits 0
- **Effort:** 5 min

### 1.3 Enable CI build on PRs
- **File:** `.github/workflows/ci.yml:138`
- **Problem:** Build step only runs on main, PRs can merge with broken builds
- **Fix:** Remove `if: github.ref == 'refs/heads/main'` condition from build job
- **Verify:** Open test PR, confirm build runs
- **Effort:** 10 min

---

## Phase 2: P1 — High Priority (7 items)

### 2.1 Make CI tests hard-fail (or document why not)
- **File:** `.github/workflows/ci.yml:125,196`
- **Problem:** `continue-on-error: true` means test failures don't block merges
- **Decision needed:** Either remove `continue-on-error` or add a DECISIONS.md entry explaining the warn-only policy
- **Effort:** 15 min

### 2.2 Fix Biome semicolons config
- **File:** `biome.json:157`
- **Problem:** `"asNeeded"` contradicts documented "semicolons required" convention
- **Fix:** Change to `"always"`, run `pnpm lint:fix` to add missing semicolons
- **Verify:** `pnpm lint` passes
- **Effort:** 20 min (mostly auto-fix)

### 2.3 Enable verbatimModuleSyntax
- **Files:** `packages/dev/src/ts/base.json:14`, `tsconfig.json:9`, app tsconfigs
- **Problem:** Disabled across all configs, allows CJS interop issues to slip through
- **Fix:** Set `true` in base.json, fix any resulting `import type` errors
- **Verify:** `pnpm typecheck:all`
- **Risk:** May surface many import-type issues; do in isolation
- **Effort:** 1-2 hours

### 2.4 Standardize TypeScript versions via catalog
- **Files:** `packages/router/package.json`, `packages/cli/package.json`, `packages/setup/package.json`
- **Fix:** Replace version pins with `catalog:`, ensure `pnpm-workspace.yaml` catalog has `typescript: 5.9.3`
- **Verify:** `pnpm deps:check` exits 0
- **Effort:** 10 min

### 2.5 Remove or guard CORS wildcard presets
- **File:** `packages/core/src/security/headers.ts:504-522`
- **Fix:** Either remove `permissive` and `api` presets, or add runtime warning when `origin: '*'` is used in production (`NODE_ENV === 'production'`)
- **Verify:** Existing CORS tests pass
- **Effort:** 30 min

### 2.6 Remove unused `sharp` from packages/core
- **File:** `packages/core/package.json`
- **Fix:** Remove `sharp` from dependencies, verify no imports exist
- **Verify:** `pnpm --filter @revealui/core build && pnpm --filter @revealui/core test`
- **Effort:** 10 min

### 2.7 Document contracts→db dependency inversion
- **File:** `packages/contracts/src/generated/zod-schemas.ts:15`
- **Problem:** Contracts imports from db (should be the other way around)
- **Fix (short-term):** Add architecture decision comment explaining the generation pattern
- **Fix (long-term, deferred):** Refactor so contracts is the source of truth and db derives from it
- **Effort:** 15 min (comment) / 1-2 days (refactor, deferred)

---

## Phase 3: P2 — Medium Priority (8 items)

### 3.1 Add tests for untested critical modules
Priority order by risk:
1. **Error handling** (circuit-breaker, retry, error-reporter) — 2 hours
2. **Monitoring** (health-monitor, process-registry, cleanup-manager) — 2 hours
3. **Relationships** (analyzer, population) — 1.5 hours
4. **Caching** (edge-cache, cdn-config, query-cache) — 1.5 hours
5. **Dataloader** — 1 hour
6. **Sync hooks** (useAgentMemory, useAgentContexts) — 1 hour
- **Total effort:** ~9 hours across multiple sessions

### 3.2 Create Zod env validation schema
- **Location:** New file `packages/config/src/env.ts`
- **Fix:** Define required/optional env vars with Zod, parse at app startup
- **Pattern:** Follow existing `@revealui/config` loader patterns
- **Effort:** 2 hours

### 3.3 Add release artifact validation
- **File:** `.github/workflows/release.yml`
- **Fix:** After build, add step to verify dist/ is non-empty and .d.ts files exist for each OSS package
- **Effort:** 1 hour

### 3.4 Document build system rationale
- **Location:** Comment in root `package.json` or new `BUILD.md` section in CLAUDE.md
- **Content:** Why tsc for core packages (subpath exports), tsup for simple packages (single bundle), vite for presentation (React + CSS)
- **Effort:** 15 min

### 3.5 Enable noUnusedLocals in base tsconfig
- **File:** `packages/dev/src/ts/base.json:16-17`
- **Fix:** Set both to `true`, fix any resulting errors
- **Risk:** May surface legitimate unused locals; handle case-by-case
- **Effort:** 1-2 hours

### 3.6 Extract API middleware to package
- **Problem:** `packages/test` imports from `apps/api` via relative path
- **Fix:** Move reusable middleware (error handler) to `@revealui/core` or new shared location
- **Effort:** 1 hour

### 3.7 Fix API tsconfig exclude pattern
- **File:** `apps/api/tsconfig.json:23`
- **Fix:** Change `["**/*.spec.ts"]` to `["**/*.spec.ts", "**/*.test.ts"]`
- **Effort:** 5 min

### 3.8 Add noEmit comments to package tsconfigs
- **Files:** All package tsconfig.json files that override noEmit
- **Fix:** Add comment explaining emit vs no-emit pattern
- **Effort:** 15 min

---

## Phase 4: P3 — Low Priority (5 items)

### 4.1 Parameterize instrumentation circuit breaker
- **File:** `apps/cms/src/instrumentation.ts:58`
- **Effort:** 5 min

### 4.2 Remove commented-out VideoMedia code
- **File:** `apps/cms/src/lib/components/Media/VideoMedia/index.tsx:13,19-20`
- **Effort:** 5 min

### 4.3 Tighten test Biome rules
- **File:** `biome.json:225-243`
- **Effort:** 10 min

### 4.4 Add engines field to packages
- **Files:** All package.json files missing `engines`
- **Effort:** 15 min

### 4.5 Add presentation convenience export
- **File:** `packages/presentation/package.json`
- **Effort:** 10 min

---

## Execution Order

```
Phase 1 (P0): ~45 min — do first, in one session
Phase 2 (P1): ~4 hours — can be split across 2 sessions
Phase 3 (P2): ~17 hours — split across multiple sessions, parallelize test writing
Phase 4 (P3): ~45 min — do whenever convenient
```

## Success Criteria

- [ ] `pnpm gate` passes with zero warnings
- [ ] `pnpm deps:check` exits 0
- [ ] CI builds run on PRs
- [ ] No `origin: '*'` reachable in production code paths
- [ ] DatabaseStorage.incr() is atomic
- [ ] All critical modules have >80% test coverage
- [ ] Env vars validated at startup with clear error messages
