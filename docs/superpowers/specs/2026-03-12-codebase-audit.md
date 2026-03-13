# RevealUI Codebase Audit — 2026-03-12

**Scope:** Entire codebase — code and configuration only. No documentation.
**Method:** 8 parallel deep-exploration agents, every source file read.
**Standard:** Can we safely, confidently, and morally charge customers?

---

## Executive Summary

**Verdict: NOT READY to charge customers.**

The OSS foundation (auth, billing, CMS engine, UI components) is genuinely strong — bcrypt-12, session binding, atomic rate limiting, Stripe webhook idempotency, 533+ tests. The engineering quality is real and above average for a pre-launch product.

But there are **16 blocking issues** that would result in customers paying for broken features, security exposures, or software that doesn't exist. The Pro tier — the thing you're charging for — has the largest gap: 3 of 5 Pro packages have **zero source code** in this repository.

The honest breakdown:

- **OSS packages:** Ship-ready with targeted fixes (2-3 days of work)
- **Apps (API, CMS, Marketing):** Close to ready, ~5 days of focused fixes
- **Pro packages (AI, MCP, Editors, Services):** Cannot be assessed or shipped from this repo
- **Infrastructure (CI, security, tests):** Solid foundation, needs hardening before production traffic

### Commercial Model Direction

The target business model should be:

- account or workspace subscriptions as the primary hosted billing owner
- metered agent execution and paid API usage in business-readable units
- commerce-linked pricing where RevealUI participates in transactions
- premium trust and governance controls as explicit add-ons

Per-user or perpetual licenses should remain secondary and explicit, not the center of gravity for hosted entitlements.

---

## BLOCKING — Cannot Charge Customers (16 issues)

These must be resolved before accepting payment. Each one either exposes users to harm, breaks a paid feature, or means shipping software that doesn't work.

### Security (3)

| #   | Location                               | Issue                                                                                                                                                                                                                                                                                                     |
| --- | -------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| B1  | `apps/api/src/routes/terminal-auth.ts` | **Unauthenticated PII exposure.** `GET /api/terminal-auth/lookup` returns `{id, email, name, role}` for any SSH key fingerprint with zero auth. Fingerprints are derivable from public GitHub profiles. An attacker can enumerate users and discover admin accounts.                                      |
| B2  | `apps/cms/src/proxy.ts`                | **CMS middleware not loaded.** File is named `proxy.ts` but Next.js requires `middleware.ts`. All admin routes (`/admin/*`) are unprotected at the HTTP level — no session check, no CORS, no domain-lock. The only guard is a React render-time cookie read, which bots and API clients bypass entirely. |
| B3  | `apps/api/src/middleware/audit.ts`     | **Audit logging is dead code.** `auditMiddleware` is fully implemented but never registered in `index.ts`. Enterprise tier (Forge) customers expect audit trails — the feature flag returns `true` but nothing happens. Selling audit logging that doesn't log.                                           |

### Payments & Billing (4)

| #   | Location                                            | Issue                                                                                                                                                                                                                                                           |
| --- | --------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| B4  | `apps/api/src/routes/billing.ts`                    | **Circuit breaker missing from 3 billing routes.** `portal`, `upgrade`, and `downgrade` call Stripe without the `withStripe()` circuit breaker. During Stripe outage, customers get generic 500s instead of clean 503s. They cannot manage their subscriptions. |
| B5  | `apps/api/vercel.json`                              | **Production env vars missing from Vercel whitelist.** `REVEALUI_LICENSE_PRIVATE_KEY`, `REVEALUI_CRON_SECRET`, `CORS_ORIGIN`, and others are not in the `env` array. License generation fails silently, cron endpoints reject all calls, CORS is undefined.     |
| B6  | `apps/cms/src/app/(backend)/admin/upgrade/page.tsx` | **Upgrade page is broken.** Marked `'use client'` but imports `PricingTable` from `@revealui/presentation/server`. Server components cannot render inside client component trees. The page customers use to initiate checkout either throws or renders nothing. |
| B7  | `apps/cms/src/app/(frontend)/signup/page.tsx`       | **ToS links are 404s.** Signup requires checking ToS/Privacy boxes, but `/legal/terms` and `/legal/privacy` don't exist in the CMS app. Users cannot read what they're agreeing to. Legal and regulatory requirement for collecting payment.                    |

