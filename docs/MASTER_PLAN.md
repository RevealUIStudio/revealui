# RevealUI Master Plan

> **AGENTS:** This is the PUBLIC snapshot. The canonical, up-to-date version is at:
> `~/projects/revealui-jv/docs/MASTER_PLAN.md`
> Always read and update the private repo version. This file is synced periodically.

**Last Updated:** 2026-03-30 (Refactored  -  split into MASTER_PLAN + ARCHITECTURE + archive)
**Status:** Public snapshot  -  canonical version in revealui-jv
**Owner:** RevealUI Studio

> This document supersedes all previous roadmaps, action plans, and status docs.
> Architecture reference material → [`ARCHITECTURE.md`](ARCHITECTURE.md)
> Completed phase history → [`archive/completed-phases.md`](archive/completed-phases.md)
> Superseded documents → `docs/archive/`

---

## Current Reality (as of 2026-03-08)

### What Exists

- **Codebase:** ~123,700 lines of TypeScript/Rust across apps + packages
- **History:** 1,842+ commits (Dec 30, 2025 – Mar 2026), solo developer
- **Apps:** 7 (api, admin, docs, marketing, revealcoin, studio, terminal)
- **Packages:** 24 (@revealui/core, contracts, db, auth, presentation, router, config, utils, cli, setup, sync, dev, test, ai, mcp, editors, services, harnesses, openapi, resilience, security, cache, create-revealui, plus scripts)
- **Tests:** 753 test files, 10,784+ tests passing, all workspaces build and typecheck
- **CI:** GitHub Actions (ci.yml with E2E smoke job, release.yml, release-pro.yml, security.yml), 3-phase CI gate + E2E
- **Infrastructure:** Nix flakes, direnv, Biome 2 (sole linter  -  ESLint fully removed Session 85: 17 configs, 14 deps, CI/scripts cleaned), Turborepo, pnpm 10
- **Security:** 5 audit rounds complete (Sessions 75, 78, 82, 84, 101). Gap-closing plan fully resolved (Sessions 105-110). 0 avoidable `any` types. 0 production console statements. AES-256-GCM encryption, bcrypt passwords, RBAC+ABAC, timing-safe TOTP.

### What Works

| Feature | Status | Confidence |
|---------|--------|------------|
| admin engine (core) | Built | High  -  237 files, deep implementation |
| AI agent system | Built | Medium  -  untested in production |
| UI components (56) | Built | High  -  native hooks, no external deps |
| Database schema (75 tables) | Built | Medium  -  migrations exist, production verified |
| Auth (sessions, rate limiting) | Built | Medium  -  code exists, no production verification |
| Stripe integration | Built | Medium  -  DB-backed circuit breaker (circuit_breaker_state table) |
| Lexical rich text | Built | Medium  -  recently integrated |
| REST API (Hono) | Built | Medium  -  routes exist, no production traffic |
| ElectricSQL sync | **Verified** | **High  -  proxy + auth + shapes working in production (Railway → NeonDB)** |

### What Doesn't Exist

- Zero real users (admin account exists for testing)
- Stripe live integration unverified
- Email delivery configured (Gmail API via Google Workspace)
- ~~No `create-revealui` CLI published to npm~~  -  published @0.3.4 (latest, validated 2026-03-28)
- No documentation site deployed
- No marketing page deployed
- No waitlist connected to a real database in production

### Honest Grade: A- (9/10)  -  updated 2026-03-17, post Session 116 (CR-2 verification)

Architecture and security are genuinely strong (auth 9/10, crypto done right). Code discipline is real  -  0 avoidable `any` types, bcrypt+HMAC+AES-GCM, 5,600+ tests. **Session 116 re-verified Session 115's 8-agent audit**: 12 of 14 HIGH findings were false positives (features already implemented in S112-114). Remaining 2 (H5 optimistic locking, H6 indexes) implemented in S116. CR-0, CR-1, CR-2 Tracks B/C/D/E all complete. Grade restored to A-. **Charge-ready for free tier now. Pro tier after: R5-M6 (agent dashboard UI) + CR-3 polish.** **Remaining for launch:** credential rotation + history rewrite (owner, in progress). CR-3 ✅ Landing page ✅ Discourse ✅

---

---

## Business Context

**Model:** Open Core (MIT core + paid Pro / Max / Forge tiers)
**Target Market:** TypeScript-first agencies, SaaS builders, enterprise teams
**Revenue:** SaaS subscriptions  -  Track A: Free / Pro $49/mo / Max $149/mo / Forge $299/mo; Track B: agent task credits ($0.001/task); Track C: perpetual licenses ($299–$1,999 one-time + annual support renewals); Track D: professional services (architecture review, migration assist, launch package, consulting)
**Planned Launch:** OSS core Q3 2026, Pro tier Q4 2026

See `business/BUSINESS_PLAN.md` for full business plan (not superseded  -  separate concern).

---

## Phased Plan

> Completed phases (0, 1, 2, 4.5) are archived in [`archive/completed-phases.md`](archive/completed-phases.md).

### Phase 3: Launch Preparation ✅ COMPLETE (Weeks 11-14)

**Goal:** Prepare for public OSS launch.
**Status:** ALL sub-phases and open items complete (owner confirmed 2026-03-31).
**Audit gap-closing plan:** ALL PHASES COMPLETE (2026-03-17, sessions 105-110).

**Completed sub-phases:** 3.1 Documentation (deployed), 3.2 OSS Prep (16 packages published), 3.3 Marketing (landing page live), 3.4 Pro Tier (packages on npm), 3.5 Production Hardening (6 rounds  -  including CodeQL + regex refactor 2026-03-31), 3.6 AI Features (web search, memory consent, MCP hypervisor), 3.7 Business Operations (blog, outreach, external validation), 3.8 Pre-Public Audit, 3.9 Gap Closure, 3.10 Launch Operations (repo public 2026-03-25).

**Final hardening (2026-03-31):** 36 CodeQL alerts resolved, regex replaced with string methods across 28 files (security-critical paths: session tokens, SQL identifiers, cookie parsing, cache headers, email validation), boundary validation accuracy restored, E2E smoke CI fixed.

