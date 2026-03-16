# Remaining Work Execution Spec

**Date:** 2026-03-16
**Scope:** All open MASTER_PLAN items — audit findings, architecture, tests, polish, marketing prep
**Approach:** Worktree per wave, subagent-driven development, two-stage review

---

## Pre-Research Findings (items already complete)

Before planning, we verified current codebase state. Several MASTER_PLAN items are already resolved:

| Item | MASTER_PLAN Status | Actual Status |
|------|-------------------|---------------|
| R3-I1: Vite v6→v7 in Studio | Open | **DONE** — Studio on vite ^7.3.1, @vitejs/plugin-react ^5.1.2 |
| R4-M8: Missing error classes | Open | **NEEDS VERIFICATION** — core/utils/errors.ts has some classes; verify RateLimitError, NotFoundError, ConflictError exist |
| ElectricSQL: fetch timeout | Open | **DONE** — 10s AbortSignal.timeout in electric-proxy.ts |
| ElectricSQL: setup-sync-schema.sql | Open | **DONE** — scripts/setup-sync-schema.sql exists (6 tables) |
| ElectricSQL: dead getUserIdFromRequest | Open | **DONE** — 0 occurrences in codebase |
| ElectricSQL: Yjs protocol constants | Open | **DONE** — packages/sync/src/collab/protocol-constants.ts |
| Webhooks god file (1,138 LOC) | Open | **DONE** — packages/services webhooks is 326 LOC (already split) |
| R4-L4: validateRelationshipMetadata | Open | **DONE** — already called at analyzer.ts:89 |

**Net reduction:** 7 confirmed done items removed. R4-M8 kept pending verification.

---

## Wave 1: Quick Wins (~5h total)

Independent items, each <2h, parallelizable.

### 1.1 R3-I11: Discriminated SignInResult Type
**Current:** `SignInResult { success: boolean; error?: string }` — callers can't distinguish failure reasons.
**Target:** Union type with discriminant:
```typescript
type SignInResult =
  | { success: true; user: User; sessionToken: string; requiresMfa?: false }
  | { success: true; requiresMfa: true; mfaUserId: string }
  | { success: false; reason: 'invalid_credentials' | 'account_locked' | 'rate_limited' | 'account_not_found' | 'email_not_verified'; error: string }
```
**Files:** `packages/auth/src/types.ts`, `packages/auth/src/server/auth.ts` (signIn function), all callers in `apps/cms/src/app/api/auth/sign-in/route.ts`
**Verification:** `pnpm --filter @revealui/auth typecheck && pnpm --filter @revealui/auth test`

### 1.2 R3-I12: Studio Rust thiserror Types
**Current:** All Tauri commands use `Result<T, String>` with `.map_err(|e| e.to_string())`.
**Target:** `thiserror` crate with structured error enum per command module.
**Files:** `apps/studio/src-tauri/Cargo.toml` (add thiserror), `apps/studio/src-tauri/src/commands/*.rs`
**Verification:** `cd apps/studio/src-tauri && cargo check`

### 1.3 R4-M7: `as unknown as` Double Cast Cleanup (hot paths only)
**Current:** ~60 files in packages/ with double casts. Many are in dead bridge utilities (R3-A1, R3-A2, R3-A3).
**Target:** Triage first — grep and categorize. Remove dead cast utilities. Add type guards to hot-path files (API routes, config proxy, CMS hooks). Leave framework internals for post-launch.
**Files:** Triage first — grep for `as unknown as`, categorize by dead-code vs hot-path.
**Verification:** `pnpm typecheck:all`

### 1.4 R3-I14: TODO/FIXME Triage (Stripe-adjacent only)
**Current:** 308 TODOs total. Stripe-adjacent count needs fresh grep (MASTER_PLAN says 16 but may be stale).
**Target:** Grep Stripe-adjacent files first. Resolve or document all Stripe TODOs — payment code with unresolved TODOs is tech debt with financial consequences.
**Files:** `apps/api/src/routes/billing.ts`, `packages/services/src/api/webhooks/`, CMS collection hooks (`Products/hooks/`, `Prices/hooks/`).
**Verification:** `grep -r 'TODO\|FIXME' <stripe-files> | wc -l` should be 0.