### Pro Tier — The Paid Product (5)

| #   | Location                              | Issue                                                                                                                                                                                                                                                                                 |
| --- | ------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| B8  | `packages/ai/`                        | **No source code.** The entire `@revealui/ai` package is dist-only. Cannot audit, cannot fix bugs, cannot verify claims. 9 of 18 advertised subpaths have verified call sites; the other 9 are unverifiable.                                                                          |
| B9  | `packages/mcp/`                       | **No source code, no implementation.** The "MCP servers" are a static JSON array listing third-party npm packages. No MCP protocol code exists anywhere in the repo. The 6 servers listed (Vercel, Stripe, NeonDB, etc.) are other companies' packages, not RevealUI implementations. |
| B10 | `packages/editors/`                   | **Does not exist.** No source, no dist, no runtime import. Zero files. Documentation describes a daemon, Zed ACP, VS Code extension, and Neovim plugin — none of which exist in any form.                                                                                             |
| B11 | `packages/services/`                  | **No source code.** Stripe and Supabase service layer is dist-only. Webhook handling is actually implemented in `apps/api/src/routes/webhooks.ts` (1100+ lines, solid) but the package itself is a black box.                                                                         |
| B12 | `apps/api/src/routes/agent-stream.ts` | **BYOK is Groq-only.** "Bring your own key" hardcodes `provider: 'groq'` and `model: 'llama-3.3-70b-versatile'`. A customer providing an Anthropic, OpenAI, or any non-Groq key gets a silent authentication failure from the Groq API. BYOK as advertised does not work.             |

### CMS Core (2)

| #   | Location                                | Issue                                                                                                                                                                                            |
| --- | --------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| B13 | `apps/cms/src/app/(backend)/layout.tsx` | **Admin server actions are no-ops.** `serverFunction` returns `undefined` unconditionally. Any admin UI operation routed through this mechanism (save, publish, settings) silently does nothing. |
| B14 | `packages/router/src/server.tsx`        | **Streaming SSR broken.** `renderToPipeableStream` returns a `pipe` function, but the code passes it directly as the response body. The streaming path produces empty/corrupt responses.         |

---

## CONCERNING — Fix Before Launch (35 issues)

Not blockers, but each one degrades the customer experience, creates operational risk, or represents technical debt that will bite in production.

### API

| #   | Issue                                                                                         | File                                            |
| --- | --------------------------------------------------------------------------------------------- | ----------------------------------------------- |
| C1  | Marketplace, GDPR, A2A, RAG routes absent from OpenAPI/Swagger spec                           | `apps/api/src/routes/marketplace.ts` + 3 others |
| C2  | `.env.example` missing `REVEALUI_CRON_SECRET`, `STRIPE_AGENT_METER_EVENT_NAME`, `WS_BASE_URL` | `apps/api/.env.example`                         |
| C3  | N+1 query + serial email loop in `support-renewal-check` cron — will timeout on real data     | `apps/api/src/routes/billing.ts:~662`           |
| C4  | No memory cap on Yjs snapshot materialization — unbounded memory allocation                   | `apps/api/src/routes/agent-collab.ts:218-222`   |
| C5  | A2A SSE stream maxes at 30s while agent timeout is 120s — long tasks unobservable             | `apps/api/src/routes/a2a.ts:515`                |
| C6  | `x-request-id` accepted without length limit — log injection vector                           | `apps/api/src/middleware/request-id.ts`         |
| C7  | No public read path for published content — headless CMS can't serve public websites          | `apps/api/src/routes/content.ts`                |
| C8  | Tenant ID format-validated but existence not verified in DB                                   | `apps/api/src/middleware/tenant.ts`             |

### CMS

