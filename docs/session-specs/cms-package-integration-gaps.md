# Session Spec: CMS Package Integration Gaps

**Date:** 2026-04-07
**Scope:** `apps/cms` vs all `@revealui/*` packages
**Goal:** Identify where the CMS should leverage existing packages but doesn't, plus critical fixes and enhancements for current implementations.

---

## Critical Fixes (must address)

### CRIT-1: Hardcoded `http://localhost:3004` fallback in 3 API routes

Three server-side route handlers fall back to `http://localhost:3004` if both `NEXT_PUBLIC_API_URL` and `REVEALUI_PUBLIC_SERVER_URL` are missing. In production, this silently breaks all content proxy routes.

- `apps/cms/src/app/api/globals/[slug]/route.ts:6`
- `apps/cms/src/app/api/collections/[collection]/route.ts:7`
- `apps/cms/src/app/api/collections/[collection]/[id]/route.ts:7`

**Fix:** Throw at startup if neither env var is set, or use `@revealui/config` with a required field.

### CRIT-2: Duplicate ErrorBoundary implementations out of sync

Two separate `ErrorBoundary` class components exist:
- `src/components/ErrorBoundary.tsx` — imported by layouts, includes Sentry reporting
- `src/lib/components/ErrorBoundary/index.tsx` — imported by blocks, includes logger but no Sentry

The layouts use the version WITHOUT structured logging. The blocks use the version WITHOUT Sentry. Both should be a single component with both capabilities.

**Fix:** Consolidate into one `ErrorBoundary` in `src/components/ErrorBoundary.tsx` with both Sentry + logger.

### CRIT-3: No auth audit trail

The CMS has zero security-event audit logging. Neither `@revealui/auth`'s audit bridge (`auditLoginSuccess`, `auditLoginFailure`, `auditAccountLocked`, `auditPasswordChange`, `auditPasswordReset`, `auditMfaEnabled`, `auditMfaDisabled`, `auditSessionRevoked`) nor `@revealui/security`'s `AuditTrail` are wired in.

Authentication events (sign-in, sign-up, password change, MFA toggle, session revocation, passkey registration) leave no security audit trail.

**Fix:** Wire `auditLoginSuccess`/`auditLoginFailure` into sign-in routes, `auditPasswordChange` into change-password, `auditMfaEnabled`/`auditMfaDisabled` into MFA routes, `auditSessionRevoked` into session management.

### CRIT-4: Session binding configured but never validated

`@revealui/auth`'s `configureSessionBinding` creates bindings at session creation, but `validateSessionBinding` is never called on subsequent requests. IP/UA binding is set but not enforced.

**Fix:** Call `validateSessionBinding` in the session middleware on each authenticated request.

---

## High-Priority Gaps (significant value, low-medium effort)

### HIGH-1: No `@revealui/resilience` — ad-hoc circuit breaker + no retry

The CMS has zero resilience patterns from the package:
- `src/instrumentation.ts:67-118` — hand-rolled circuit breaker for telemetry (counter + threshold, no half-open recovery). Replace with `CircuitBreaker`.
- Revalidation hooks (`src/lib/hooks/revalidate.ts`) — bare `fetch()` with no retry. Use `fetchWithRetry` with `RetryPolicies.fast`.
- `src/lib/api/electric-proxy.ts` — timeout but no retry. Use `fetchWithRetry` + `fetchWithCircuitBreaker`.

**Work:** Add `@revealui/resilience` to CMS deps. Replace instrumentation circuit breaker (~20 lines). Wrap revalidation + electric proxy fetches (~10 lines each).

### HIGH-2: 25+ files duplicate `getApiUrl()` inline

