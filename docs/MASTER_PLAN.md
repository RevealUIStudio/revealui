# RevealUI Master Plan

> **AGENTS:** This is the PUBLIC snapshot. The canonical, up-to-date version lives in the internal planning hub.
> Always read and update the internal version. This file is synced periodically.

**Last Updated:** 2026-03-30 (Refactored  -  split into MASTER_PLAN + ARCHITECTURE + archive)
**Status:** Public snapshot  -  canonical version in revealui-jv
**Owner:** RevealUI Studio

> This document supersedes all previous roadmaps, action plans, and status docs.
> Architecture reference material → [`ARCHITECTURE.md`](ARCHITECTURE.md)
> Completed phase history → [`archive/completed-phases.md`](archive/completed-phases.md)
> Superseded documents → `docs/archive/`

---

## Current Reality (as of 2026-04-15)

### What Exists

- **Codebase:** ~270,000 lines of TypeScript/Rust/Go across apps + packages
- **History:** 2,410+ commits (Dec 30, 2025 – Apr 2026), solo developer
- **Apps:** 5 (api, admin, docs, marketing, revealcoin)
- **Packages:** 26 packages + 5 apps = 31 workspaces
- **Tests:** extensive test suite across unit, integration, and E2E layers; all workspaces build and typecheck (run `pnpm test` for current count)
- **Database:** 86 tables (Drizzle ORM, dual NeonDB + Supabase), 61 CHECK constraints enforced (migration 0001 applied 2026-04-15)
- **UI Components:** 57 native components (Tailwind v4, zero external UI deps)
- **CI:** GitHub Actions (ci.yml with E2E smoke, release.yml, release-pro.yml, security.yml, system-tune-snapshot.yml), 3-phase CI gate + E2E + CodeQL + Gitleaks
- **Infrastructure:** Nix flakes, direnv, Biome 2 (sole linter), Turborepo, pnpm 10
- **Security:** 7 audit rounds complete. 0 CodeQL alerts, 0 Dependabot alerts, 0 avoidable `any` types, 0 production console statements. AES-256-GCM encryption, bcrypt passwords, RBAC+ABAC, timing-safe TOTP. AST-based code-pattern analyzer (execSync injection, TOCTOU, ReDoS). Pre-push gate runs affected tests on protected branches. SOC2 audit track documented with pentest RFP template.

### What Works

| Feature | Status | Confidence |
|---------|--------|------------|
| admin engine (core) | Built | High  -  237 files, deep implementation |
| AI agent system | Built | Medium  -  untested in production |
| UI components (57) | Built | High  -  native hooks, no external deps |
| Database schema (86 tables) | Built | High  -  migration 0001 applied, 61 CHECK constraints enforced |
| Auth (sessions, rate limiting) | Built | Medium  -  code exists, no production verification |
| Stripe integration | Built | Medium  -  DB-backed circuit breaker (circuit_breaker_state table) |
| Lexical rich text | Built | Medium  -  recently integrated |
| REST API (Hono) | Built | Medium  -  routes exist, no production traffic |
| ElectricSQL sync | **Verified** | **High  -  proxy + auth + shapes working in production (Railway → NeonDB, Supabase CLI linked, Vercel env wired)** |

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

**Completed sub-phases:** 3.1 Documentation (deployed), 3.2 OSS Prep (26 packages published), 3.3 Marketing (landing page live), 3.4 Pro Tier (packages on npm), 3.5 Production Hardening (6 rounds  -  including CodeQL + regex refactor 2026-03-31), 3.6 AI Features (web search, memory consent, MCP hypervisor), 3.7 Business Operations (blog, outreach, external validation), 3.8 Pre-Public Audit, 3.9 Gap Closure, 3.10 Launch Operations (repo public 2026-03-25).

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
- [x] Migration 0001 applied to production NeonDB (2026-04-15)  -  49 CHECK constraints added, audit_log.severity data fixed (618 rows)
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
- [x] Validate: agent-simulated navigation across all 26 packages  -  25/25 PASS (minor friction notes: db/ai/mcp subpath depth, dev unscoped naming) ✅ 2026-03-31

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
- [x] Benchmark PGlite in-memory table performance vs Map for hot-path caches  -  Map ~0.002ms, PGlite ~0.4ms; Map for hot-path, PGlite for durable  -  2026-04-12
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