| #   | Issue                                                                                                      | File                                                      |
| --- | ---------------------------------------------------------------------------------------------------------- | --------------------------------------------------------- |
| C9  | `SESSION_COOKIE_DOMAIN` missing in production throws after successful auth — user authed but no cookie set | `apps/cms/src/app/api/auth/sign-in/route.ts`              |
| C10 | `PageList` block wires category/tag filters to wrong collection (`pages` instead of `categories`/`tags`)   | `apps/cms/src/lib/blocks/PageList/index.ts`               |
| C11 | Embed drawer in rich text editor permanently non-functional (stubbed `useModal` and `FieldsDrawer`)        | `apps/cms/src/lib/features/embed/plugins/EmbedPlugin.tsx` |
| C12 | `getMeUser` makes HTTP loopback to own public URL for session validation — fragile, slow                   | `apps/cms/src/lib/utilities/getMeUser.ts`                 |
| C13 | Chat route LLM client typed as `any`, tool loop untyped                                                    | `apps/cms/src/app/api/chat/route.ts:210`                  |
| C14 | `/admin/upgrade` bypasses `LicenseGate` and has no auth check                                              | `apps/cms/src/app/(backend)/admin/upgrade/page.tsx`       |
| C15 | MCP servers route hardcodes `status: 'configured'` regardless of env var presence                          | `apps/cms/src/app/api/mcp/servers/route.ts`               |
| C16 | OAuth callback emits `oauth_error` but login page only maps `provider_error` — generic fallback shown      | Auth callback + login page                                |

### Packages

| #   | Issue                                                                                                                                         | File                                                     |
| --- | --------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------- |
| C17 | Bcrypt cost factor 10 in core vs 12 in auth — users created via collection engine get weaker hashes                                           | `packages/core/src/collections/operations/create.ts:76`  |
| C18 | Dynamic collection engine still depends on runtime SQL for config-selected tables; now quarantined in `sqlAdapter.ts` but still redesign debt | `packages/core/src/collections/operations/sqlAdapter.ts` |
| C19 | `ticketLabelAssignments` has no unique constraint on `(ticketId, labelId)` — duplicate labels possible                                        | `packages/db/src/schema/tickets.ts`                      |
| C20 | `signUp` non-atomic over Neon HTTP — orphaned user on session creation failure locks out retry                                                | `packages/auth/src/server/auth.ts`                       |
| C21 | Stripe tier resolution falls back silently to 'pro' on missing metadata — wrong tier granted                                                  | `apps/api/src/routes/webhooks.ts:78-97`                  |
| C22 | `customerID = user.id` fallback sends RevealUI UUID to Stripe API — always 404s                                                               | `apps/cms/src/lib/hooks/customersProxy.ts:75`            |
| C23 | `useCoordinationSessions` and `useCoordinationWorkItems` not exported from sync package                                                       | `packages/sync/src/index.ts`                             |

### Presentation & UI

| #   | Issue                                                                                      | File                                                            |
| --- | ------------------------------------------------------------------------------------------ | --------------------------------------------------------------- |
| C24 | `Tabs` missing keyboard arrow navigation (WAI-ARIA violation)                              | `packages/presentation/src/components/tabs.tsx`                 |
| C25 | `Dialog` and `Drawer` `aria-labelledby` points to unset `titleId` — broken accessible name | `packages/presentation/src/components/dialog.tsx`, `drawer.tsx` |
| C26 | `Tooltip` missing `aria-describedby` on trigger — invisible to screen readers              | `packages/presentation/src/components/tooltip.tsx`              |
| C27 | `Pagination` component not exported from `client.ts` barrel — unreachable                  | `packages/presentation/src/client.ts`                           |
| C28 | No server-safe export barrel — RSC-safe components force client boundary                   | `packages/presentation/`                                        |

### Infrastructure