### 1.5 R4-M8: Missing Error Type Classes (if incomplete)
**Contingent:** Verify whether `RateLimitError`, `NotFoundError`, `ConflictError` exist in `packages/core/src/utils/errors.ts`. If missing, add them following the existing `ApplicationError` base class pattern.
**Files:** `packages/core/src/utils/errors.ts`
**Verification:** `pnpm --filter @revealui/core typecheck`

---

## Wave 2: Medium Effort (~10h total)

### 2.1 R3-I10: Email Verification Enforcement in signIn()
**Current:** `signUp()` generates a verification token and `verify-email` route exists. But `signIn()` does NOT check `emailVerified` before creating a session — unverified accounts can sign in immediately. `emailVerified` and `emailVerifiedAt` columns already exist in DB schema.
**Target:**
- Add `emailVerified` check to `signIn()` in `packages/auth/src/server/auth.ts`
- Return discriminated `reason: 'email_not_verified'` (depends on Wave 1 task 1.1)
- Grace period: allow sign-in for 24h after signup (soft enforcement via `createdAt` comparison)
- Verify resend-verification endpoint works correctly
**Files:** `packages/auth/src/server/auth.ts` (signIn function only)
**Verification:** Unit test: signup → try login before verification → returns email_not_verified reason → verify → login succeeds
**Dependency:** Wave 1 task 1.1 (discriminated SignInResult)

### 2.2 God File Splits
**Current:** `tickets.ts` (1,259 LOC, 5 resources), `content.ts` (1,059 LOC)
**Target:**
- `tickets.ts` → `boards.ts`, `columns.ts`, `tickets.ts`, `comments.ts`, `labels.ts`
- `content.ts` → `sites.ts`, `pages.ts`, `posts.ts`, `media.ts`
- Shared helpers extracted to `routes/_helpers/` directory
- AdminDashboard.tsx (if >700 LOC) → useReducer + sub-components
**Files:** `apps/api/src/routes/tickets.ts`, `apps/api/src/routes/content.ts`, `apps/cms/` AdminDashboard
**Verification:** All existing route tests pass, no API behavior changes

---

## Wave 3: Test Coverage Sprint (~10h total)

### 3.1 Studio Test Coverage (incremental)
**Current:** 13 test files exist (8 hook tests, 5 component tests). Some components and integration paths still uncovered.
**Target:** Add tests for remaining untested components (deploy wizard steps, dashboard panels, IPC bridge). Target: 70% coverage (up from current ~40%).
**Files:** `apps/studio/src/__tests__/` (new test files for untested components)
**Verification:** `pnpm --filter studio test -- --coverage`

### 3.2 Marketing App Tests
**Current:** 3 test files (health route, waitlist route, pricing data).
**Target:** Add component tests for signup flow, pricing page rendering, hero section, footer links. Target: 50% coverage.
**Files:** `apps/marketing/src/` (co-located test files)
**Verification:** `pnpm --filter marketing test`

### 3.3 Docs App Tests
**Current:** 3 test files. License gate, useLicenseKey, routing untested.
**Target:** Test license gate, license key hook, docs routing. Target: 40% coverage.
**Files:** `apps/docs/src/__tests__/`
**Verification:** `pnpm --filter docs test`

---

## Wave 4: Architecture (~12h total)

### 4.1 /ee Folder Restructure
**Current:** Pro packages scattered across `packages/ai`, `packages/mcp`, `packages/editors`, `packages/services`, `packages/harnesses`.
**Target:** Move Pro package source into `/ee/` folder pattern (following Cal.com, Novu, Langfuse):
```
ee/
  packages/
    ai/
    mcp/
    editors/
    services/
    harnesses/
```
**Required changes:**
- Add `ee/packages/*` to `pnpm-workspace.yaml` packages glob
- `git mv` each Pro package directory
- Update all `workspace:*` references in consumer package.json files
- Update turbo.json task references if any use explicit package paths
- Update root tsconfig.json paths for Pro packages
- Verify workspace integrity via `pnpm ls --depth=0`
**Files:** All Pro package dirs, `pnpm-workspace.yaml`, root `tsconfig.json`, consumer `package.json` files
**Verification:** `pnpm install && pnpm ls --depth=0 && pnpm build && pnpm test`