Phase E  -  Client-side offline cache (agent): ✅ COMPLETE (2026-04-12)
- [x] PGlite in browser for offline-first content access  -  useOfflineCache upgraded from localStorage to PGlite (with localStorage fallback)  -  2026-04-12
- [x] ElectricSQL shape subscriptions for live sync  -  useShapeCacheInvalidation hook bridges shape changes to CacheInvalidationChannel  -  2026-04-12
- [x] Service Worker cache strategy (network-first for API, cache-first for assets)  -  implemented in PR #280  -  2026-04-12
- [x] Conflict resolution for offline edits  -  version-based detection, coalescing, last-write-wins/server-wins/manual strategies  -  2026-04-12

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

#### 5.17 Hardware-Aware Auto-Config (cross-platform, Suite-wide)

**Origin:** 2026-04-13. WSL repeatedly crashed on a 7.3 GB host because default `.wslconfig` let the VM claim ~6 GB, starving Windows. The fix (memory=4GB, vmIdleTimeout=-1, autoMemoryReclaim off, tuned earlyoom, docker off-by-default) was hand-authored from a crash post-mortem. No new user should have to debug that.

**What it is:** A Suite-wide abstraction that, on first install **and** on demand, scans the host's hardware + platform and applies a tuned, safe-by-default dev configuration. Invoked by the Studio first-run wizard, by the CLI (`revealui system tune`), and by Forge during self-hosted provisioning.

**Detect:**
- OS / distro / kernel, architecture (x64 / arm64), platform class (native Linux, macOS, Windows, WSL2, Docker, cloud VM)
- Total RAM, free RAM, CPU core count (physical + logical), swap size, disk size + free space, GPU vendor + VRAM (optional)
- Existing configs already present (`.wslconfig`, `earlyoom`, Docker autostart, `NODE_OPTIONS`, `PNPM_*`, `TURBO_*`, tmux, shell rc files)
- Known-bad combinations (e.g. WSL memory ≥ 80% of host RAM, `autoMemoryReclaim=dropcache` on host-pressure systems, Docker autostart on <8 GB host)

**Tune:**
- **WSL:** `.wslconfig` memory/processors/swap/vmIdleTimeout, networkingMode, kernelCommandLine
- **Linux host:** `earlyoom` thresholds + `--prefer` list (dev-tool-aware: turbo, biome, vitest, tsc, esbuild), `vm.swappiness`
- **Container runtimes:** docker + containerd autostart policy (off-by-default on low-RAM hosts; on-demand via `sudo systemctl start docker`)
- **Node/pnpm/turbo:** `NODE_OPTIONS=--max-old-space-size`, pnpm `child-concurrency`, turbo `--concurrency`, Vitest `poolOptions.threads.maxThreads`
- **macOS:** file descriptor limits (`launchctl limit maxfiles`), Spotlight exclusions for repo paths
- **Windows native:** Defender exclusions for repo paths, long-path support

**Surface:**
- Studio first-run wizard screen: "Tune this machine for RevealUI?" → diff preview → confirm → apply
- CLI: `revealui system scan` (read-only report), `revealui system tune` (apply with `--dry-run` / `--plan` / `--yes`), `revealui system revert` (restore from timestamped backup)
- JSON output (`--json`) for agents and for Forge provisioning

**Safety:**
- Always write a timestamped backup of every file we mutate under `~/.revealui/system-tune/backups/<ts>/`
- Dry-run default when a config already exists; require `--force` to overwrite user-authored values
- Never touch shared system services the user didn't opt into; gate privileged changes (e.g. `/etc/default/earlyoom`, `.wslconfig`) behind explicit confirmation
- Every applied profile carries a version + hostname + hardware-hash header, so reruns know whether they'd be a no-op
- Ship a machine-readable post-mortem log (`~/.revealui/system-tune/history.jsonl`) so agents can diagnose regressions