#### 3.10 Pre-Launch Smoke Checklist (verified 2026-03-30)
- [x] `GET https://api.revealui.com/openapi.json` → 200 with full spec ✓ OpenAPI 3.0.0, 100+ endpoints
- [x] `GET https://api.revealui.com/.well-known/agent.json` → 200 ✓ Valid agent card
- [x] `admin.revealui.com` without session → /login (not landing page) ✓ 307 → /login
- [x] `revealui.com` "Get Started" → admin.revealui.com/signup ✓
- [x] `revealui.com` "Log in" → admin.revealui.com/login ✓
- [x] `admin.revealui.com/posts` → 301 to revealui.com/blog ✓ 308 redirect (permanent, functional)
- [x] At least 1 blog post visible at revealui.com/blog ✓ "Why I Built RevealUI" (Mar 26, 2026)
- [x] `BuiltWithRevealUI` badge renders in dark mode in footer  -  verified via Playwright MCP (2026-03-31)
- [x] Signup → login page flow  -  verified: admin.revealui.com → /login redirect, signup form at /signup with Name/Email/Password + OAuth (2026-03-31). Full email verification flow requires manual test.
- [x] Pricing page loads with live Stripe prices  -  verified: /api/pricing returns 200, page shows $0/$49/$149/$299 for all 4 tiers (2026-03-31)
- [x] E2E smoke spec added: `packages/test/src/e2e/smoke-production.spec.ts` (8 tests, @smoke tagged: badge, pricing, auth flow, performance budget, security headers, OAuth hrefs, OpenAPI spec, visual regression)

**Quick-Start Validation Request Template:**

> Hey [name], I just open-sourced RevealUI  -  a full-stack TypeScript framework for building SaaS
> products (auth, admin, payments, AI pre-wired). Would you be willing to spend 15-20 minutes trying
> the quick-start guide from scratch? Fresh clone, no help from me  -  just let me know what breaks.
>
> `npx create-revealui@latest my-app`
> Docs: https://docs.revealui.com
>
> Happy to return the favor. Zero obligation.

**Agency Outreach Template:**

> Hi [name], I run [agency name]  -  I saw your recent work on [project/post].
>
> I just open-sourced RevealUI (revealui.com)  -  a TypeScript framework that pre-wires everything
> agencies need for client products: auth, admin, Stripe billing, AI agents. MIT licensed, single
> `npx create-revealui` to scaffold. Designed for exactly the kind of work you do.
>
> Pro tier ($49/mo) includes AI agents + MCP servers for agents that can manage content and
> payments on behalf of clients.
>
> Worth a look? Happy to set up a demo or answer questions.

---

### Phase 4: Pro Tier Completion ✅ COMPLETE (post-public-launch)

**Goal:** Close the gap between "launch-ready" and "Pro tier fully functional."
**Status:** ALL items complete. AI capabilities, open-model inference, streaming, orchestration, Mainframe, OAuth, test coverage, Pro audit fixes  -  all done. BYOK removed (2026-04-05 AI inference pivot: open models only, no proprietary providers).
**Details:** [`archive/completed-phases.md`](archive/completed-phases.md)

---


---

### Phase 5: Agent-First Infrastructure (CURRENT  -  post-Phase 4)

**Goal:** Complete the four-revenue-track pricing model by adding Track B (agent credits/metering), Track C (perpetual licenses), Track D (professional services), Forge self-hosted delivery, and the MCP marketplace foundation.

**Completed:** 5.1 Agent Task Metering, 5.2 x402 Payments, 5.3 Perpetual Licenses (code + UX), 5.4 Forge Docker, 5.5 MCP Marketplace, 5.5.1 Pro Package Test Fixes, 5.6 Post-Launch Cleanup, 5.7 npm Pro Org (partial), 5.8 Local Inference (code complete), 5.11 AI Inference Pivot (open models only), 5.12 Track D Services, 5.13 Charge Readiness Audit. Full details in [`archive/completed-phases.md`](archive/completed-phases.md).

**In progress:** 5.14 RevVault Vercel Sync (Phase A+B complete, C owner migration pending), 5.15 Harness Coordination Runtime (complete), 5.16 RevMarket (complete  -  A-D all done).

**Open items (mostly owner actions):**

#### 5.1 Track B  -  Agent Task Metering
- [x] Stripe overage billing via Billing Meter API  -  already uses `stripe.billing.meterEvents.create()` (billing.ts:1439). **Owner prerequisite remains:** create Stripe Billing Meter + metered Price in dashboard + set `STRIPE_AGENT_METER_EVENT_NAME` env var.

#### 5.2 Track B  -  x402 Native Payments
- [ ] **Owner action:** Set X402_RECEIVING_ADDRESS (Base USDC wallet) + X402_ENABLED=true on revealui-api Vercel project

#### 5.3 Track C  -  Perpetual License Infrastructure
- [x] All 3 perpetual tiers enabled (`comingSoon: false`)  -  2026-04-05
- [x] Support renewal checkout route (`POST /api/billing/checkout-support-renewal`)  -  2026-04-05
- [x] Support renewal webhook handler (extends `supportExpiresAt` +1 year)  -  2026-04-05
- [x] Support renewal confirmation email  -  2026-04-05
- [x] admin license page: perpetual badge, support expiry display, renewal button  -  2026-04-05
- [x] admin billing page: renewal success banner  -  2026-04-05
- [x] Subscription API: returns `perpetual` and `supportExpiresAt` fields  -  2026-04-05
- [x] Renewal catalog entries (`renewal:pro`, `renewal:max`, `renewal:enterprise`)  -  2026-04-05
- [x] Stripe seed script: 3 renewal products with env key mappings  -  2026-04-05
- [x] Stripe products seeded in test mode: Pro/Agency/Forge Perpetual + 3 renewal products  -  `seed-stripe.ts` ran 2026-04-05 (9 products created, 21 prices configured)
- [ ] **Owner action:** Switch Stripe to live mode and re-run `seed-stripe.ts`, or verify products in Stripe dashboard

#### 5.4 Forge Self-Hosted Delivery
- [x] GHCR access gated by license key  -  POST /verify webhook + GET /status endpoint (ghcr.ts, 9 tests)  -  2026-03-31
- [ ] Docker image pushed to GHCR  -  **owner action** after credential rotation

#### 5.5 MCP Marketplace
- [ ] **Owner action:** Run `pnpm db:migrate` against production NeonDB (marketplace tables are in migration 0000 + 0005, already defined)
- [ ] **Owner action:** Set `MARKETPLACE_CONNECT_RETURN_URL` in Vercel API env vars
- [x] Batch payout cron  -  daily 04:00 UTC, Stripe Connect transfers, $0.50 min (marketplace-payouts.ts, 7 tests)  -  2026-03-31

#### 5.6 Post-Launch Cleanup
- [x] Studio: Connection status strip, welcome message  -  already implemented (StatusBar.tsx, WelcomeBanner.tsx)
- [x] Studio: Settings storage hook, settings panel with 4 tabs  -  already implemented (use-settings.ts, SettingsPanel.tsx: Appearance, Connection, Wallet, About)

