# Gap-Closing Plan — 2026-03-12 Audit

**Source:** `docs/superpowers/specs/2026-03-12-codebase-audit.md`
**Goal:** Reach a state where we can safely, confidently, and morally charge customers.
**Status:** ALL PHASES COMPLETE (2026-03-17, sessions 105-110)

---

## Phase 0 — Emergency Fixes ~~(before any payment is accepted)~~ COMPLETE

**Duration: 1-2 days. No new features. Fix or disable.**

### P0-1: Rename CMS middleware file
- **File:** `apps/cms/src/proxy.ts` → `apps/cms/src/middleware.ts`
- **Why:** Next.js ignores `proxy.ts`. All `/admin/*` routes are unprotected.
- **Effort:** 5 min
- **Verification:** Deploy CMS, verify unauthenticated request to `/admin` redirects to login.

### P0-2: Add auth to terminal-auth lookup
- **File:** `apps/api/src/routes/terminal-auth.ts`
- **Why:** `GET /api/terminal-auth/lookup` returns user PII (email, name, role) with zero authentication.
- **Fix:** Require session auth or API key on the lookup endpoint.
- **Effort:** 30 min
- **Verification:** Unauthenticated GET returns 401.

### P0-3: Register audit middleware or remove feature gate
- **File:** `apps/api/src/index.ts` + `apps/api/src/middleware/audit.ts`
- **Why:** `auditMiddleware` is implemented but never mounted. Enterprise tier claims audit logging.
- **Fix:** Either register the middleware in the Hono chain, or remove `auditLog` from the enterprise feature set.
- **Effort:** 30 min
- **Verification:** Make an API call as enterprise tier → verify audit log entry in DB.

### P0-4: Add circuit breaker to remaining billing routes
- **File:** `apps/api/src/routes/billing.ts`
- **Why:** `portal`, `upgrade`, `downgrade` routes call Stripe without `withStripe()`. Generic 500s during outage.
- **Fix:** Wrap all three handlers with the existing `withStripe()` circuit breaker.
- **Effort:** 1 hr
- **Verification:** Mock Stripe failure → verify 503 with retry guidance (matching checkout behavior).

### P0-5: Fix Vercel env whitelist
- **File:** `apps/api/vercel.json`
- **Why:** Missing `REVEALUI_LICENSE_PRIVATE_KEY`, `REVEALUI_CRON_SECRET`, `CORS_ORIGIN`, `STRIPE_AGENT_METER_EVENT_NAME`, `REVEALUI_LICENSE_PUBLIC_KEY`.
- **Fix:** Add all missing vars to the `env` array.
- **Effort:** 30 min
- **Verification:** Deploy to Vercel preview → verify `/api/health` returns all expected capabilities.

### P0-6: Fix upgrade page server/client boundary
- **File:** `apps/cms/src/app/(backend)/admin/upgrade/page.tsx`
- **Why:** `'use client'` component imports from `@revealui/presentation/server`. Renders nothing or throws.
- **Fix:** Either remove `'use client'` and restructure as server component, or import PricingTable from the client barrel.
- **Effort:** 1 hr
- **Verification:** Navigate to `/admin/upgrade` → pricing tiers render correctly.