| #   | Issue                                                                                             | File                                            |
| --- | ------------------------------------------------------------------------------------------------- | ----------------------------------------------- |
| C29 | Tests are warn-only in CI — broken tests never block merges                                       | `.github/workflows/ci.yml:128-129`              |
| C30 | `@revealui/test` has `strict: false` and 33 test files excluded from typecheck                    | `packages/test/tsconfig.json`                   |
| C31 | `DataBreachManager` stores breaches in memory — lost on restart (72h GDPR notification at risk)   | `packages/core/src/security/gdpr.ts:633`        |
| C32 | `CORSManager` does not set `Vary: Origin` header — CDN cache poisoning risk for library consumers | `packages/core/src/security/headers.ts:317-336` |
| C33 | CSV export does not escape user data — CSV injection possible                                     | `packages/core/src/security/gdpr.ts:260`        |

### Marketing & Docs

| #   | Issue                                                                   | File                                      |
| --- | ----------------------------------------------------------------------- | ----------------------------------------- |
| C34 | Pricing page shows blank sections when API is down — no fallback prices | `apps/marketing/src/app/pricing/page.tsx` |
| C35 | No OG images — every shared link has blank preview on social media      | `apps/marketing/src/app/layout.tsx`       |

---

## MINOR — Technical Debt (50+ issues)

Not blocking launch. Tracked for post-launch cleanup. Key items:

- `zod/v4` vs `zod` import inconsistency (2 files)
- Magic numbers (Yjs empty doc `length <= 2`, agent timeout message hardcodes "2 minutes")
- Stripe client instantiated per-request (not cached)
- `failedAttempts` table in DB schema is dead code (brute force uses `rate_limits` table)
- Deprecated `PasswordHasher` (PBKDF2) still exported from core
- Toast IDs use `Math.random()` instead of `crypto.randomUUID()`
- Logger `destination: 'file'` silently falls back to console
- No analytics on marketing site
- No `sitemap.xml` or `robots.txt`
- Accordion uses `{open && ...}` (no animation possible)
- Router advertised as "file-based" but is fully programmatic
- Studio `Cargo.toml` says MIT but should be commercial license
- 33 pre-commit dead comments

---

## Test Coverage Assessment

| Area             | Verdict   | Notes                                                                                 |
| ---------------- | --------- | ------------------------------------------------------------------------------------- |
| **Auth**         | READY     | Gold standard. Concurrency tests, OAuth HMAC, brute force, rate limiting.             |
| **API routes**   | READY     | 42 test files. Billing + webhook tests are excellent.                                 |
| **Core engine**  | PARTIAL   | 42 tests but `CollectionOperations` has no integration test, admin UI utils untested. |
| **Contracts**    | READY     | Schema validation roundtrips cover the type surface.                                  |
| **Config**       | READY     | Lazy proxy, module loading, env validation all tested.                                |
| **Presentation** | READY     | 65 test files against 80+ components. Button test is reference quality.               |
| **DB**           | PARTIAL   | Query tests for core tables, but 15+ tables have no query tests.                      |
| **Sync**         | PARTIAL   | Collab hooks tested, coordination hooks untested.                                     |
| **Services**     | NOT READY | Zero source, zero tests.                                                              |
| **AI**           | NOT READY | Zero source, zero tests.                                                              |
| **MCP**          | NOT READY | Zero source, zero tests.                                                              |
| **Editors**      | NOT READY | Zero source, zero tests.                                                              |
| **E2E payments** | NOT READY | Every assertion wrapped in `if (isVisible)` — silently passes on broken UI.           |
| **CMS pages**    | NOT READY | Next.js page components have no tests.                                                |
| **Marketing**    | PARTIAL   | 3 test files. API routes tested, pages untested.                                      |

---

## Pro Tier Reality Check

This is the harsh part. The Pro tier is what you're asking customers to pay for.

**What Pro claims to offer:**

1. AI agents with CRDT memory, LLM providers, orchestration
2. MCP servers (Stripe, Supabase, Neon, Vercel, Playwright)
3. Editor daemon (Zed, VS Code, Neovim)
4. Stripe + Supabase service integrations
5. AI harnesses with workboard coordination

**What actually exists in auditable source:**