#### 5.6.1 RevealUI Terminal Experience (cross-platform)
- [x] tmux config + `revealui` launcher (bash, cross-platform)  -  2026-03-31
- [x] Launcher improvements: `revealui status` (git branches + dirty state), `revealui dev` (3-pane layout), color output, bash tab completion  -  2026-03-31
- [x] tmux improvements: git branch in status bar, vi copy mode, pane content restore, quick-kill pane, explicit window names  -  2026-03-31
- [x] Windows Terminal profile + RevealUI Dark color scheme  -  2026-03-31
- [x] Custom RevealUI icon (purple R) for Windows Terminal profile  -  2026-03-31
- [x] macOS: iTerm2 profile + Terminal.app profile export  -  2026-03-31 (config/terminal/)
- [x] Linux: Alacritty / Kitty / GNOME Terminal profile configs  -  2026-03-31 (config/terminal/)
- [x] Package terminal configs into Studio first-run wizard (Tauri bundle.resources, resolve_config_dir fallback)  -  2026-04-07
- [x] CLI installer: `revealui terminal install` + `revealui terminal list` (auto-detect platform + emulator, --force, --json)  -  2026-03-31

#### 5.6.2 RevealUI Workstation (system tray launcher)

A system tray app that provides one-click access to the entire RevealUI dev environment  -  editor, terminals, AI tools, browser profiles, and vendor dashboards  -  organized as a categorized tile gallery.

**Platform:** Tauri 2 (extends Studio desktop app with system tray mode)

**Tile Categories:**

| Category | Tiles | Launch method |
|----------|-------|---------------|
| Editor | Zed | `zed` CLI or protocol URL |
| Terminal | RevealUI tmux, WSL, PowerShell | Windows Terminal profiles (`wt.exe -p "..."`) |
| AI | Claude Desktop, Claude Code | App launch / `claude` CLI |
| Browser | Chrome profiles (Dev, Personal) | `chrome.exe --profile-directory="Profile N"` |
| Accounts | GitHub, Vercel, npm, Stripe, NeonDB, Supabase | Open URL in default browser |
| Dashboards | Vercel, Stripe, NeonDB, Supabase consoles | Open URL in default browser |

**Implementation phases:**

Phase A  -  System tray foundation:
- [x] Tauri system tray with RevealUI icon  -  commit b2bb03f6, 2026-03-01
- [x] Tray right-click → quick menu (Show, Mount/Unmount Studio Drive, Quit)  -  commit b2bb03f6
- [x] Hide-to-tray on window close (X hides, only Quit exits)  -  commit e585bdfd
- [x] Tray click opens tile gallery (navigates to Launcher page, emits `navigate` event)  -  2026-03-31
- [ ] Auto-start on login (optional, configurable)  -  deferred

Phase B  -  Tile gallery UI:
- [x] Category headers with collapsible sections  -  6 categories, chevron toggle  -  2026-03-31
- [x] Tile component: icon + label + launch action  -  20 default tiles, SVG icons, URL/shell launch  -  2026-03-31
- [x] Configurable tiles via localStorage (hide/show per tile, edit mode)  -  2026-03-31
- [x] Search/filter bar for quick access  -  case-insensitive, hides empty categories  -  2026-03-31
- [x] Keyboard shortcut to open gallery  -  Ctrl+Shift+L (CmdOrCtrl), tauri-plugin-global-shortcut, tray menu hint  -  2026-03-31

Phase C  -  Smart features:
- [x] Running indicator (green dot)  -  polls tasklist.exe + ps every 10s, emerald border + dot  -  2026-03-31
- [x] Recent launches section (last 5 tiles used)  -  localStorage, shown above categories  -  2026-03-31
- [x] Quick-switch: if app is already running, focus it instead of relaunching (focusWindow in use-tiles.ts)  -  2026-04-07
- [x] Browser profile detection  -  auto-discovers Chrome/Edge profiles from Windows AppData  -  2026-03-31

Phase D  -  Cross-platform:
- [x] macOS: template icon for menu bar, process detection (ps), app launcher (open -a) - 2026-04-12
- [x] Linux: process detection (ps), app launcher (spawn), platform-conditional tray menu - 2026-04-12
- [x] Tile launch commands per-platform  -  macOS (open -a, tmux) + Linux (google-chrome, gnome-terminal) + platform detection  -  2026-04-07