**Deliverables (code):**
- New package `@revealui/system-tune` (or inside `@revealui/setup`) — pure detection + plan generation, no I/O
- Platform adapters: `adapters/wsl.ts`, `adapters/linux.ts`, `adapters/macos.ts`, `adapters/windows.ts`
- CLI surface in `@revealui/cli`: `system scan` / `system tune` / `system revert`
- Studio wizard integration (Tauri): first-run screen + settings-panel entry
- Forge integration: invoked by self-hosted install script before app boot
- Tests: snapshot-based detection fixtures (mocked `/proc/meminfo`, `systemctl`, `.wslconfig`, macOS `sysctl`, Windows WMI) + plan-generation unit tests + dry-run integration tests on real WSL / macOS / Linux runners in CI

**Deliverables (docs):**
- `docs/system-tune/PROFILES.md` — the canonical tuning matrix (host RAM bucket × platform → applied values), with rationale for each value
- `docs/system-tune/CRASH-POSTMORTEMS.md` — seed entries: WSL 7.3 GB host crash (2026-04-13), host-pressure autoMemoryReclaim, idle-pause clock skew

**When to start:** After Phase 5 ships. Seed profile = the exact 2026-04-13 WSL fix, captured as the "low-RAM WSL2" preset — so the first working baseline is the author's own machine.