1. AI: Zero source. 9 subpaths have call sites. CRDT has schema but zero write paths. BYOK is Groq-only.
2. MCP: Zero source. A static JSON array of third-party package names.
3. Editors: Zero. Nothing. Not a single file.
4. Services: Zero source. Webhook handling is in the API app, not the package.
5. Harnesses: Full source, solid implementation. JSON-RPC, PGLite coordination, ElectricSQL sync.

**Honest assessment:** 1 of 5 Pro packages has verifiable, auditable source code. The others may exist elsewhere (private repo), but from this codebase, you cannot ship what's advertised. Charging for packages you cannot debug, patch, or verify is a risk to your reputation and potentially a legal liability.

---

## Gap-Closing Plan

### Phase 0 — Emergency Fixes (before any payment is accepted)

**Duration: 1-2 days. No new features. Fix or disable.**

| Priority | Task                                                                                           | Effort |
| -------- | ---------------------------------------------------------------------------------------------- | ------ |
| P0       | Rename `apps/cms/src/proxy.ts` to `middleware.ts` — admin routes are unprotected               | 5 min  |
| P0       | Add auth check to `GET /api/terminal-auth/lookup`                                              | 30 min |
| P0       | Register `auditMiddleware` in `apps/api/src/index.ts` or remove the feature from tier gating   | 30 min |
| P0       | Wrap `portal`, `upgrade`, `downgrade` billing routes with `withStripe()` circuit breaker       | 1 hr   |
| P0       | Fix `apps/api/vercel.json` env whitelist — add all missing vars                                | 30 min |
| P0       | Fix `upgrade/page.tsx` — either make it a server component or use the client PricingTable      | 1 hr   |
| P0       | Create `/legal/terms` and `/legal/privacy` pages in CMS app (or route to marketing app pages)  | 1 hr   |
| P0       | Fix `serverFunction` in CMS backend layout — wire to real handler or document what it controls | 2 hr   |

### Phase 1 — Pro Tier Honest Reckoning (before charging for Pro)

**Duration: Depends on decision. This is a business decision, not a code task.**

You have three options:

**Option A: Source the Pro packages into this repo.**
If the source exists in `revealui-jv` or elsewhere, bring it into the public repo (or a separate private package repo with proper CI). Until the source is here, you cannot maintain, patch, or audit it.

**Option B: Reduce Pro scope to what's verifiable.**
Ship Pro as: harnesses + sync + BYOK (fixed to support multiple providers) + AI chat (the CMS chat route works). Remove editors, MCP servers, and CRDT memory from the Pro tier description. Be honest about what's delivered.