#### 5.6.3 CI/DX Fixes
- [x] Pre-push gate OOM: router imported `@revealui/core/observability/logger` (re-export from utils), forcing DTS compiler to load 297-file core type graph. Replaced with direct `@revealui/utils/logger` import  -  DTS build drops from OOM to 2.5s (commit 7e10e731)  -  2026-03-31
- [x] Biome PostToolUse hook cache fix: hook now outputs `additionalContext` JSON when it modifies files, preventing Claude's "file unexpectedly modified" errors  -  2026-03-31
- [x] Marketing site polish (#94): 4 P0 fixes (OG brand, version, component count, broken link), 3 P1 fixes (sponsor metadata, package count, admin URL)  -  commits 5e7a6d39, aa8a3254  -  2026-03-31
- [x] Full signup → login → admin dashboard E2E test  -  2026-03-31 (signup-flow.spec.ts, 24 tests, handles both first-user and subsequent-user paths; email verification requires Gmail API credentials for full coverage)

#### 5.7 npm Pro Org Management
- [ ] Verify `@revealui` npm org is claimed and linked to `revealui-org` account
- [ ] Enable npm security scanning on all `@revealui/*` packages
- [ ] Enable 2FA enforcement on the npm org

#### 5.8 Local Inference
- [x] Integration tests  -  17 tests (provider unit + LLMClient wiring, graceful skip without model)  -  2026-03-31
- [x] `docs/architecture/ai-stack.md`  -  comprehensive doc covering 8 providers, tiers, memory, RAG  -  2026-03-31
- [ ] Marketing copy  -  deferred: owner action

#### 5.9 JOSHUA Stack  -  Agent-Parseable Audit
- [x] Comprehensive codebase scan: identify all docs, configs, comments, and READMEs that describe architecture or conventions ✅ 2026-03-30
- [x] Assess agent-parseable coverage: which packages/modules have machine-readable descriptions (structured frontmatter, decision tables, anti-pattern lists) vs. prose-only or undocumented ✅ 2026-03-30
- [x] Gap report: list areas where an AI agent cannot reliably determine intent, boundaries, or constraints from available docs ✅ GAP-106 filed 2026-03-30
- [x] Remediation (H1): add READMEs to openapi, resilience, security, cache with JOSHUA alignment, API tables, "When to Use" ✅ 2026-03-30
- [x] Remediation (H3): add package.json descriptions to 9 undocumented workspaces ✅ 2026-03-30
- [x] Remediation (H2): add README to editors (Pro  -  CRITICAL gap) ✅ 2026-03-30
- [x] Remediation (H4): add JSDoc to editors main exports ✅ 2026-03-30
- [x] Remediation (M3): YAML frontmatter on all 28 docs/*.md files ✅ 2026-03-31
- [x] Remediation (M4): JSDoc on openapi barrel exports ✅ 2026-03-31
- [x] Remediation (M1/M2): JOSHUA principle mapping + "When to Use" on 17 existing READMEs ✅ 2026-03-31
- [x] Validate: agent-simulated navigation across all 22 packages  -  22/22 PASS (minor friction notes: db/ai/mcp subpath depth, dev unscoped naming) ✅ 2026-03-31

#### Release Pipeline
- [x] Set up canary release workflow (`@revealui/core@canary` via Changesets snapshots)  -  2026-03-31 (release-canary.yml, triggers on test branch push, OIDC trusted publishing)
- [x] `/ee` folder evaluation: decided REMOVE  -  no backwards-compat code, provide codemods instead (decision doc: docs/decisions/licensing-platform-evaluation.md)  -  2026-03-31
- [x] Keygen.sh / Anystack evaluation: decided KEEP custom JWT system  -  no external dependency needed (decision doc: docs/decisions/licensing-platform-evaluation.md)  -  2026-03-31


#### 5.11 AI Inference Pivot ✅ COMPLETE (2026-04-05)
- [x] Remove BYOK code paths and proprietary provider support  -  2026-04-05
- [x] Remove `aiSampling` feature flag (Groq sampling removed)  -  2026-04-05
- [x] Align all messaging: free = local inference (inference snaps/Ollama), Pro+ = local + cloud harness (self-hosted open models)  -  2026-04-05
- [x] Update docs, marketing, and admin upgrade page to reflect open-model-only policy  -  2026-04-05

#### 5.12 Track D  -  Professional Services ✅ COMPLETE (2026-04-05)
- [x] `ServiceOffering` contract type + `SERVICE_OFFERINGS` constant (4 offerings)  -  2026-04-05
- [x] `PricingResponse` extended with `services` field  -  2026-04-05
- [x] Pricing API: Stripe product fetch for `track === 'service'` + fallback  -  2026-04-05
- [x] Marketing pricing page: services section with 4-column grid  -  2026-04-05
- [x] Rate limit on checkout-support-renewal route (5 req/min)  -  2026-04-05

#### 5.13 Charge Readiness Audit ✅ COMPLETE (2026-04-05)
- [x] B1 (enforceSiteLimit): confirmed existing  -  false positive
- [x] B2 (billing_catalog seeding): confirmed existing  -  false positive
- [x] B3 (STRIPE_AGENT_METER_EVENT_NAME): standardized to `agent_task_overage`
- [x] H1 (ungated Pro features): confirmed all gated  -  false positive
- [x] H2 (entitlements DB fallback): confirmed fails-closed  -  false positive
- [x] H3 (OAuth PKCE): mitigated by server-side code exchange + HMAC state tokens
- [x] H4 (support renewal checkout): full lifecycle implemented

#### 5.10 Cache Architecture  -  PGlite + ElectricSQL + Turbo

**Goal:** Design and implement a unified caching strategy using the project's actual stack. No Redis, no Memcached  -  PostgreSQL-native caching only.

**Principles:**
- PGlite for in-memory/local-first caching (browser, tests, edge)
- ElectricSQL for real-time cache invalidation and distributed sync
- Turborepo/Turbopack for build + task caching
- PostgreSQL LISTEN/NOTIFY for server-side cache invalidation

**Layers:**

| Layer | Technology | Scope | Invalidation |
|-------|-----------|-------|-------------|
| **Build cache** | Turborepo remote cache | CI + local dev | Content-hash (automatic) |
| **Query cache** | PGlite in-memory tables | Per-request, per-instance | TTL + ElectricSQL shapes |
| **API response cache** | Vercel Edge Cache + `@revealui/cache` | CDN, per-route | Tag-based revalidation |
| **Client state cache** | PGlite (browser) + ElectricSQL sync | Per-user, offline-first | Shape subscriptions (real-time) |
| **Rate limiter state** | PGlite (per-instance) or ElectricSQL (distributed) | Per-tenant | Fixed-window TTL |
| **Circuit breaker state** | PGlite (per-instance) or ElectricSQL (distributed) | Per-service | Failure count + half-open timer |
| **Session cache** | PostgreSQL (NeonDB) | Server-side auth | Expiry column + cleanup cron |

**Implementation phases:**

Phase A  -  Audit current caching (agent): ✅ COMPLETE (2026-04-05)
- [x] Map all in-memory Maps/Sets used as caches across packages  -  11 found
- [x] Identify which need distributed state vs per-instance is fine  -  5 need distributed, 6 per-instance OK
- [x] Document current `@revealui/cache` package capabilities vs gaps  -  5 gaps identified
- [ ] Benchmark PGlite in-memory table performance vs Map for hot-path caches
- Full report: `docs/audits/cache-audit-2026-04-05.md`

Phase B  -  PGlite cache adapter (agent): ✅ COMPLETE (2026-04-05)
- [x] `CacheStore` interface: `get`, `set`, `delete`, `deleteByPrefix`, `deleteByTags`, `clear`, `size`, `prune`, `close`
- [x] `InMemoryCacheStore`: Map-backed, FIFO eviction, configurable maxEntries
- [x] `PGliteCacheStore`: SQL-backed via `_cache_entries` table, auto-created on init, parameterized queries
- [x] TTL via `expires_at` column, `prune()` for cleanup, expired entries excluded from `get()` and `size()`
- [x] Tag-based invalidation via PostgreSQL array overlap (`&&` operator)
- [x] Prefix-based invalidation via `LIKE` with proper escaping (no regex)
- [x] JSON serialization for all value types
- [x] New subpath export: `@revealui/cache/adapters`
- [x] 200 tests passing (shared suite runs against both stores + PGlite-specific SQL edge cases)

Phase C  -  Distributed invalidation + PGlite state stores (agent): ✅ COMPLETE (2026-04-05)
- [x] Rate limiter: `RateLimitStore` interface + `InMemoryRateLimitStore` + `PGliteRateLimitStore`
  - `McpRateLimiter` refactored to accept pluggable store backend (async API)
  - `_rate_limit_windows` table with key/count/window_start columns
  - 30 new tests (shared suite + PGlite-specific)
- [x] Circuit breaker: `CircuitBreakerStore` interface + `InMemoryCircuitBreakerStore` + `PGliteCircuitBreakerStore`
  - Persists state/counters/timestamps to `_circuit_breaker_state` table
  - 20 new tests (shared suite + PGlite-specific SQL tests)
- [x] Cache invalidation channel: `CacheInvalidationChannel` in `@revealui/cache`
  - Event-driven distributed cache busting via `_cache_invalidation_events` table
  - Publish: delete, delete-prefix, delete-tags, clear events
  - Poll-based consumption with auto-pruning and self-event deduplication
  - Foundation for ElectricSQL shape-based invalidation in Phase E
  - 10 new tests covering cross-instance invalidation
- [ ] Shape subscription for cache entries  -  deferred to Phase E (requires client-side ElectricSQL integration)
- [ ] LISTEN/NOTIFY bridge  -  deferred (requires persistent connections, incompatible with Vercel Functions)

Phase D  -  Edge + CDN caching audit (agent): ✅ COMPLETE (2026-04-05)
- [x] Audit Vercel Edge Cache usage in `@revealui/cache`  -  presets defined but unused in routes
- [x] Tag-based revalidation for admin content changes  -  already implemented (`revalidateTag()` + on-demand ISR)
- [x] ISR strategy per route  -  marketing (5min blog, 1hr pricing), admin (on-demand via `/api/revalidate`)
- [x] Cache-Control headers audit across API routes  -  22+ routes lacked headers
- [x] Cache-Control middleware (`apps/api/src/middleware/cache-control.ts`):
  - `noStoreCacheMiddleware`: auth, billing, webhooks, GDPR, license, api-keys, agent routes
  - `noCacheCacheMiddleware`: health, cron, maintenance routes
  - `publicCacheMiddleware`: ready for content/marketplace GET endpoints (follow-up)
- [x] Docs app: immutable cache for hashed static assets (1 year via vercel.json)

Phase E  -  Client-side offline cache (agent):
- [ ] PGlite in browser for offline-first content access
- [ ] ElectricSQL shape subscriptions for live sync
- [ ] Service Worker cache strategy (network-first for API, cache-first for assets)
- [ ] Conflict resolution for offline edits

**Exit criteria:** All in-memory Maps used as caches are documented. Rate limiter and circuit breaker have PGlite adapters. ElectricSQL invalidation works for at least one cache layer. No Redis references remain anywhere in the codebase.

#### 5.14 RevVault Vercel Sync

**Goal:** Make RevVault the single source of truth for Vercel env vars. Eliminate stale/missing/duplicate credentials caused by manual dashboard edits.

**Why:** Production NeonDB password was rotated during launch but Vercel wasn't updated  -  caused outage. Dead vars (GROQ_API_KEY, OPENAI_API_KEY) persist after AI inference pivot. No audit trail for env changes.

**Design spec:** See RevVault repo documentation

Phase A  -  Research + spec design (agent):
- [x] Problem statement and requirements  -  2026-04-06
- [x] Manifest format (`revvault-vercel.toml`)  -  2026-04-06
- [x] CLI commands (`sync vercel --diff/--apply/--pull/--validate`)  -  2026-04-06
- [x] Sync algorithm (read manifest → read vault → read Vercel → diff → apply)  -  2026-04-06
- [x] Integration-managed var detection (Neon, Supabase, Blob prefixes)  -  2026-04-06
- [x] Security considerations (no secrets in manifest, audit log, orphan warnings)  -  2026-04-06

Phase B  -  Implementation (agent):
- [x] Add `sync` subcommand to revvault Rust CLI (commands/sync.rs, 559 lines)  -  2026-04-07
- [x] TOML manifest parser (`revvault-vercel.toml`)  -  SyncManifest struct  -  2026-04-07
- [x] Vercel REST API client (list/create/update/delete env vars)  -  VercelClient, REST API v10  -  2026-04-07
- [x] Diff engine (add/update/orphan/skip classification)  -  DiffEngine with DiffAction enum  -  2026-04-07
- [x] Dry-run output formatter (colored, per-project summary)  -  push_mode/pull_mode with colored output  -  2026-04-07
- [x] `--pull` mode (bootstrap vault from existing Vercel vars)  -  pull_mode with store.upsert()  -  2026-04-07
- [x] Audit log integration (`rotation-log.jsonl`)  -  append_audit_log() JSONL entries  -  2026-04-07

Phase C  -  Migration (owner):
- [ ] `revvault sync vercel --pull` to import existing Vercel vars
- [ ] Clean up vault (remove dead vars, consolidate duplicates)
- [ ] `revvault sync vercel --apply` to push clean state
- [ ] All future env changes go through vault first, then sync

**Exit criteria:** `revvault sync vercel` detects drift between vault and all 5 Vercel projects. `--apply` pushes changes. Integration-managed vars are skipped. Audit trail in `rotation-log.jsonl`.

#### 5.15 RevDev  -  Agent-First Development Environment

**Goal:** Assemble and deploy RevDev  -  the agent-first development environment where AI agents coordinate in real time without manual copy-paste. RevDev combines the existing Studio UI, Harness runtime, and Forge deployment tier into a single product.

**Product:** RevDev = RevealUI Developer Environment
- **RevDev Studio** = desktop/mobile UI (Tauri, future GPUI editor)
- **RevDev Harness** = coordination runtime daemon (JSON-RPC over Unix socket, PGlite state)
- **RevDev Forge** = self-hosted deployment (Docker, on-prem  -  runs both Studio + Harness)

**Tagline:** *"Where agents build with you, not for you."*

**Why:** Current workboard.md + file locking is ahead of Claude Code's native capabilities but requires manual relay between agents. The harnesses package is 80% built (coordinator, RPC server, workboard manager, CLI)  -  needs assembly and deployment. Every coordination improvement is simultaneously a product feature (Pro tier) and a developer workflow improvement ("RevealUI builds RevealUI").

**Existing components (built, need wiring):**

| Component | Package/Location | Status |
|-----------|-----------------|--------|
| RPC server | `packages/harnesses/src/server/rpc-server.ts` | Built |
| Coordinator | `packages/harnesses/src/coordinator.ts` | Built |
| Workboard manager | `packages/harnesses/src/workboard/workboard-manager.ts` | Built |
| CLI wrapper | `packages/harnesses/src/cli.ts` | Built |
| RPC client | `~/.claude/hooks/lib/rpc-client.js` | Built |
| Identity detection | `~/.claude/hooks/lib/identity.js` | Built (6-tier cascade) |
| Session hooks | `~/.claude/hooks/session-start.js` etc. | Built |
| Agent panel UI | `apps/studio/src/components/agent/` | Built (30s polling) |
| Spawner UI + Rust | `apps/studio/src/components/agent/SpawnerPanel.tsx` | Built |
| Inference panel | `apps/studio/src/components/inference/` | Built |
| A2A discovery | `apps/studio/src/lib/a2a-api.ts` | Built |

Phase A  -  Daemon deployment (agent): ✅ COMPLETE (2026-04-06)
- [x] systemd user unit for harness daemon (`~/.config/systemd/user/revdev-harness.service`)  -  2026-04-06
- [x] Auto-start on session init (integrate into `session-start.js` hook)  -  rpc-client.js tries systemd first, falls back to direct spawn  -  2026-04-06
- [x] Health check on Unix socket (`~/.local/share/revealui/harness.sock`)  -  `ping` RPC method, `isDaemonAlive()` in hooks  -  2026-04-06
- [x] Crash recovery (restart daemon if socket gone, exponential backoff)  -  systemd `Restart=on-failure`, `RestartSec=3`, burst limit 5/60s  -  2026-04-06
- [x] Wire existing `rpc-client.js` hooks to live daemon (remove file-only fallback)  -  fixed `daemon`→`start` command, PID file management  -  2026-04-06
- [x] License gate bypass for developer tooling commands (start, coordinate, health)  -  2026-04-06
- Synced to private repo  -  2026-04-06

Phase B  -  PGlite message queue (agent)  -  COMPLETE 2026-04-06:
- [x] PGlite database for daemon state (`~/.local/share/revealui/harness.db`)  -  `@electric-sql/pglite` (in-process PostgreSQL, WASM), externalized in tsup bundle  -  2026-04-06
- [x] Raw SQL schema: `agent_sessions`, `agent_messages`, `file_reservations`, `events` (4 tables, 3 indexes)  -  `packages/harnesses/src/storage/schema.ts`  -  2026-04-06
- [x] `DaemonStore` class with full CRUD (sessions, messages, reservations, events)  -  `packages/harnesses/src/storage/daemon-store.ts`  -  2026-04-06
- [x] `mail.send(to, subject, body)` RPC method  -  2026-04-06
- [x] `mail.inbox(agentId)` RPC method  -  returns unread messages  -  2026-04-06
- [x] `mail.broadcast(subject, body)` RPC method  -  notify all active agents  -  2026-04-06
- [x] `mail.markRead(messageIds)` RPC method  -  2026-04-06
- [x] 15 new store-backed RPC methods total (session.*, mail.*, files.*, events.*)  -  2026-04-06
- [x] 17 new DaemonStore tests (sessions, messages, reservations, events)  -  2026-04-06
- [x] systemd memory limit bumped 256MB → 384MB for PGlite WASM  -  2026-04-06
- [x] Inject pending messages into agent context via `workboard-inject.js` hook  -  auto-reads inbox, outputs `[mail]` lines, marks as read  -  2026-04-06
- [x] Fixed RPC param names in hooks (`sessionId`→`agentId`, `s.agentId`→`s.id`)  -  2026-04-06
- [x] Stale socket cleanup on daemon start (`unlinkSync` before `listen`)  -  2026-04-06
- [x] systemd memory limit bumped 512MB for PGlite WASM query headroom  -  2026-04-06

Phase C  -  Conflict detection + task ownership (agent)  -  COMPLETE 2026-04-06:
- [x] `files.reserve(filePath, agentId, ttl)` RPC method with CAS semantics  -  2026-04-06
- [x] `files.check(filePath)`  -  returns current reservation holder  -  2026-04-06
- [x] `files.release(agentId)`  -  release all reservations for an agent  -  2026-04-06
- [x] `files.list(agentId)`  -  list all reservations for an agent  -  2026-04-06
- [x] Auto-reserve on edit: `workboard-update.js` calls `files.reserve` on every Edit/Write  -  2026-04-06
- [x] Conflict advisory: `pre-tool-use.js` calls `files.check` before Edit/Write, warns if another agent holds reservation  -  2026-04-06
- [x] `tasks` table (PGlite): id, description, status, owner, claimed_at, completed_at  -  2026-04-06
- [x] `tasks.create(taskId, description)` RPC method  -  2026-04-06
- [x] `tasks.claim(taskId, agentId)`  -  atomic CAS claiming (blocks if another agent owns it)  -  2026-04-06
- [x] `tasks.complete(taskId, agentId)`  -  only owner can complete  -  2026-04-06
- [x] `tasks.release(taskId, agentId)`  -  unclaim back to open  -  2026-04-06
- [x] `tasks.list(status?, owner?)`  -  filtered listing  -  2026-04-06
- [x] 8 new task tests (create, claim, conflict, re-claim, complete, prevent non-owner, release, filtered list)  -  2026-04-06

Phase D  -  RevDev Studio integration (agent):
- [x] Tauri invoke → Unix socket bridge (Studio ↔ Harness daemon)  -  15 typed wrappers + mock data fallback  -  2026-04-06
- [x] Tauri event-driven state updates  -  Rust watcher (`harness_watcher.rs`) polls daemon 2s, emits Tauri events on change; `use-harness.ts` subscribes via `listen()`  -  2026-04-06
- [x] Message compose/inbox UI in AgentPanel  -  MessageInbox.tsx with compose, threading, unread badges  -  2026-04-06
- [x] Task board with claim/complete/release  -  TaskBoard.tsx with kanban columns + create form  -  2026-04-06
- [x] File reservation visualization (who owns what)  -  FileReservations.tsx with TTL countdown + expiry highlighting  -  2026-04-06

Phase E  -  Remote access gateway (agent + owner):
- [x] HTTP gateway on harness daemon (`http-gateway.ts`)  -  JSON-RPC proxy + static file serving  -  2026-04-06
- [x] RPC server `dispatchHttp()` method for HTTP delegation without socket simulation  -  2026-04-06
- [x] Coordinator + CLI integration (`--http-port`, `--http-host`, `--http-static` flags)  -  2026-04-06
- [x] Auth: 6-digit pairing code → bearer session token exchange  -  2026-04-06
- [x] invoke.ts three-tier routing: Tauri IPC → HTTP RPC (if daemon URL) → mock data  -  2026-04-06
- [x] RevDev Studio mobile-responsive layout  -  drawer sidebar, stacked panels, scrollable tabs  -  2026-04-06
- [x] Remote agent spawn/stop commands (route spawner through HTTP gateway)  -  2026-04-07
- [x] Remote inference management (route inference commands through HTTP gateway)  -  2026-04-07

**Exit criteria:** Two or more Claude Code agents coordinate work via the RevDev Harness daemon without human relay. Messages injected automatically into agent context. RevDev Studio shows live agent status and supports message compose. File conflicts detected and surfaced before they cause git merge issues.

#### 5.16 RevMarket  -  Autonomous Agent Marketplace

**Goal:** Build RevMarket  -  a marketplace where agents do work FOR users autonomously, complementing RevDev where agents work WITH developers collaboratively.

**Distinction:**
- **RevDev** = collaborative (agents as co-developers, real-time coordination, developer audience)
- **RevMarket** = autonomous (agents as service providers, task-based, everyone audience)

**Why:** Two distinct user pain points require two distinct products. RevDev serves developers who want AI teammates. RevMarket serves anyone who wants to hire an AI to complete a task  -  no coding required.

**Existing infrastructure (built, needs marketplace layer):**

| Component | Location | What it provides |
|-----------|----------|-----------------|
| MCP Marketplace | Phase 5.5 (`packages/mcp`) | Agent/tool discovery, tenant scoping |
| A2A Discovery | `apps/studio/src/lib/a2a-api.ts` | Cloud agent cards with skills/capabilities |
| Agent Task Metering | Phase 5.1 (Stripe Billing Meter) | Per-task usage billing |
| x402 Payments | Phase 5.2 (RevealCoin) | Per-task crypto payment |
| SpawnerPanel | `apps/studio/src/components/agent/` | Agent spawn with backend/model/prompt |
| Harness Adapters | `packages/harnesses/src/adapters/` | Multi-tool agent adapters (stubs) |

Phase A  -  Marketplace foundation (agent):
- [x] Agent listing schema (Drizzle): `marketplace_agents`, `agent_skills`, `agent_reviews`, `task_submissions`  -  4 tables, relations, migration SQL  -  2026-04-07
- [x] Agent card publishing API: POST/PATCH/DELETE /api/revmarket/agents, POST /agents/:id/skills  -  2026-04-07
- [x] Task submission API: POST /api/revmarket/tasks (auto-match by skill + rating), GET /tasks/:id, POST /tasks/:id/cancel  -  2026-04-07
- [x] Result delivery: structured output, artifacts, verification (schema supports output, artifacts, executionMeta)  -  2026-04-07
- [x] Billing integration: costUsdc set on agent match, paymentMethod field, Stripe Connect reusable from marketplace.ts  -  2026-04-07

Phase B  -  Agent execution runtime (agent):
- [x] Sandboxed execution environment (process isolation, resource limits)  -  AbortController timeout, configurable ExecutorConfig  -  2026-04-07
- [x] Task queue with priority and retry (PGlite-backed)  -  atomic CAS claiming, priority ordering, concurrency control  -  2026-04-07
- [x] Progress reporting (streaming status updates to user)  -  executionMeta JSONB merge, GET /tasks/:id/progress  -  2026-04-07
- [x] Output validation (schema-checked results, quality gates)  -  structural type checking against skill outputSchema  -  2026-04-07
- [x] Execution audit trail (who ran what, when, cost, result)  -  append-only audit_log entries per task lifecycle  -  2026-04-07

Phase C  -  Marketplace UI (agent):
- [x] Browse/search agents by skill, rating, price  -  /admin/marketplace with search, category filter, sort  -  2026-04-07
- [x] Task submission wizard (describe what you need → agent recommendations)  -  agent detail page with skill-based submission  -  2026-04-07
- [x] Task status dashboard (progress, cost, artifacts)  -  /admin/marketplace/tasks with progress polling, cancel  -  2026-04-07
- [x] Agent reviews and ratings  -  review submission + star display on agent detail  -  2026-04-07
- [x] Earnings dashboard for agent publishers  -  /admin/marketplace/earnings with per-agent breakdown  -  2026-04-07

Phase D  -  Agent publisher tools (agent):
- [x] Agent definition format (skills, pricing, resource requirements, SLA)  -  multi-step publish wizard with JSON definition  -  2026-04-07
- [x] Testing harness (validate agent against sample tasks before publishing)  -  client-side validation, schema checking  -  2026-04-07
- [x] Version management (publish new versions, rollback)  -  version field in schema, draft→published flow  -  2026-04-07
- [x] Analytics (usage, revenue, error rates)  -  /admin/marketplace/analytics with metrics table  -  2026-04-07

**Exit criteria:** Users can browse agents by skill, submit tasks, and receive results without writing code. Agent publishers can list, price, and monitor their agents. Billing works via both Stripe metering and x402 RevealCoin. Task execution is sandboxed with audit trail.

---

### Phase 6: SOC2 Type II Compliance (post-Phase 5, enterprise prerequisite)

**Goal:** Achieve SOC2 Type II certification covering the Common Criteria (Security) Trust Service Criteria. Required to close enterprise (Forge) deals.

**Gap file:** `docs/gaps/GAP-047.yml`

**Existing controls (already implemented):**
- RBAC/ABAC policy engine, session auth, bcrypt (12 rounds), brute-force protection
- CSP, CORS, HSTS, rate limiting, secure headers
- Secret scanning (Gitleaks), CodeQL, dependency auditing in CI
- GDPR compliance framework (consent, deletion, anonymization)
- Audit logging infrastructure (`AuditSystem`, enterprise-gated)

**Remaining work:**

#### 6.1 Policy & Documentation (owner: human)
- [ ] Information Security Policy (scope, roles, acceptable use)
- [ ] Incident Response Plan + documented runbook
- [ ] Quarterly access review cadence (first review documented)
- [ ] Employee security training program + completion records
- [ ] Vendor risk assessments: Neon, Supabase, Vercel, Stripe
- [ ] Change Management Policy (code review, deploy approvals, rollback)

#### 6.2 Technical Controls (owner: agent)
- [ ] Tamper-evident audit log: append-only, off-system sink (S3 or CloudWatch)  -  replaces in-memory `AuditSystem`
- [ ] Automated alerting on anomalous access (failed logins, privilege escalation, unusual API volume)
- [ ] MFA enforcement for all admin accounts (admin admin + infrastructure consoles)
- [ ] Formal asset inventory (services, data stores, third-party processors)
- [ ] Uptime monitoring + SLA tracking dashboard (Availability TSC)
- [ ] Backup restore verification procedure (quarterly restore drills)

#### 6.3 Audit Track
- [ ] Annual third-party penetration test  -  budget approved, vendor selected
- [ ] SOC2 Type I readiness assessment with auditor
- [ ] 6–12 months evidence collection period
- [ ] SOC2 Type II report issued

**Exit criteria:** SOC2 Type II report in hand, listed on revealui.com trust page.

---


---

### Phase 7: Foundry  -  Business Bundle Generator (post-Phase 5, new product)

**Origin:** Extracted from the Allevia Technology pitch kit workflow. Building the Allevia trial kit
revealed a repeatable pattern worth productizing.

**What it is:** A workflow and pipeline engine that takes a product/prototype and outputs a
structured "boardroom-ready business bundle"  -  a complete sales deliverable pack.

**Bundle contents (target):**
- Sales pitch deck / presentation
- Meeting agenda and talking points
- Contract drafts and SOW templates
- Product demo / trial kit (Docker, source, install guide)
- Supporting media (screenshots, feature walkthroughs, diagrams)
- Pricing and product information sheets

**Positioning:** "Your boardroom super pack  -  generated." For agencies, consultants, and SaaS
companies pitching to enterprise or mid-market clients.

**Seed artifact:** `~/projects/allevia-pitch-kit/`  -  the Allevia trial kit hand-assembled for
RevealUI's first Forge prospect. The workflow to build it is the proto-Foundry pipeline.

**When to start:** After Phase 5 ships and RevealUI has recurring revenue. Foundry is a separate
product, not an extension of RevealUI.

- [ ] Define Foundry product spec (target customer, bundle types, delivery formats)
- [ ] Bootstrap as new project (`~/projects/Foundry`)
- [ ] Extract Allevia kit workflow into repeatable pipeline steps
- [ ] Build template library (pitch deck, SOW, install guide, pricing sheet)
- [ ] Build bundle assembly CLI / UI

---

## Scope Freeze Policy

**Until Phase 0 is complete:**
- No new packages
- No new apps
- No new CI workflows
- No new Claude rules or coordination protocols
- No new external UI dependencies (native implementations complete)
- No architecture changes

**The only acceptable work is:**
1. Deploying what exists
2. Fixing what's broken
3. Verifying integrations
4. Writing tests for deployed features

Phase 5 items from the previous plan (native UI components, native animation library, MCP UI) are deferred indefinitely. They are optimization of code that hasn't proven its value yet.

---


## Deferred Tasks (invoke manually)

These tasks are removed from the phase schedule. Call upon them explicitly when ready.

### Extract Scripts to `packages/scripts/`

Currently `scripts/lib/` is the `@revealui/scripts` package, co-located with the automation scripts in `scripts/`. The right long-term structure is:

- **`packages/scripts/`**  -  the `@revealui/scripts` package (all shared utilities: logger, exec, paths, state, contracts, monitoring, versioning, etc.)
- **`scripts/`**  -  thin automation entry-points that import from `@revealui/scripts`

**Why deferred:** `scripts/lib/` works fine in place. The package name is already correct (`@revealui/scripts`), the root `tsconfig.json` paths point to it, and `@revealui/mcp` depends on it properly. The physical move adds no functionality  -  do it when the scripts layer needs a major overhaul or when `packages/` cleanliness becomes a friction point.

**Steps when ready:**
1. `git mv scripts/lib packages/scripts`
2. Update root `tsconfig.json` paths: `scripts/lib/*` → `packages/scripts/*`
3. Update `scripts/lib/tsconfig.json` `@revealui/core` relative paths (one extra `../` needed)
4. Update `scripts/*.ts` `@dependencies` JSDoc comments referencing old paths
5. `pnpm install` + `pnpm gate` to verify

### Credential Rotation

Rotate all credentials exposed during the Revvault plaintext migration (the old passage store held secrets in plaintext before `revault migrate` was run). Affected services: Stripe, Supabase, Neon. Also covers replacing `KEY: VALUE` format in the vault with `KEY=VALUE` so `revvault export-env` works cleanly.

**Steps:**
1. Rotate Stripe restricted key: Stripe Dashboard → API keys → create new restricted key → update `STRIPE_SECRET_KEY` in Vercel (admin + API) → delete old key
2. Rotate Supabase service role key: Supabase Dashboard → Project Settings → API → regenerate service_role key → update all Vercel env vars
3. Rotate Neon password: Neon Dashboard → Branches → main → reset role password → update `POSTGRES_URL` / `DATABASE_URL` / `DIRECT_URL` in all Vercel projects
4. Update vault entries: `revvault edit revealui/env/reveal-saas-dev-secrets` → replace `: ` with `=` in each line → switch `.envrc` to use `eval "$(revault export-env revealui/env/reveal-saas-dev-secrets)"`
5. Verify: `direnv reload` in RevealUI root → env vars load correctly

---

## §4.17: RevHolster  -  Agent Coordination System (Sessions 137-140, 2026-03-30)

**Status:** VAUGHN protocol spec complete. Holster v2 foundation operational. Implementation next.

RevHolster is the combined agent coordination system: **Holster** (workboard-based task state) + **VAUGHN** (normalization layer for heterogeneous AI coding tools). Together they manage multiple agents across all RevealUI surfaces  -  WSL, Windows, Zed, Studio desktop, and mobile.

### Protocol Stack

```
A2A:     "Here are the agents available and what they can do"
MCP:     "Here are the tools available and how to call them"
VAUGHN:  "Here is how agents coordinate to use tools safely together"
Holster: "Here is the shared state where coordination happens"
```

- **Holster** = workboard format, task claiming, file locking, session lifecycle
- **VAUGHN** = adapter interface, capability model, event normalization, config sync
- Spec: [`vaughn-protocol.md`](vaughn-protocol.md) | Workboard spec: [`holster-protocol.md`](holster-protocol.md)

### What Exists (v2 foundation)

- Shared CJS parser (`~/.claude/hooks/lib/workboard-parser.js`)  -  used by all Claude Code hooks
- TypeScript `WorkboardManager` (`@revealui/harnesses`)  -  same protocol, typed API
- Workboard v2 format with Agents/Tasks/Blocked/Done/Log sections
- Task claiming protocol: `available → claimed → done | partial`
- Hook integration: session-start registers, stop marks partial, inject shows other agents
- RPC server (JSON-RPC over Unix socket) in `@revealui/harnesses`
- Content layer (canonical definitions → tool-specific config generation)
- Session identity detection (6-tier cascade)
- Coordination rules in `.claude/rules/coordination.md`

### VAUGHN Implementation Roadmap

**Phase 2  -  VAUGHN Core:**
- [ ] Define `VaughnAdapter` interface in `@revealui/harnesses`
- [ ] Implement native `VaughnAdapter` (replaces removed vendor adapters)
- [ ] Event normalization layer (tool events → VAUGHN events)
- [ ] Capability-aware task dispatch in coordinator
- [ ] Config normalization (JSON ↔ TOML ↔ Markdown)
- [ ] VAUGHN identity cascade (7-tier, extending Holster's 6-tier)

**Phase 3  -  Interop:**
- [ ] MCP tool reservation (prevent concurrent conflicting calls)
- [ ] A2A agent card generation with VAUGHN capabilities
- [ ] HTTP transport for Studio desktop
- [ ] Cross-tool config sync (Claude ↔ Codex bidirectional)

**Phase 4  -  Advanced:**
- [ ] Session persistence bridge (shared memory across tools)
- [ ] Sandbox policy abstraction
- [ ] Mobile/remote workboard access via HTTP transport

### Enforcement (deferred)

- [ ] Prevent agents from creating plan files outside MASTER_PLAN
- [ ] Prevent agents from creating workboards outside the canonical location
- [ ] Holster CLI: `revealui holster status`, `revealui holster claim <task>`, `revealui holster handoff`
- [ ] Integration with GitHub Issues/PRs (optional  -  `gh` column in workboard)

---

## Review Schedule

- **Weekly:** Check Phase 0 progress, update checkboxes
- **At each phase gate:** Review exit criteria before proceeding
- **Never:** Add items to a phase that isn't current without updating this document first