- [x] Extract current WSL fix into a declarative profile (`profiles/wsl-low-ram.json`) (2026-04-15)
- [x] Build detection layer + platform adapters (2026-04-15)
- [x] Build plan generator (pure function: detected state → desired state → diff) (2026-04-15)
- [x] Build CLI (`revealui system scan` / `tune` / `revert`) with dry-run default (2026-04-15)
- [ ] Wire into Studio first-run wizard
- [ ] Wire into Forge self-hosted install script
- [x] CI: run `revealui system scan --json` on Ubuntu / macOS / Windows runners and snapshot the detection output (2026-04-15, PR #338)
- [x] Crash-postmortem doc seeded with the 2026-04-13 incident (2026-04-15)

**Exit criteria:** A user running `curl | sh` on a brand-new machine — Windows + WSL, bare Linux, macOS M-series, or low-RAM laptop — reaches a working RevealUI dev environment without hand-editing any system config file, and the setup is reproducible + reversible.

---

#### 5.18 Universal Sanitization (Suite-wide, lives in `@revealui/security`)

**Goal:** One audited, reusable sanitization surface for every untrusted-string sink across the Suite — terminal banners, HTML rendering, shell-argument construction, SQL identifier interpolation, log redaction, URL normalisation. No per-app one-offs. No re-implementations.

**Why:** Control-sequence injection is the same class of bug in every language and every sink. Founder's direction: "a perfected sanitization process that we can apply everywhere it is useful" for "any data type implementation that could potentially be an attack surface." Today the studio's `TerminalView.welcome` is the first caller (shipped in revdev PR #4). Tomorrow it's admin rich-text render, api request logging, forge install scripts, and beyond.

**Home:** `@revealui/security` (existing package). Adding a standalone `@revealui/sanitize` was considered and rejected — sanitization *is* security infrastructure and belongs co-located with headers, auth, encryption, audit, and GDPR. One package, one audit scope, one publish pipeline. Cross-repo consumers (revdev, forge, revcoin) pull it in as the published npm dep — **never** via git submodule.

**Design principles:**
- **Sink-specific helpers**, not one god-function. `sanitizeTerminalLine`, `sanitizeHtml`, `escapeShellArg`, `escapeSqlIdentifier`, `redactLogField`, `sanitizeUrl` — each with a threat model scoped to its sink.
- **Sanitize at the sink**, not at ingress. Threat model is concrete at the output; premature sanitization loses fidelity and still leaves other sinks exposed.
- **Allow-list over deny-list.** Every helper starts strict (e.g. SGR-only for terminal, tag-whitelist for HTML) and loosens only when a concrete need appears.
- **Behavioural tests matter more than the regex.** Every helper ships with a corpus of attack strings from the real-world bug class it prevents.

**Deliverables:**
- [x] `sanitizeTerminalLine` — SGR-only ANSI pass-through (shipped in `@revealui/security` 2026-04-13)
- [x] `sanitizeHtml` — tag + attr allow-list for Lexical render / admin-facing markdown (2026-04-13). Backed by parse5 WHATWG tokenizer; baseline allow-list covers rich-text tags (p/h1–h6/ul/ol/li/table/a/img/strong/em/code/pre/blockquote/etc.), global attrs (class/id/title/lang/dir/aria-*/data-*), URL attrs filtered through `isSafeUrl`, `target=_blank` auto-hardened with `rel="noopener noreferrer"`. Dangerous containers (script/style/iframe/object/embed/form/svg/math/template/noscript/base/noembed/etc.) are dropped with contents; unknown tags are unwrapped. Every `on*`, `style`, `srcdoc`, and namespaced (`xlink:…`) attr categorically stripped. 28-vector XSS corpus + 13 safe vectors in `sanitize-corpus/html-injection.ts`.
- [x] `escapeShellArg` — POSIX + cmd.exe + PowerShell variants, NUL-byte rejection, corpus-backed tests (2026-04-13)
- [x] `escapeSqlIdentifier` — for the rare dynamic-identifier path Drizzle can't cover (2026-04-13). Emits `"..."` with `"` doubled per SQL spec. Throws on empty string, NUL byte, or >63 bytes (Postgres NAMEDATALEN-1 — silent-truncation footgun). 14-vector injection corpus + 12-entry safe corpus. Existing `escapeIdentifier` in `packages/core/src/collections/operations/sqlAdapter.ts` predates this helper (doubles quotes only, caller must wrap separately) — migration is a follow-up, low urgency since its callers combine it correctly with `"${...}"` wrapping today.
- [x] `redactLogField` — PII + secret redaction helper feeding `@revealui/utils` logger (2026-04-13). Ships primitive + `redactLogContext` recursive walker + `redactSecretsInString` for inline message scrubbing. Key match is case-insensitive on alnum-normalised form (covers `api_key`, `X-API-Key`, `userApiKey`). Value patterns cover JWT, Bearer, Stripe sk/rk/whsec, OpenAI sk-, AWS AKIA, GitHub ghp_/github_pat_. Depth-capped at 8. Legacy duplicates at `packages/core/src/observability/logger.ts:sanitizeLogData` and `packages/ai/src/llm/client.ts:redactSensitiveFields` removed 2026-04-13 (major bump on core + ai via `.changeset/remove-legacy-redactors.md`); docs (`LOGGING.md`, `STANDARDS.md`) point at `redactLogContext` from `@revealui/security`.
- [x] `sanitizeUrl` / `isSafeUrl` — scheme allow-list, owned by `@revealui/security`; `packages/core/.../rsc.tsx` now re-exports from there as the single source of truth (2026-04-13)
- [x] Shared test corpus scaffolded: `packages/security/src/__tests__/sanitize-corpus/` seeded with ANSI, scheme-confusion, shell-injection, log-redaction vectors; grows per new sink (2026-04-13)
- [x] CI security gate check: `sanitizer-usage-analyzer.ts` flags ad-hoc sanitize/escape/redact functions, ANSI stripping, HTML tag stripping, innerHTML, and dangerouslySetInnerHTML outside `@revealui/security` (2026-04-15)

**Cross-repo consumption:**
- revdev (studio terminal) migrates its local `apps/studio/src/lib/terminal-sanitize.ts` to `@revealui/security` once a version with `sanitizeTerminalLine` is published to npm. Local module stays as a thin re-export during the transition, then deletes.
- forge install scripts depend on `@revealui/security` for `escapeShellArg`.
- No `.gitmodules`. No filesystem symlinks across repos. Only published-dep consumption.

**Exit criteria:** Every untrusted-string sink in the Suite (studio banners, admin HTML render, api log output, forge shell builder, revcoin UI) goes through a named `@revealui/security` sanitizer. CI enforces no ad-hoc per-app sanitizers. Attack corpus grows with every new sink added.

---

#### 5.19 Suite-Wide Submodule Audit (one-off + recurring CI check)

**Goal:** Confirm zero git submodules exist across any Suite repo, and add a CI guard that fails any PR introducing one.

**Why:** Founder has a permanent "no git submodules, ever" policy (cross-repo deps publish to npm / workspace). An exhaustive sweep catches anything that may have been created accidentally by tooling, a template, or an imported project. Guard prevents future drift.

**Scope of the sweep:** every repo under `~/suite/` and every in-active repo under `~/projects/`, plus `RevealUIStudio/*` on GitHub — not just root `.gitmodules`, but also stale `.git/modules/` directories, `git config --list | grep submodule`, and tree-object gitlinks (mode 160000) from past history.

**Deliverables:**
- [x] Initial sweep completed 2026-04-13 — no `.gitmodules` found anywhere in `~/suite/`
- [x] Scripted audit: `scripts/audit-no-submodules.sh` — runs the four checks (root file, `.git/modules/`, `git config`, tree gitlinks) and exits non-zero on any hit (2026-04-15)
- [x] GitHub Actions workflow `no-submodules.yml` — runs on every PR + push to main/test + weekly Sunday 6 AM UTC cron (2026-04-15)
- [x] Policy + remediation doc: `docs/submodules/POLICY.md` — no submodules rule, CI enforcement, conversion runbook (2026-04-15)
- [x] Remediation runbook: rolled into `docs/submodules/POLICY.md` — convert to published dep or vendor with provenance (2026-04-15)

**Exit criteria:** CI blocks any `.gitmodules` addition org-wide; weekly cron proves zero drift; a new contributor can't accidentally add one without the PR failing.

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

#### 6.1 Policy & Documentation (owner: human) ✅ COMPLETE (2026-04-12)
- [x] Information Security Policy (scope, roles, acceptable use) - 2026-04-12 (docs/security/INFORMATION_SECURITY_POLICY.md)
- [x] Incident Response Plan + documented runbook - 2026-04-12 (docs/security/INCIDENT_RESPONSE.md, 6 runbooks)
- [x] Quarterly access review cadence (first review documented) - 2026-04-12 (docs/security/ACCESS_REVIEW_POLICY.md)
- [x] Employee security training program + completion records - 2026-04-12 (docs/security/SECURITY_TRAINING.md)
- [x] Vendor risk assessments: Neon, Supabase, Vercel, Stripe, GitHub - 2026-04-12 (docs/security/VENDOR_RISK_ASSESSMENTS.md)
- [x] Change Management Policy (code review, deploy approvals, rollback) - 2026-04-12 (docs/security/CHANGE_MANAGEMENT_POLICY.md)

#### 6.2 Technical Controls (owner: agent) ✅ COMPLETE (2026-04-12)
- [x] Tamper-evident audit log: HMAC-SHA256 hash-chain signing in PostgresAuditStorage, previousSignature column for tamper-evident sequencing  -  2026-04-12
- [x] Automated alerting on anomalous access: SecurityAlertService with threshold rules (failed logins, privilege escalation, mass export, MFA disable, account lockout), pluggable handlers (log, audit, webhook/SIEM)  -  pre-existing
- [x] MFA enforcement for all admin accounts: requireMfa() middleware with role-based and operation-based enforcement, MFA_REQUIRED / MFA_VERIFY_REQUIRED error codes  -  pre-existing
- [x] Formal asset inventory: docs/security/ASSET_INVENTORY.md (services, data stores, third-party processors, security tooling, data flow)  -  2026-04-12
- [x] Uptime monitoring + SLA tracking: uptime-check cron in dispatch, health results logged to audit trail for SLA calculation  -  2026-04-12
- [x] Backup restore verification procedure: docs/security/BACKUP_VERIFICATION.md (quarterly drill procedure, RTO/RPO targets, drill record template)  -  2026-04-12

#### 6.3 Audit Track
- [ ] Annual third-party penetration test  -  budget approved, vendor selected
- [ ] SOC2 Type I readiness assessment with auditor
- [ ] 6–12 months evidence collection period
- [ ] SOC2 Type II report issued

**Exit criteria:** SOC2 Type II report in hand, listed on revealui.com trust page.

---


---

### Phase 7: Crucible  -  Business Bundle Generator (post-Phase 5, new product)

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
RevealUI's first Forge prospect. The workflow to build it is the proto-Crucible pipeline.

**When to start:** After Phase 5 ships and RevealUI has recurring revenue. Crucible is a separate
product, not an extension of RevealUI.

- [ ] Define Crucible product spec (target customer, bundle types, delivery formats)
- [ ] Bootstrap as new project (`~/suite/crucible`)
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

**Phase 2  -  VAUGHN Core (complete):**
- [x] Define `VaughnAdapter` interface in `@revealui/harnesses`
- [x] Implement native `VaughnAdapter` (replaces removed vendor adapters)
- [x] Event normalization layer (tool events → VAUGHN events)
- [x] Capability-aware task dispatch in coordinator
- [x] Config normalization (JSON ↔ TOML ↔ Markdown)
- [x] VAUGHN identity cascade (7-tier, extending Holster's 6-tier)

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

## §4.18: Legacy and Deprecation Sweep (Phase A complete)

**Initial sweep results (2026-04-15):**
- Removed 6 deprecated exports with zero callers: `registerSession`/`unregisterSession` aliases, `WorkboardSession`/`WorkboardEntry` types, `deepMergeSimple`, `findAgentMemoryById`/`findAgentMemoriesByUserId`
- Removed `@lhci/cli` from root devDependencies (no script or CI consumer)
- Removed `postgres` from pnpm catalog (never declared as workspace dep — repo uses `pg`)
- Identified 20+ additional dead exports across auth audit-bridge, OAuth, cache CDN, resilience patterns, MCP launchers — flagged for follow-up; not removed because some are part of public package API and would require major version bumps

**Follow-up sweep results (2026-04-16, PR #343):**
- Removed 3 more zero-caller `@deprecated` exports: `apps/admin/src/types/index.ts` (barrel re-export of admin types), `packages/ai/src/memory/utils/deep-clone.ts` (re-export of `@revealui/core/utils/deep-clone`), `packages/db/src/pool.ts` `pool` Proxy + `export default pool`
- Internal callers migrated to the canonical import path; obsolete duplicate tests deleted
- 6 `@deprecated` markers remain: 2 are string literals in analyzer error messages (not real deprecations); 1 is `packages/security/src/auth.ts` `PasswordHasher` (PBKDF2) which is a public API removal deserving its own PR with changeset + migration notes to `@revealui/auth` (bcrypt)


**Goal:** Zero legacy or deprecated code paths in the codebase. Every public API surface ships only current implementations. When a pattern changes, ship a codemod so users can migrate automatically.

**Principle:** Users should never encounter deprecated APIs, backwards-compat shims, or dead code paths. If we change a public interface, we provide a codemod (via `@revealui/cli` or a standalone jscodeshift transform) that rewrites their code to the new pattern. No "legacy" mode, no "compat" wrappers, no soft deprecation.

### Phase A: Exhaustive Codebase Audit (complete 2026-04-27)

- [x] Automated scan for deprecated markers: `@deprecated` JSDoc, `legacy` in identifiers/filenames, `compat` shims, re-exports of removed APIs, `_old`/`_v1`/`_prev` suffixes
- [x] Audit all barrel exports (`index.ts`) for re-exported symbols that no longer have a primary consumer
- [x] Audit CLI for duplicate/alias commands (e.g. `shell` alias for `dev shell`) and decide: remove or keep with clear redirect messaging
- [x] Audit config formats for backwards-compat fields that can be dropped
- [x] Audit hook scripts for patterns that pre-date the current architecture
- [x] Audit test files for mocks of removed or renamed interfaces
- [x] Document every finding in a tracking issue with file paths and recommended action (remove, codemod, or consolidate) — see `~/suite/.jv/docs/audits/legacy-sweep-2026-04-27.md` (62 findings, 6 categories, 17 actionable in Tier 1)

### Phase B: Codemod Infrastructure

- [ ] Add `revealui migrate` CLI command that runs codemods against a user's project
- [ ] Scaffold codemod runner: discover available transforms, detect applicable version range, apply in order, report results
- [ ] Establish codemod authoring pattern: each transform is a standalone file in `packages/cli/src/codemods/` with a `name`, `fromVersion`, `toVersion`, and `transform(source, api)` function
- [ ] Add `revealui migrate --dry-run` to preview changes without writing
- [ ] Add `revealui migrate --list` to show available codemods for the user's current version

### Phase C: Execute

- [ ] Write codemods for every breaking change identified in Phase A
- [ ] Remove all legacy code paths, compat wrappers, and deprecated re-exports
- [ ] Update CHANGELOG entries to reference the codemod that handles the migration
- [ ] Validate: run codemods against the `create-revealui` templates to ensure clean output
- [ ] Validate: `pnpm gate` passes with zero legacy references

---

## §4.19: Messaging, Guides, and Documentation Accuracy (Pending)

**Goal:** Every user-facing message, guide, and doc page reflects the current codebase. Users should never hit a stale instruction, a misleading error message, or a guide that references code that no longer exists.

**Principle:** Messaging is part of the product. CLI output, error messages, onboarding flows, and docs are all code that must stay in sync with the implementation. When the code changes, the words change in the same PR.

### Phase A: Messaging Audit

- [ ] Audit all CLI command output: help text, success messages, error messages, warnings, info logs. Flag anything that references removed features, wrong paths, or unclear next steps
- [ ] Audit all error messages across packages for clarity: does the user know what went wrong, why, and what to do next?
- [ ] Audit onboarding flow (`revealui create` + `revealui dev up` + `revealui doctor`): walk through as a new user and document every point of confusion or missing context
- [ ] Audit `.env.local` template comments generated by `revealui create`: do they accurately describe each variable and where to get the value?
- [ ] Audit README.md files across all 26 packages: do they reflect current exports, usage patterns, and dependencies?
- [ ] Audit docs/ site content against actual API surfaces: flag any code samples that reference removed or renamed functions

### Phase B: User Flow Documentation

- [ ] Write end-to-end guides for each primary user flow:
  - New project setup (`npm create revealui` through first deploy)
  - Local development (`revealui dev up` through running tests)
  - Database management (`revealui db init` through production migrations)
  - Publishing a package (changesets through npm publish)
  - Adding AI features (Pro license through agent configuration)
- [ ] Add contextual help to CLI commands: `revealui <command> --help` should include a "Learn more" link to the relevant guide
- [ ] Add `revealui docs` command that opens the docs site or prints the quick-start locally
- [ ] Ensure every package README has a "Quick Start" section with a working code sample that can be copy-pasted

### Phase C: Automated Drift Detection

- [x] **Claim/count drift detector** ✅ 2026-04-15 — `scripts/validate/claim-drift.ts` (`pnpm validate:claims`). Counts real packages/apps/workspaces/tests/UI components/MCP servers and fails if docs, marketing, or READMEs claim a different number. First run found 35 mismatches across docs/marketing — all corrected.
- [x] **Docs import drift detector** ✅ 2026-04-16 — `scripts/validate/docs-import-drift.ts` (`pnpm validate:docs-imports`). Extracts every `ts`/`tsx`/`typescript` code fence in `docs/`, parses `@revealui/*` imports, and checks each named import against the package's built `.d.ts` exports. Ships in the CI gate as **warn-only** — initial scan found ~225 stale imports, will flip to hard-fail once the backlog is drained. Doesn't do full tsc-style typechecking; focuses on the drift class that matters (removed/renamed public API names).
- [ ] Add a CI check that verifies CLI `--help` output matches the documented command reference
- [ ] Add a pre-commit rule: if a public export is renamed or removed, require a corresponding docs/ change in the same commit
- [ ] Track messaging coverage: percentage of error paths that have user-friendly messages vs raw throws

---

## Review Schedule

- **Weekly:** Check Phase 0 progress, update checkboxes
- **At each phase gate:** Review exit criteria before proceeding
- **Never:** Add items to a phase that isn't current without updating this document first