### 4.2 Core Security Package Extraction (§4.5.11 Phase A)
**Current:** `packages/core/src/security/` is ~3,969 LOC embedded in core. MASTER_PLAN warned of circular dep risk.
**Target:**
- New `packages/security/` package with all security modules
- Re-export from `@revealui/core/security` for backwards compat
- Map circular dependencies before moving — if imports from core types are too deep, extract only the modules that can move cleanly and leave the rest
- Update direct imports in `apps/api/` and `apps/cms/` where straightforward
**Risk mitigation:** Start with dependency analysis. If circular deps block full extraction, extract only the independent modules (headers.ts, encryption.ts, gdpr.ts) and document what remains.
**Files:** New package, `packages/core/src/security/*`, consumer imports
**Verification:** `pnpm typecheck:all && pnpm test`

### 4.3 Studio Desktop Polish
**Current:** Functional but rough. No shared UI primitives. Studio is a Tauri desktop app — uses its own Tailwind setup, not `@revealui/presentation` (which targets web/server components).
**Target:**
- Create 6 Studio-specific UI primitives (Button, Input, Card, Badge, Tooltip, Dialog) in `apps/studio/src/components/ui/` — lightweight, Tailwind-based, matching Studio's desktop design language
- Refactor panels to use shared primitives (reduce duplication across 7 panel components)
- Add `read_app_log` Rust command + log viewer in AppCard
- SSH bookmark sidebar, resize debounce, connection status strip
**Rationale for not using @revealui/presentation:** Studio is a Tauri desktop app with its own build pipeline and design language. Pulling in the full presentation package would add web-focused components and server-side rendering concerns that don't apply to a desktop context.
**Files:** `apps/studio/src/components/ui/` (new), all panel components, Rust commands
**Verification:** `cargo check && pnpm --filter studio build`

---

## Wave 5: Polish & Marketing (~6h total)

### 5.1 §3.3: Landing Page Polish
**Target:** Real screenshots of CMS, API docs, Studio. Update hero section. Ensure all links work.
**Files:** `apps/marketing/`
**Verification:** Visual review + link check

### 5.2 §3.4: Pro Packages Publish
**Target:** Run `pnpm release:pro` to publish ai/mcp/editors/services/harnesses to GitHub Packages.
**Prerequisite:** Pro packages must not have `"private": true`.
**Files:** Pro package.json files, `.github/workflows/release-pro.yml`
**Verification:** Packages visible on GitHub Packages registry

### 5.3 Remaining LOW Items
- R4-L1: Remove `React.FC` usage in CMS (~30m)
- R4-L2: Gate docs build console.log behind DEBUG flag (~15m)
- R4-L3: Type assertions on DB results → type guards (~1h)
- R3-L12: Remaining god file awareness (tracked in 2.2)
- R3-L16: Replace `window.confirm()` with modal in AdminDashboard

---

## Execution Strategy

- **Worktree per wave** via `superpowers:using-git-worktrees`
- **Subagent per task** via `superpowers:subagent-driven-development`
- **Two-stage review** after each task (spec compliance + code quality)
- **Final review** after each wave before merge
- **Branch naming:** `feat/wave-N-<description>`
- **MASTER_PLAN update** after each wave — mark items complete

## Wave Dependencies

- Wave 2 task 2.1 depends on Wave 1 task 1.1 (discriminated SignInResult)
- All other items are independent within and across waves
- Waves 1-3 can execute in parallel with different worktrees if desired

## Not In Scope

- Owner actions (credential rotation, Stripe dashboard, wallet setup, repo public flip)
- New features not in MASTER_PLAN
- Performance optimization beyond audit findings