The pattern `(process.env.NEXT_PUBLIC_API_URL || 'https://api.revealui.com').trim()` is copy-pasted across 25+ files. Also confusing overlap between `NEXT_PUBLIC_API_URL` (external API) and `REVEALUI_PUBLIC_SERVER_URL` (CMS's own URL).

**Fix:** Extract a `getApiUrl()` utility in `src/lib/config/api.ts`. Use `@revealui/config` for validated, typed access.

### HIGH-3: 24 files import `drizzle-orm` directly instead of `@revealui/db/schema`

All Drizzle operators (`eq`, `and`, `or`, `lt`, `gt`, `isNull`, `count`, `sql`, `asc`, `desc`) are re-exported from `@revealui/db/schema`. The CMS imports them from `drizzle-orm` directly in 24 files.

**Fix:** Bulk replace `from 'drizzle-orm'` with `from '@revealui/db/schema'` in CMS route handlers.

### HIGH-4: CMS writes raw queries instead of using `@revealui/db/queries/*`

Routes querying `users`, `sites`, `pages`, `posts`, `products` write inline Drizzle queries. `@revealui/db/queries/*` exports `getAllUsers`, `countUsers`, `getAllSites`, `getSiteById`, `getAllPosts`, etc. — all with soft-delete guards and pagination. None are used.

Also: `isNull(table.deletedAt)` appears inline across routes. `whereActive()` and `withActiveFilter()` from `@revealui/db` are the canonical helpers and are never called.

**Fix:** Migrate route handlers to use `@revealui/db/queries/*` and `whereActive()`.

### HIGH-5: `@revealui/config` barely used — 30+ raw `process.env` reads

The CMS only uses `getSharedCMSConfig` (build-time). Runtime code accesses `process.env.X` directly in 30+ callsites. The CMS even has a parallel `src/lib/utils/env-validation.ts` that re-implements `@revealui/config`'s `validateEnvVars`.

**Fix:** Use `getConfig()` for runtime config access. Replace `env-validation.ts` with `validateEnvVars` from `@revealui/config`.

### HIGH-6: `@revealui/security` completely unwired

The entire package is absent from CMS dependencies:
- **Audit system** — `AuditTrail` with tamper-evident signed entries (replaces hand-rolled `writeGDPRAuditEntry`)
- **GDPR toolkit** — `DataExportSystem`, `DataDeletionSystem`, `ConsentManager`, `DataBreachManager` — all hand-rolled in CMS `/api/gdpr/*` routes
- **Security alerts** — `SecurityAlertService` with threshold-based anomaly detection
- **Field encryption** — `FieldEncryption` / `DataMasking` for PII at rest

**Fix:** Add `@revealui/security` as dependency. Minimum: wire `AuditTrail` and replace hand-rolled GDPR routes with package implementations.

### HIGH-7: No MFA enforcement middleware

`@revealui/auth` exports `requireMfa` middleware. MFA is implemented (opt-in for users) but never enforced for admin roles. Admin and super-admin routes should require MFA.

**Fix:** Apply `requireMfa` to `/admin/*` routes or the admin layout session check.

### HIGH-8: `anyone`/`authenticated` access rules duplicated

The CMS has `src/lib/access/roles/anyone.ts` and `authenticated.ts` that re-implement what `@revealui/core` already exports as `anyone` and `authenticated` from `./auth/access.js`.

**Fix:** Replace CMS access files with imports from `@revealui/core`.

---

## Medium-Priority Enhancements

### MED-1: `@revealui/cache` — bare `next/cache` calls without logging

Four revalidation hooks call `next/cache`'s `revalidatePath`/`revalidateTag` directly with no error handling or logging. `@revealui/cache` wraps these with structured logging and error handling.

Also: no ISR presets used. `generateStaticParams` from the package adds build-failure safety.

**Work:** Add `@revealui/cache` to deps. Replace bare `next/cache` calls in revalidation hooks.

### MED-2: Block validation duplicated locally

`src/lib/blocks/validate-blocks.ts` re-implements `@revealui/contracts/content-validation`'s `validateBlocks`/`validateContent`. The package version is canonical.

**Fix:** Replace local validation with `import { validateBlocks } from '@revealui/contracts/content-validation'`.

### MED-3: Presentation components underutilized

The CMS has custom implementations that duplicate presentation components:
- `src/components/revealui/elements/button.tsx` — 6 button variants vs `ButtonCVA`
- `src/components/revealui/elements/heading.tsx`, `subheading.tsx`, `text.tsx`, `link.tsx` — vs `Heading`/`Subheading`/`Text`/`Link` from presentation
- `src/lib/components/PasswordInput.tsx` — inline `EyeIcon`/`EyeOffIcon` SVGs vs `IconEye`/`IconEyeOff`
- `src/lib/components/ui/pagination.tsx` — parallel pagination implementation
- `src/lib/components/ui/primitives/slot.tsx`, `label.tsx` — duplicates of presentation primitives

Unused presentation components the CMS should consider: `Accordion`, `Alert`, `Avatar`/`AvatarGroup`, `Drawer`, `Dropdown`, `EmptyState`, `Navbar`/`NavbarItem`, `Sidebar`+set, `Table`+set, `Tabs`/`TabList`/`TabPanel`, `Toast`/`useToast`, `Tooltip`, `Timeline`.

### MED-4: 4 individual cron cleanup routes bypass `cleanupStaleTokens`

`cleanup-magic-links`, `cleanup-sessions`, `cleanup-rate-limits`, `cleanup-password-reset-tokens` each write their own delete query. `@revealui/db/cleanup#cleanupStaleTokens` handles all four. Only `cleanup-all/route.ts` uses it.

**Fix:** Have individual routes delegate to `cleanupStaleTokens` or remove them (keep only `cleanup-all`).

### MED-5: `stripe` listed as direct CMS dependency

`apps/cms/package.json` has `"stripe": "^21.0.1"` as a direct dep. All production Stripe calls go through `@revealui/services#protectedStripe`. The bare dep should be `devDependencies` (type-only usage).

### MED-6: ~35 `useCallback` + ~6 `useMemo` — React Compiler makes these unnecessary

Worst offender: `src/lib/components/Agent/index.tsx` (14 `useCallback` instances). Full list:
- `Agent/index.tsx` (14), `billing/page.tsx` (3), `license/page.tsx` (1), `account/page.tsx` (2), `security/page.tsx` (3), `UpgradeDialog.tsx` (2), `AdminBar/index.tsx` (1), `Form/Component.tsx` (1), `SlugComponent.tsx` (1), `useClickableCard.ts` (2), `HeaderTheme/index.tsx` (1), `EmbedNodeComponent.tsx` (1+1 useMemo), `navbar.tsx` (1), `install-command.tsx` (1), `createCollectionContext.tsx` (1), `createContext.tsx` (4 useMemo)

**Fix:** Remove all `useCallback`/`useMemo` wrapping. React Compiler handles memoization automatically.

### MED-7: Paywall server gates not used

`@revealui/paywall/server/next` exports `createNextGates` -> `checkFeatureGate`/`checkTierGate`. The CMS instead uses `isFeatureEnabled` from `@revealui/core/features` in a hand-rolled `ai-feature-gate.ts`. The paywall gates provide standardized denial responses with upgrade headers.

Also: `LicenseGate` (custom component) could be replaced by `PaywallGate` with `fallback={<UpgradePrompt />}`.

Also: `UpgradeDialog.tsx` hardcodes `'revealui:upgrade-required'` string — should use `UPGRADE_EVENT_NAME` from `@revealui/paywall/client`.

### MED-8: Real-time sync hooks completely unwired client-side

`@revealui/sync` exports `useConversations`, `useAgentContexts`, `useCoordinationSessions`, `useCoordinationWorkItems`, `CollabProvider`/`useCollabDocument`. Backend infrastructure (Electric shape proxies + REST mutation routes) is fully wired but no client hooks subscribe to real-time data.

### MED-9: Logger imported from core internals

The CMS imports `@revealui/core/utils/logger` and `@revealui/core/observability/logger` (internal paths). `@revealui/utils` exports the canonical `Logger`/`createLogger`/`logError`/`logAudit` that should be used instead.

Also: `src/lib/hooks/revalidatePost.ts` and `revalidatePage.ts` define inline `RevealUIWithLogger` interfaces that duplicate `Logger`/`LogContext` types.

---

## Low-Priority / Future Work

### LOW-1: No `@revealui/mcp` integration

`/api/mcp/servers/route.ts` returns hardcoded static metadata. The `MCPHypervisor`, `authorizeToolCall`, `McpRateLimiter`, `McpTelemetry`, and server launchers from `@revealui/mcp` are all available but not wired. Future work when MCP features go live.

### LOW-2: Typed error classes not thrown

`@revealui/core` exports `ApplicationError`, `AuthenticationError`, `AuthorizationError`, `NotFoundError`, `ValidationError`, `RateLimitError`. CMS route handlers use generic error response utilities. Throwing typed errors would improve stack traces and error classification.

### LOW-3: Saga/transactional utilities unused

Multi-step writes in auth routes (sign-up, OAuth callback, passkey registration) do multiple independent DB writes with no rollback. `executeSaga`/`withTransaction` from `@revealui/db` would provide atomicity.

### LOW-4: `@revealui/contracts/database` never used

Generated DB row types and the contract-to-DB bridge layer are unused. The CMS uses RevealUI/Drizzle types instead.

### LOW-5: Accessibility gaps

- `SystemHealthMonitor/index.tsx:341-364` — two `<select>` elements have no `<label>` or `aria-label`
- Header `Logo` link has no `aria-label`
- `HighImpact` hero `useEffect` missing dependency array (runs every render)
- `AdminBar` exit-preview button calls `onPreviewExit` with no guard when undefined

### LOW-6: Type safety — `as` casts and `@ts-expect-error`

- `LicenseProvider.tsx:57-58` — `tier as LicenseTierId`, `features as FeatureFlags | null` (unsafe if upstream returns unexpected shape)
- `RichText/serialize.tsx:56,99` — `Record<string, any>` in JSX rendering path
- `billing/page.tsx` — 6x `res.json() as SomeType` without Zod runtime validation
- `Header/config.ts:23`, `Footer/config.ts:23` — `@ts-expect-error` on hook signatures
- `revalidate.ts:32` — `(err as Error).message` in catch (unsafe for non-Error throws)

---

## Execution Order

Recommended session sequence:

1. **Session 1 — Critical fixes** (CRIT-1 through CRIT-4): hardcoded URLs, ErrorBoundary dedup, auth audit, session binding
2. **Session 2 — Resilience + config** (HIGH-1, HIGH-2, HIGH-5): add `@revealui/resilience`, extract `getApiUrl`, wire `@revealui/config`
3. **Session 3 — DB layer cleanup** (HIGH-3, HIGH-4, MED-4): fix drizzle-orm imports, migrate to `@revealui/db/queries/*`, consolidate cron routes
4. **Session 4 — Security package** (HIGH-6, HIGH-7): wire `@revealui/security` audit + GDPR, add MFA enforcement
5. **Session 5 — Paywall + presentation** (HIGH-8, MED-2, MED-3, MED-7): access rule dedup, block validation, component replacements, paywall gate wiring
6. **Session 6 — React Compiler + code quality** (MED-6, MED-9, LOW-5, LOW-6): remove useCallback/useMemo, fix logger imports, accessibility, type safety
7. **Session 7 — Sync + MCP** (MED-8, LOW-1): wire real-time hooks, MCP integration (when features go live)