### P0-7: Create legal pages
- **Files:** `apps/cms/src/app/(frontend)/legal/terms/page.tsx` + `apps/cms/src/app/(frontend)/legal/privacy/page.tsx`
- **Why:** Signup form links to `/legal/terms` and `/legal/privacy` which 404. Legal requirement for payment.
- **Fix:** Create pages (can initially route to marketing app's `/terms` and `/privacy` content via redirect, or duplicate content).
- **Effort:** 1 hr
- **Verification:** Click ToS and Privacy links from signup page → pages load.

### P0-8: Fix or document serverFunction
- **File:** `apps/cms/src/app/(backend)/layout.tsx`
- **Why:** `serverFunction` returns `undefined`. Any admin panel action routed through it silently fails.
- **Fix:** Determine what `RootLayout` from `@revealui/core/admin` sends through `serverFunction` and implement, OR confirm it's unused by the current admin UI and add a comment.
- **Effort:** 2 hr (investigation needed)
- **Verification:** Test admin panel save/publish operations.

---

## Phase 1 — Pro Tier Honest Reckoning — COMPLETE

**This is a business decision, not a code task.**

### The Problem

3 of 5 Pro packages have zero auditable source in this repo:
- `@revealui/ai` — dist-only
- `@revealui/mcp` — static metadata, no protocol code
- `@revealui/editors` — does not exist
- `@revealui/services` — dist-only

### Option A: Source the Pro packages into this repo
If source exists in `revealui-jv` or elsewhere, bring it in. Until source is here, you cannot maintain, patch, or audit it.

### Option B: Reduce Pro scope to what's verifiable (RECOMMENDED)
Ship Pro as:
- Harnesses (JSON-RPC coordination, PGLite, ElectricSQL sync) — **full source, solid**
- Sync (collab, real-time hooks) — **full source, functional**
- AI chat (CMS chat route with tool execution) — **works**
- BYOK (after fixing to support multiple providers) — **fixable**

Remove from Pro tier description until source is available:
- Editor daemon / Zed / VS Code / Neovim adapters
- MCP server implementations
- CRDT memory (schema exists, no write paths)
- Four-store cognitive memory

### Option C: Delay Pro launch
Ship OSS first. Launch Pro when source is ready.

### Decision required before proceeding to Phase 2.

---

## Phase 2 — Concerning Fixes ~~(first week after Phase 0)~~ COMPLETE

**Duration: 3-5 days.**

### Security & Data Integrity

| Task | File | Effort |
|------|------|--------|
| Fix BYOK to detect provider from API key format | `apps/api/src/routes/agent-stream.ts` | 2 hr |
| Raise bcrypt cost factor to 12 in core CRUD | `packages/core/src/collections/operations/create.ts:76` | 5 min |
| Add slug validation regex to core CRUD operations | `packages/core/src/collections/operations/find.ts` | 30 min |
| Add unique constraint to `ticketLabelAssignments(ticketId, labelId)` | `packages/db/src/schema/tickets.ts` + new migration | 30 min |
| Fix Stripe tier resolution — throw on missing metadata | `apps/api/src/routes/webhooks.ts:78-97` | 1 hr |
| Fix `customersProxy` — throw on missing `stripeCustomerID` | `apps/cms/src/lib/hooks/customersProxy.ts:75` | 30 min |
| Persist GDPR breach records to DB | `packages/core/src/security/gdpr.ts:633` | 2 hr |
| Add `Vary: Origin` to `CORSManager` | `packages/core/src/security/headers.ts:317-336` | 30 min |
| Add CSV escape to GDPR export | `packages/core/src/security/gdpr.ts:260` | 1 hr |

### CMS Fixes

| Task | File | Effort |
|------|------|--------|
| Fix `SESSION_COOKIE_DOMAIN` production throw | `apps/cms/src/app/api/auth/sign-in/route.ts` + 2 others | 1 hr |
| Fix `PageList` block category/tag `relationTo` | `apps/cms/src/lib/blocks/PageList/index.ts` | 30 min |
| Fix OAuth callback error code mismatch | Auth callback + login page | 30 min |
| Add auth check to `/admin/upgrade` page | `apps/cms/src/app/(backend)/admin/upgrade/page.tsx` | 30 min |

### Presentation Accessibility

| Task | File | Effort |
|------|------|--------|
| Fix `Dialog`/`Drawer` `aria-labelledby` — assign `titleId` to heading | `dialog.tsx`, `drawer.tsx` | 30 min |
| Fix `Tooltip` `aria-describedby` | `tooltip.tsx` | 30 min |
| Add `Tabs` keyboard arrow navigation | `tabs.tsx` | 1 hr |
| Export `Pagination` from `client.ts` | `client.ts` | 5 min |
| Add server-safe export barrel to presentation | New `server.ts` file | 1 hr |

### Marketing

| Task | File | Effort |
|------|------|--------|
| Add fallback prices to pricing page | `apps/marketing/src/app/pricing/page.tsx` | 1 hr |
| Create and add OG images | `apps/marketing/public/` + layout metadata | 2 hr |

---

## Phase 3 — Test Hardening ~~(second week)~~ COMPLETE

| Task | File | Effort |
|------|------|--------|
| Split unit/integration tests in CI — hard-fail unit tests | `.github/workflows/ci.yml` + vitest configs | 2 hr |
| Rewrite E2E payment tests — remove `if (isVisible)` guards | `packages/test/src/e2e/payments.spec.ts` | 4 hr |
| Enable `strict: true` in `packages/test/tsconfig.json` | `packages/test/tsconfig.json` + fix type errors | 4 hr |
| Add tests for auth React hooks | `packages/auth/src/react/__tests__/` | 4 hr |
| Add integration test for `CollectionOperations` | `packages/core/src/collections/__tests__/` | 4 hr |
| Export and test sync coordination hooks | `packages/sync/src/index.ts` + new test files | 2 hr |

---

## Phase 4 — Operational Readiness ~~(before production traffic)~~ COMPLETE

| Task | File | Effort |
|------|------|--------|
| Fix streaming SSR or remove code path | `packages/router/src/server.tsx` | 2 hr |
| Fix `signUp` atomicity — cleanup orphaned users on Neon HTTP | `packages/auth/src/server/auth.ts` | 2 hr |
| Add OpenAPI specs to marketplace, GDPR, A2A, RAG routes | 4 route files | 4 hr |
| Fix A2A SSE stream timeout to match agent timeout (120s) | `apps/api/src/routes/a2a.ts:515` | 1 hr |
| Add `x-request-id` length validation (max 128 chars) | `apps/api/src/middleware/request-id.ts` | 30 min |
| Add public read path for published content | `apps/api/src/routes/content.ts` | 2 hr |
| Fix embed drawer or remove feature | `apps/cms/src/lib/features/embed/plugins/EmbedPlugin.tsx` | 2 hr |
| Replace `getMeUser` HTTP loopback with direct `getSession()` | `apps/cms/src/lib/utilities/getMeUser.ts` | 1 hr |
| Add canonical URLs and sitemap to marketing | `apps/marketing/` | 2 hr |
| Fix docs `copy-docs.sh` INTERNAL_FILES divergence | `apps/docs/scripts/copy-docs.sh` | 30 min |
| Fix `revealui.config.ts` deprecated Next.js config keys | `packages/config/src/revealui.config.ts` | 1 hr |
| Add CORS production warning (throw instead of warn) | `packages/config/` + `packages/core/src/security/headers.ts` | 1 hr |

---

## Total Effort Estimate

| Phase | Effort |
|-------|--------|
| Phase 0 | 1-2 days |
| Phase 1 | Business decision (0 code days) |
| Phase 2 | 3-5 days |
| Phase 3 | 3-4 days |
| Phase 4 | 3-4 days |
| **Total** | **~2 weeks of focused work** |

---

*Generated 2026-03-12 from exhaustive 8-agent parallel audit.*
*All phases completed 2026-03-17 (sessions 105-110).*