**Option C: Delay Pro launch.**
Ship OSS first (it's genuinely good). Launch Pro when the source is ready and auditable.

**Recommended: Option B.** Ship what works, charge for what's real, expand as you build.

### Phase 2 — Concerning Issues (first week after Phase 0)

**Duration: 3-5 days.**

| Priority | Task                                                                                        | Effort             |
| -------- | ------------------------------------------------------------------------------------------- | ------------------ |
| P1       | Fix BYOK to detect provider from API key format (B12)                                       | 2 hr               |
| P1       | Fix `SESSION_COOKIE_DOMAIN` production throw (C9)                                           | 1 hr               |
| P1       | Fix `PageList` block category/tag `relationTo` (C10)                                        | 30 min             |
| P1       | Fix Stripe tier resolution — throw on missing metadata instead of defaulting to 'pro' (C21) | 1 hr               |
| P1       | Fix `customersProxy` — throw on missing `stripeCustomerID` instead of using user.id (C22)   | 30 min             |
| P1       | Add unique constraint to `ticketLabelAssignments(ticketId, labelId)` (C19)                  | 30 min + migration |
| P1       | Raise bcrypt cost factor to 12 in `core/collections/operations/create.ts` (C17)             | 5 min              |
| P1       | Add slug validation regex to core CRUD operations (C18)                                     | 30 min             |
| P1       | Fix `Dialog`/`Drawer` `aria-labelledby` — assign `titleId` to heading element (C25)         | 30 min             |
| P1       | Fix `Tooltip` `aria-describedby` (C26)                                                      | 30 min             |
| P1       | Add `Tabs` keyboard arrow navigation (C24)                                                  | 1 hr               |
| P1       | Export `Pagination` from `client.ts` (C27)                                                  | 5 min              |
| P1       | Add server-safe export barrel to presentation package (C28)                                 | 1 hr               |
| P1       | Persist GDPR breach records to DB instead of in-memory Map (C31)                            | 2 hr               |
| P1       | Add `Vary: Origin` to `CORSManager` (C32)                                                   | 30 min             |
| P1       | Add fallback prices to marketing pricing page (C34)                                         | 1 hr               |
| P1       | Create and add OG images (C35)                                                              | 2 hr               |

### Phase 3 — Test Hardening (second week)

| Priority | Task                                                                                 | Effort |
| -------- | ------------------------------------------------------------------------------------ | ------ |
| P2       | Make unit tests hard-fail in CI (split from integration tests via tags)              | 2 hr   |
| P2       | Rewrite E2E payment tests — remove `if (isVisible)` guards                           | 4 hr   |
| P2       | Enable `strict: true` in `packages/test/tsconfig.json` and fix type errors           | 4 hr   |
| P2       | Add tests for auth React hooks (useSession, useSignIn, useSignOut, useSignUp)        | 4 hr   |
| P2       | Add integration test for `CollectionOperations` class                                | 4 hr   |
| P2       | Export and test `useCoordinationSessions`/`useCoordinationWorkItems` from sync (C23) | 2 hr   |
| P2       | Add CSV escape to GDPR export (C33)                                                  | 1 hr   |

### Phase 4 — Operational Readiness (before production traffic)

| Priority | Task                                                                                 | Effort |
| -------- | ------------------------------------------------------------------------------------ | ------ |
| P3       | Fix streaming SSR in router (B14) — or remove the streaming code path                | 2 hr   |
| P3       | Fix `signUp` atomicity — add cleanup path for orphaned users on Neon HTTP (C20)      | 2 hr   |
| P3       | Add OpenAPI specs to marketplace, GDPR, A2A, RAG routes (C1)                         | 4 hr   |
| P3       | Fix A2A SSE stream timeout to match agent timeout (C5)                               | 1 hr   |
| P3       | Add `x-request-id` length validation (C6)                                            | 30 min |
| P3       | Add public read path for published content (C7)                                      | 2 hr   |
| P3       | Fix embed drawer — implement or remove (C11)                                         | 2 hr   |
| P3       | Replace `getMeUser` HTTP loopback with direct `getSession()` call (C12)              | 1 hr   |
| P3       | Add canonical URLs and sitemap generation to marketing (minor)                       | 2 hr   |
| P3       | Fix docs `copy-docs.sh` INTERNAL_FILES divergence — ensure MASTER_PLAN.md is blocked | 30 min |

---

## What's Genuinely Good

This audit is harsh by design. Here's what's solid:

- **Auth package** is production-grade. Session binding, bcrypt-12, HMAC-signed OAuth state, timing-safe comparisons, email enumeration protection, brute force with atomic storage. Better than most SaaS products at launch.
- **Stripe webhook handler** (1100+ lines) handles 12 event types with DB-backed idempotency, license generation, tier resolution, and proper revocation on chargeback/refund. This is real billing infrastructure.
- **Presentation library** has 50+ components with genuine accessibility work (ARIA roles, focus traps, roving tabindex, type-ahead). The headless/CVA dual API is well-designed.
- **Harnesses package** is the strongest Pro package — full JSON-RPC 2.0, PGLite coordination, ElectricSQL sync, clean daemon lifecycle.
- **Test suite** (533+ tests) covers auth, billing, and API routes at a level that many shipped products don't reach.
- **Security posture** is above average — no hardcoded secrets, Gitleaks in CI, 33 CVE overrides, input parameterization via Drizzle ORM.

The foundation is real. The gaps are fixable. The Pro tier needs an honest scope reduction or the source needs to be brought into the repo.

---

_Generated 2026-03-12 by exhaustive 8-agent parallel audit. Every source file in the monorepo was read._
