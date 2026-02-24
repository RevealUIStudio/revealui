# RevealUI Master Plan

**Last Updated:** 2026-02-23
**Status:** Active — Single source of truth for all planning
**Owner:** Joshua Vaughn (founder@revealui.com)

> This document supersedes all previous roadmaps, action plans, and status docs.
> Superseded documents have been moved to `docs/archive/`.
> All Claude sessions must reference this document for priorities and sequencing.

---

## Current Reality (as of 2026-02-20)

### What Exists

- **Codebase:** ~320,000 lines of TypeScript across ~1,786 files
- **History:** 648+ commits over 7 weeks (Dec 30, 2025 - Feb 20, 2026)
- **Apps:** 6 (cms, api, web, dashboard, docs, landing)
- **Packages:** 17 (@revealui/core, ai, presentation, contracts, db, auth, services, cli, config, sync, editors, mcp, router, setup, dev, test, utils)
- **Tests:** 307+ test files, all packages build and typecheck (23/23 = 6 apps + 17 packages)
- **CI:** 15 GitHub Actions workflows, 3-phase CI gate
- **Infrastructure:** Nix flakes, direnv, Biome 2, Turborepo, pnpm 10

### What Works

| Feature | Status | Confidence |
|---------|--------|------------|
| CMS engine (core) | Built | High — 237 files, deep implementation |
| AI agent system | Built | Medium — untested in production |
| UI components (53) | Built | High — native hooks, no external deps |
| Database schema (25 tables) | Built | Medium — migrations exist, never run against production |
| Auth (sessions, rate limiting) | Built | Medium — code exists, no production verification |
| Stripe integration | Built | Low — circuit breaker tested in unit tests only |
| Lexical rich text | Built | Medium — recently integrated |
| REST API (Hono) | Built | Medium — routes exist, no production traffic |
| ElectricSQL sync | Built | **Low — API assumptions unverified** |

### What Doesn't Exist

- Zero deployed environments (no staging, no production)
- Zero real users
- Zero verified external integrations (ElectricSQL, Stripe live, email delivery)
- No `create-revealui` CLI published to npm
- No documentation site deployed
- No landing page deployed
- No waitlist connected to a real database in production

### Honest Grade: C+ (6.5/10)

The architecture is sound. The code quantity is impressive. But nothing has been proven against real traffic, real databases, or real users. The gap between "it builds" and "it works in production" is where most projects fail.

---

## Business Context

**Model:** Open Core (MIT core + paid Pro/Enterprise tiers)
**Target Market:** TypeScript-first agencies, SaaS builders, enterprise teams
**Revenue:** SaaS subscriptions (Pro $49/mo, Enterprise $299/mo)
**Planned Launch:** OSS core Q3 2026, Pro tier Q4 2026

See `business/BUSINESS_PLAN.md` for full business plan (not superseded — separate concern).

---

## Phased Plan

### Phase 0: Prove It Works (CURRENT — Weeks 1-3)

**Goal:** Deploy something real. Verify core integrations. Get first user.

**Why this is first:** ~320,000 lines of code mean nothing if the product doesn't work when deployed. Every minute spent adding features before verifying the foundation is a gamble.

#### 0.1 Deploy Landing Page (COMPLETE - 2026-02-22)
- [x] Deploy apps/marketing to Vercel (live at https://revealui-landing.vercel.app)
- [x] Fix waitlist route: add `runtime = 'nodejs'` (was defaulting to Edge Runtime, would break DB calls)
- [x] Fix health route: add `runtime = 'nodejs'`
- [x] Fix vercel.json: removed invalid `functions.runtime` field, added `cd ../.. && pnpm install` for monorepo catalogs
- [x] Fix waitlist rate limiting: replaced in-memory Map (cold-start reset) with DB-backed COUNT query
- [x] Update `.env.example` with all required vars (was missing REVEALUI_SECRET, SERVER_URL, etc.)
- [x] Connect waitlist to NeonDB (31 tables confirmed, waitlist schema verified, pgvector enabled)
- [x] Set POSTGRES_URL in Vercel (fixed: was stored with trailing newline, re-set correctly)
- [x] Set REVEALUI_SECRET in Vercel (32-byte hex, config validation passing)
- [x] Set NEXT_PUBLIC_SERVER_URL and REVEALUI_PUBLIC_SERVER_URL in Vercel
- [x] Deploy apps/marketing to Vercel and smoke-test waitlist signup
- [x] Verify email capture works end-to-end (POST /api/waitlist returns 201, persisted in NeonDB)
- [x] Fix `isBuildTime()` in @revealui/config (was returning true at runtime on Vercel)
- [x] Fix config schema: make Stripe/Blob vars optional (not all apps need them)

#### 0.2 Verify Database in Production
- [x] Provision NeonDB instance (ep-bitter-snow-ahixm35n, us-east-1)
- [x] Run migrations (`packages/db/migrations/`)
- [x] Verify all 31 tables created correctly (confirmed via query)
- [x] pgvector extension enabled (required for vector(1536) columns)
- [x] Test connection from Vercel serverless functions (verified via waitlist POST, 2026-02-22)
- [ ] Verify `withTransaction` error is caught properly (currently throws — intentional)

#### 0.3 Verify ElectricSQL Integration — REINSTATED (2026-02-23)
> **Decision reversal:** Reinstated to Phase 0. The proxy routes, shape hooks, and auth-gated
> `/api/shapes/*` endpoints are already written. What hasn't happened: provisioning an actual
> ElectricSQL instance and pointing the env vars at it. That is a configuration step, not a
> build step — reasonable to verify now alongside the other integrations.

**What exists (verified in code review, Session 10):**
- `apps/cms/src/app/api/shapes/` — 3 proxy routes (conversations, agent-contexts, agent-memories)
- `apps/cms/src/lib/api/electric-proxy.ts` — proxy utility with auth + row-level filtering
- `packages/sync/src/hooks/useConversations.ts` — client hook wrapping `@electric-sql/react`
- `packages/sync/src/provider/index.tsx` — placeholder `ElectricProvider` (pass-through, intentional)
- Config: `ELECTRIC_SERVICE_URL` (server) + `NEXT_PUBLIC_ELECTRIC_SERVICE_URL` (client), both optional
- Cloud auth: `ELECTRIC_SOURCE_ID` + `ELECTRIC_SECRET` (optional, for Electric Cloud)
- API format verified in `docs/architecture/ELECTRICSQL_API_VERIFICATION.md` (2026-02-01): `/v1/shape`, parameterized `where`/`params`, correct

**Deployment decision (Session 12):** Self-hosted on Railway (~$5/mo).
- Vercel cannot host Electric — requires persistent volume for replication slot state
- Railway has a one-click deploy template pre-configured with persistent volume
- NeonDB supports logical replication (must be enabled in Neon dashboard settings)
- Electric must use the **direct** (non-pooled) Neon connection string for replication
- `ELECTRIC_SOURCE_ID` / `ELECTRIC_SECRET` are Electric Cloud-only — omit for self-hosted
- `electric-proxy.ts` already handles this: only adds those params if both are set

**Remaining steps:**
- [ ] Enable logical replication on NeonDB: Neon Dashboard → Settings → Logical Replication → Enable
- [ ] Deploy Electric to Railway via one-click template (https://railway.com/deploy/electricsql-1)
  - `DATABASE_URL` = direct (non-pooled) Neon connection string
  - `ELECTRIC_SECRET` = generate random 32+ char secret
  - `ELECTRIC_STORAGE_DIR` = `/var/lib/electric/persistent` (pre-set by template)
- [ ] Copy Railway service URL → set as `ELECTRIC_SERVICE_URL` in Vercel CMS env vars
- [ ] Redeploy CMS on Vercel to pick up new env var
- [ ] Smoke test: `GET /api/shapes/conversations` on deployed CMS while logged in → expect shape stream, not 500
- [ ] Write integration test against live instance (or mark as Phase 1 if Railway is cost-blocked)
- [ ] Document result: working / broken / provisioning-blocked

#### 0.4 Verify Auth Flow
- [x] CMS auth pages built: login, signup, reset-password, billing (Session 5 — commit cb2b66d2)
- [x] CMS commit pushed to origin/main (Session 5 — 5 push attempts, fixed 5 Biome errors + 1 TS error)
- [x] Fix deploy.yml lockfile mismatch (Dependabot broke pnpm catalog references — lockfile fix pushed)
- [x] Deploy CMS to staging (Session 6 — 2026-02-22/23)
  - Fixed: output:standalone conditional, vercel.json build/install commands, CSP env-aware, PostHero TS error
  - Fixed: instrumentation.ts throw-on-error (never throw from register()), global-error.tsx invalid exports
  - Fixed: getGlobals.ts try/catch around getRevealUIInstance()
  - Root cause of 500: `output: 'standalone'` is REQUIRED for monorepo workspace packages on Vercel
  - Without standalone, Vercel's default serverless output can't resolve @revealui/* workspace packages at runtime
  - CMS live at https://revealui-joshuas-projects-c07004e7.vercel.app
  - All pages returning 200 (login, signup, reset-password, debug), API routes working (health, auth)
  - SSO deployment protection disabled for testing
- [x] Test signup → login → session → logout flow manually (Session 9 — 2026-02-23)
  - Signup: 200, session cookie set correctly, user returned with role/id
  - Session: GET /api/auth/session returns user + session with 7-day expiry
  - Me: GET /api/auth/me returns user with status field
  - Sign-out: 200, cookie cleared, subsequent session check → 401
  - Sign-in: works with existing user, new session created
  - Bugs found and fixed (commit 36526cfc):
    - AdminBar called /api/users/me (404) → fixed to /api/auth/me
    - getMeUser used wrong cookie name (revealui-token) and wrong endpoint → fixed
    - password-reset route: `logger.error is not a function` in prod bundle — partially fixed
      by changing import path; root cause (`'use client'` on logger-client.ts) fixed in Session 12
    - password_reset_tokens table missing from CMS production DB (was never migrated)
      → created table manually, added migration 0006
    - Mobile nav: action buttons (Log in, Get started) showed at all sizes → fixed with max-lg:hidden,
      buttons now render in drawer at mobile/tablet
  - CMS DB uses different NeonDB endpoint than landing — schema was pushed (not migrated);
    password_reset_tokens table was missing; fixed by direct CREATE TABLE
- [x] Verify rate limiting works — confirmed: IP-based 5/15min, brute force 5 attempts → 429
- [x] Verify brute force protection works — confirmed: locks after 2 failed attempts (email-based)
- [x] Password reset endpoint returns 200 (Session 12 — logger + rate-limit fixes deployed)
- [ ] Test password reset with real email (Resend) — endpoint works, need Resend API key

#### 0.5 Verify Stripe Integration
- [ ] Connect Stripe test mode to deployed CMS
- [ ] Test subscription creation flow
- [ ] Test webhook delivery and handling
- [ ] Verify circuit breaker behavior under real conditions

**Exit Criteria:** Landing page live with working waitlist. CMS deployed to staging with working auth and database. At least one integration (ElectricSQL or Stripe) verified or flagged as broken.

---

### Phase 1: Production Hardening (Weeks 4-6)

**Goal:** Fix everything Phase 0 revealed. Harden for real traffic.

#### 1.1 Fix Integration Issues
- [ ] Address all issues discovered in Phase 0 verification
- [ ] Replace any placeholder implementations with real ones
- [ ] Remove `ignoreBuildErrors` from CMS next.config if still present

#### 1.2 E2E Test Coverage
- [ ] Auth flow E2E (signup, login, reset, session)
- [ ] CMS content CRUD E2E
- [ ] Stripe payment flow E2E (test mode)
- [ ] Waitlist signup E2E

#### 1.3 Environment & Secrets
- [ ] Complete SOPS + age migration (plan exists at `~/.claude/plans/eventual-splashing-lollipop.md`)
- [ ] Create `.env.production.template` for all apps
- [ ] Document required env vars per app

#### 1.4 Monitoring & Observability
- [ ] Sentry error tracking on CMS and API
- [ ] Basic health check endpoints verified working
- [ ] Structured logging confirmed in production mode

**Exit Criteria:** CMS is usable by a real person. Auth works. Content can be created and persisted. Errors are captured. Env vars are documented.

---

### Phase 2: Feature Completion (Weeks 7-10)

**Goal:** Complete the features that make RevealUI differentiated.

#### 2.1 Rich Text Editor Polish
- [ ] Verify Lexical integration works in deployed CMS
- [ ] Test rich text serialization/deserialization roundtrip
- [ ] Test image upload in rich text

#### 2.2 AI Agent Verification
- [ ] Connect AI package to real LLM provider (Vultr or OpenAI)
- [ ] Test CRDT memory persistence
- [ ] Test vector search with real embeddings
- [ ] Verify agent orchestration works end-to-end

#### 2.3 Real-Time Collaboration (if ElectricSQL verified)
- [ ] Test multi-user editing
- [ ] Test conflict resolution
- [ ] Performance test with concurrent users

#### 2.4 CLI (`create-revealui`)
- [ ] Test scaffolding locally
- [ ] Verify generated project builds and runs
- [ ] Prepare for npm publish (dry-run)

#### 2.5 RevealUI Studio (`apps/studio`) — Tauri Desktop Companion
- [ ] Scaffold Tauri app in apps/studio
- [ ] First-run wizard: detect WSL, install Nix, mount DevBox, configure git
- [ ] DevBox manager: mount/unmount, health check, sync, filesystem integrity
- [ ] App launcher: start `pnpm dev`, open apps in browser, manage ports
- [ ] System tray integration with notifications
- [ ] Native OS integration for installs (installer, DevBox, PWA/TWA)
- [ ] Update RevealUI CLAUDE.md package map (7 apps)

> **Name rationale:** "Studio" fits as the native desktop companion (like Android Studio, Visual Studio). It manages your environment, not just installs it. Works as both product name ("Download RevealUI Studio") and package name (`@revealui/studio`).

#### 2.6 AI Harnesses (`packages/harnesses`) — AI Coding Tool Integrations
- [ ] Scaffold package mirroring `packages/editors` adapter pattern
- [ ] Define `HarnessAdapter` interface (mirrors `EditorAdapter`)
- [ ] Implement `HarnessRegistry` (mirrors `EditorRegistry`)
- [ ] Implement `autoDetectHarnesses()` (mirrors `autoDetectEditors()`)
- [ ] Claude Code adapter (config sync, MCP integration)
- [ ] Cursor adapter (settings, rules sync)
- [ ] Copilot adapter (stub for future)
- [ ] JSON-RPC server over Unix socket (like editors)
- [ ] CLI: `revealui-harnesses` (list, execute, sync-config)
- [ ] Feature gate: `isFeatureEnabled("harnesses")` (Pro tier)
- [ ] Config sync to `.revealui/<harness>/` (mirrors editor config sync)

> **Architecture:** Mirrors `packages/editors` exactly — external executables, data-only communication, graceful degradation, type-safe contracts. AI tools are treated as first-class composable citizens, same as editors. White-label customers plug in whatever AI coding tools they use.

| Editors Pattern | Harnesses Equivalent |
|----------------|---------------------|
| `EditorAdapter` interface | `HarnessAdapter` interface |
| `EditorRegistry` | `HarnessRegistry` |
| Zed, VS Code, Neovim adapters | Claude Code, Cursor, Copilot adapters |
| `autoDetectEditors()` | `autoDetectHarnesses()` |
| `open-file`, `apply-config` commands | `generate-code`, `analyze-code` commands |
| `.revealui/<editor>/` config | `.revealui/<harness>/` config |

#### 2.7 Paywall Pipeline & Tier Boundary Enforcement
- [ ] Add license-check middleware to all API routes (gate by tier before serving)
- [ ] Add feature-gate checks to UI components (render upgrade prompts for gated features)
- [ ] Build `/account/billing` subscription management portal
- [ ] Build `/account/license` page (display license key, tier, limits)
- [ ] Implement tier upgrade flow (Pro → Enterprise mid-subscription via Stripe)
- [ ] Enforce AI provider limitation (Pro: 1 provider only)
- [ ] Enforce MCP server gating (`@revealui/mcp` requires Pro+)
- [ ] Enforce editor/harness gating (requires Pro+)
- [ ] Add rate limiting by tier (free: lower limits, Pro/Enterprise: higher)
- [ ] Validate `domains` field in license (Enterprise domain-lock)
- [ ] Add license revocation mechanism (admin endpoint + webhook on subscription cancel)
- [ ] Add audit logging for tier changes and license events (Enterprise)
- [ ] CLI license check (`create-revealui` validates license for Pro templates)
- [ ] White-label branding removal (Enterprise only, controlled by license flag)
- [ ] Test full funnel: landing → pricing → signup → checkout → license → feature access
- [ ] Verify idempotent webhook handling (Stripe checkout.session.completed → license generation)

> **Current state (as of Feb 2026):** License infrastructure is ~80% built — JWT license system, Stripe webhooks, feature flag definitions, pricing page, license API all exist. The critical gap is **enforcement**: feature flags are defined but not checked in routes or components. No UI exists for subscription management. The checkout-to-license pipeline works in code but is untested against real Stripe.

| Layer | Status | Gap |
|-------|--------|-----|
| License validation (`core/license.ts`) | Complete | — |
| Feature definitions (`core/features.ts`) | Complete | — |
| Database schema (`db/schema/licenses.ts`) | Complete | — |
| Stripe webhooks + checkout (`services/`) | Complete | Untested on real Stripe |
| License API (`api/routes/license.ts`) | Complete | — |
| Pricing page (`landing/pricing/`) | Complete | — |
| **Middleware enforcement in routes** | **Not implemented** | **Critical gap** |
| **UI feature gating in components** | **Not implemented** | **Critical gap** |
| **Subscription management portal** | **Not implemented** | **Critical gap** |
| Rate limiting by tier | Not implemented | Phase 2 |
| Domain-based license validation | Not implemented | Enterprise |
| License revocation | Not implemented | Phase 2 |
| White-label branding toggle | Not implemented | Enterprise |

#### 2.8 Agent Maker — "The Creator"
- [ ] Build agent scaffolding system ("The Creator") that generates new AI agents
- [ ] The Creator addresses the founder (Joshua Vaughn) as "Father" in all interactions
- [ ] Generated agents inherit RevealUI's type-safe contracts and memory system
- [ ] Agent templates: content agent, code agent, support agent, analytics agent
- [ ] Agent configuration UI in dashboard app (name, capabilities, personality, constraints)
- [ ] Agent persistence via `@revealui/ai` CRDT memory system
- [ ] Agent lifecycle: create → configure → deploy → monitor → retire
- [ ] Agent-to-agent communication protocol (orchestration via The Creator)
- [ ] Feature gate: `isFeatureEnabled("ai")` (Pro: 1 provider, Enterprise: all providers)
- [ ] White-label: customers can rebrand The Creator for their own agent-making workflows

> **Concept:** The Creator is the meta-agent — the agent that makes agents. It sits on top of the `@revealui/ai` package and provides a guided workflow for spinning up purpose-built agents. For the founder, it uses the "Father" address as a signature touch. For white-label customers, the creator persona is customizable.

#### 2.9 BYOK (Bring Your Own Key) — Customer API Key Infrastructure
- [ ] Add `user_api_keys` table to `packages/db/src/schema/` (encrypted credential storage)
- [ ] Add `tenant_provider_configs` table (per-tenant provider selection + settings)
- [ ] Implement envelope encryption for stored keys (AES-256 DEK + KMS-backed KEK)
- [ ] Build key CRUD API endpoints (create, read-masked, rotate, delete)
- [ ] Refactor `packages/ai/src/llm/client.ts` — replace `createLLMClientFromEnv()` with `createLLMClientForUser(userId)` that loads keys from DB
- [ ] Refactor `packages/mcp/` — support per-tenant credential scope for MCP servers
- [ ] Client-side key mode (Pattern A): keys never leave browser, direct API calls to provider
- [ ] Server-side key mode (Pattern C): encrypted at rest, server proxies calls on user's behalf
- [ ] Key validation: test API call on key submission before storing
- [ ] Key redaction in all logs, error traces, and Sentry reports (middleware + regex patterns)
- [ ] Audit logging: log every key access/usage (who, when, model, tokens) — never log the key itself
- [ ] Feature gate: BYOK available at all tiers; server-side encrypted storage requires Pro+
- [ ] UI: settings page for managing provider keys (add, rotate, delete, usage stats)
- [ ] GDPR: include API key handling in DPA; support full key purge on account deletion
- [ ] ToS: add BYOK liability clauses (customer responsible for own keys, no agency relationship)
- [ ] Research Google Gemini free image generation API for built-in image gen (see 2.10)

> **Why BYOK is critical:** As a bootstrapped product, RevealUI cannot front API credits for customers. BYOK is the industry standard (Cursor, JetBrains, Continue.dev, Warp, VS Code all use it). It eliminates financial risk while giving customers full control over providers and costs.

> **Legal status by provider (as of Feb 2026):**

| Provider | BYOK Risk | Notes |
|----------|-----------|-------|
| Anthropic | LOW | Explicitly endorsed as compliance path after Jan 2026 wrapper crackdown |
| Google Gemini | LOW | Terms permissive; EU customers must use paid API tier |
| Together AI | LOW | Anti-resale language doesn't target BYOK |
| Groq | LOW | Standard anti-resale; BYOK compliant |
| Fireworks | LOW | Standard anti-resale; BYOK compliant |
| OpenAI | MODERATE | Terms ambiguous but dozens of major products (Cursor, JetBrains) do BYOK with no enforcement |
| Mistral | MODERATE-HIGH | Explicit third-party integration prohibition; may need written authorization |

> **Architecture patterns (phased):**
> 1. **Phase 1 (launch):** Client-side BYOK (Pattern A) — keys never touch RevealUI servers. Zero storage liability.
> 2. **Phase 2 (Pro):** Server-side encrypted BYOK (Pattern C) — AES-256 envelope encryption for background processing, agent workflows.
> 3. **Phase 3 (Enterprise):** Self-hosted deployment (Pattern D) — keys never leave customer infrastructure. Plus optional managed credits (RevealUI fronts API costs, bills customer).

> **Current codebase gap:** Zero BYOK infrastructure. LLM providers use global env vars (`OPENAI_API_KEY`, etc.). No credential tables, no per-tenant key isolation, no encrypted storage. The `LLMProviderConfig` interface already accepts `apiKey: string` — the plumbing is ready, just needs a dynamic source instead of `process.env`.

#### 2.10 Free Image Generation Research (Google Gemini)
- [ ] Research Google Gemini image generation API (Imagen 3 via Gemini) — free tier limits, quality, terms
- [ ] Research Gemini 2.0 Flash native image generation capabilities
- [ ] Evaluate free vs paid tier limits (requests/day, resolution, commercial use rights)
- [ ] Test image generation quality for CMS content workflows (blog images, thumbnails, hero images)
- [ ] Determine if generated images can be used commercially by RevealUI customers
- [ ] Compare with alternatives: Stable Diffusion (self-hosted, free), DALL-E (paid), Midjourney (paid)
- [ ] If viable: add Google Gemini image generation as a built-in feature for all tiers (free provider = free images)
- [ ] Integration point: `@revealui/ai` image generation module, usable from CMS editor and dashboard
- [ ] BYOK pattern: customers who want OpenAI DALL-E or other providers can bring their own keys

> **Rationale:** If Google offers free image generation through Gemini, RevealUI can offer built-in image generation at zero cost to both the platform and customers. This is a major differentiator for a CMS — agencies can generate blog images, thumbnails, and marketing assets without paying per-image.

#### 2.11 Internal vs Productized Boundary
- [ ] Audit machine-specific content — move `scripts/sync-clones.sh` to `scripts/dev-local/` (gitignored) or parameterize; split `distribution.md` into generic (committed) and personal (gitignored)
- [ ] Define dogfood instance — `revealui.com` runs on RevealUI CMS; `apps/marketing` for marketing, `apps/cms` for content, `apps/docs` for documentation; separate deployment config from generic product config
- [ ] Add branding config to `@revealui/config` — name, logo, primaryColor, showPoweredBy; `@revealui/presentation` reads it; `create-revealui` scaffolds with RevealUI branding; Enterprise tier unlocks full white-label
- [ ] CI clean room test — verify `create-revealui` output contains no machine-specific paths, no `.claude/`, no `business/`, no `MASTER_PLAN.md`

> **Definition:** The **internal version** is the full monorepo as Joshua develops it (machine-specific paths, Claude rules, MASTER_PLAN, business docs). The **productized version** is what customers get via `create-revealui` or npm (clean white-label, no traces of developer workstation). The **dogfood instance** is RevealUI running its own CMS at `revealui.com`.

| Category | npm packages | create-revealui template | Git repo |
|----------|-------------|--------------------------|----------|
| `packages/*/dist/` | YES | YES (as deps) | YES |
| `apps/*` templates | NO | YES (scaffolded) | YES |
| `.claude/rules/` | NO | NO | YES |
| `scripts/dev-local/` | NO | NO | gitignored |
| `docs/MASTER_PLAN.md` | NO | NO | YES |
| `business/` | NO | NO | YES |
| `LICENSE*` | YES | YES | YES |

**Exit Criteria:** Core differentiators (CMS + AI + real-time) working in deployed environment. CLI generates working projects. Studio app scaffolded. Harnesses package mirrors editors pattern. Paywall pipeline tested end-to-end. Agent Maker operational. BYOK infrastructure functional. Image generation research complete. Internal/productized boundary defined and enforced in CI.

---

### Phase 3: Launch Preparation (Weeks 11-14)

**Goal:** Prepare for public OSS launch.

#### 3.1 Documentation
- [ ] Deploy docs site
- [ ] Quick start guide tested by someone other than you
- [ ] API reference complete for core package
- [ ] At least 3 example projects working

#### 3.2 Open Source Preparation
- [ ] License headers verified
- [ ] CONTRIBUTING.md accurate
- [ ] Issue templates created
- [ ] GitHub repo made public
- [ ] npm packages published (OSS tier)

#### 3.3 Landing Page & Marketing
- [ ] Landing page polished with real screenshots
- [ ] Documentation links working
- [ ] Discord server set up
- [ ] Launch announcement drafted

#### 3.4 Pro Tier Preparation
- [ ] License key system working
- [ ] Feature gating verified (`isLicensed('pro')`)
- [ ] Stripe subscription ↔ license flow working
- [ ] Private npm registry or package access configured

**Exit Criteria:** RevealUI is publicly available on GitHub and npm. A developer can `npx create-revealui my-app` and get a working project. Pro tier is purchasable.

---

## Scope Freeze Policy

**Until Phase 0 is complete:**
- No new packages
- No new apps
- No new CI workflows
- No new Claude rules or coordination protocols
- No dependency replacements (headlessui → native, motion → native, etc.)
- No architecture changes

**The only acceptable work is:**
1. Deploying what exists
2. Fixing what's broken
3. Verifying integrations
4. Writing tests for deployed features

Phase 5 items from the previous plan (native UI components, native animation library, MCP UI) are deferred indefinitely. They are optimization of code that hasn't proven its value yet.

---

## Development & Distribution Pipeline

### Current State (as of 2026-02-22, updated Session 7)

```
Developer Laptop (WSL: ~/projects/RevealUI)
    |
    |--[git push origin]-->  GitHub (RevealUIStudio/revealui) --> CI (16 workflows)
    |                                                              |
    |                                                              |-->  Vercel (landing + CMS)
    |                                                              '-->  npm (not publishing yet)
    |
    |--[auto: post-push hook]-->  LTS Drive (E:\professional\RevealUI)
    |
    |--[git pull origin]<-- DevBox (/mnt/wsl-dev/projects/RevealUI) [when mounted, manual]
    |
    '--[git fetch+reset]--> Windows Clone (C:\Users\joshu\projects\RevealUI) [read-only, commits blocked]
```

**Windows Clone (Session 11):** Read-only mirror synced via `git fetch + reset --hard` (replaced robocopy).
- Script: `C:\Scripts\sync-revealui-to-windows.ps1` (simplified: fetch + reset only)
- Pre-commit hook blocks all commits as a safety net
- No `node_modules`, no build artifacts, no dev tooling
- Manual: `powershell -File C:\Scripts\sync-revealui-to-windows.ps1` or `git -C /mnt/c/Users/joshu/projects/RevealUI fetch origin && git -C /mnt/c/Users/joshu/projects/RevealUI reset --hard origin/main`

**Claude Code Worktrees (Session 5):** `.claude/agents/` with 4 worktree-isolated agents (builder, tester, linter, gate-runner). Turbo 2.8+ shares cache across worktrees automatically.

### Ideal State (target)

```
Developer Laptop (WSL)
    |
    |--[git push origin]-->  GitHub --> CI (9 consolidated workflows)
    |   |                     |
    |   |                     |-->  Vercel (preview on PR, prod on main)
    |   |                     |      landing.revealui.com
    |   |                     |      app.revealui.com (CMS)
    |   |                     |      api.revealui.com
    |   |                     |      docs.revealui.com
    |   |                     |
    |   |                     |-->  npm (public, OSS packages)
    |   |                     |      @revealui/core, cli, presentation, contracts, db, auth, utils...
    |   |                     |
    |   |                     |-->  GitHub Packages (private, Pro packages)
    |   |                     |      @revealui/ai, mcp, editors, services, harnesses
    |   |                     |
    |   |                     '-->  Changesets (version management + changelogs)
    |   |
    |   '--[auto-sync hook]-->  LTS Drive (E:\professional\RevealUI)
    |
    '--[git pull origin]<-- DevBox (portable dev, when mounted)
```

### Tier Distribution Architecture

Single repo, single branch, runtime gating:
- Do NOT split into separate repos per tier (too much overhead for solo founder)
- Do NOT use separate branches per tier (merge hell)
- Keep everything in one repo, one branch (main)
- Gate features at **runtime** via license JWT + feature flags (already 80% built)
- Gate package distribution at **publish time** (`private: true` on Pro packages)
- Pro packages published to GitHub Packages (private npm registry, free for private repos)

| Tier | License | Price | Packages | Distribution | Gating |
|------|---------|-------|----------|-------------|--------|
| OSS | MIT | Free | core, cli, presentation, contracts, db, auth, config, router, setup, sync, dev, test, utils | Public npm | None |
| Pro | Commercial | $49/mo | ai, mcp, editors, services, harnesses | GitHub Packages (private) | License JWT + feature flags |
| Max | Commercial | TBD | Pro + higher limits, priority support | GitHub Packages (private) | License JWT + feature flags |
| Enterprise | Commercial | $299/mo | Max + SSO, audit, white-label, self-hosted | GitHub Packages + Docker (GHCR) | License JWT + domain lock |
| Experimental | N/A | Founder only | Bleeding-edge features | main branch, dark-launched | `REVEALUI_DEV_MODE=true` |

### Licensing (Session 7)

- **`LICENSE`** (root): MIT — covers the 13 OSS packages
- **`LICENSE.commercial`** (root): RevealUI Commercial License v1.0 — covers Pro/Enterprise packages and `/ee` directories
- Commercial packages have `"license": "SEE LICENSE IN ../../LICENSE.commercial"` in package.json
- Modeled after Elastic License v2 (short, clear, two restrictions: no competing service, no circumventing license)
- Key clauses: subscription required for production use, evaluation allowed without key, 14-day grace on cancellation
- Enterprise tier adds: self-hosting rights, white-label rights, multi-tenant rights

### Release Pipeline Enhancements (planned Session 5)

**Short-term (Phase 0):**
- [ ] Enable npm trusted publishing (OIDC) in `release.yml` — eliminates long-lived NPM_TOKEN
- [ ] Add `--provenance` to changeset publish command (SLSA Build Level 2 attestations)

**Medium-term (Phase 1):**
- [ ] Set up canary release workflow (`@revealui/core@canary` via Changesets snapshots)
- [ ] Configure dual-registry publishing (npm public + GitHub Packages private)
- [ ] Add `.npmrc` scoped registry config for Pro packages

**Deferred (Phase 2+):**
- [ ] Restructure to `/ee` folder pattern if needed (following Cal.com, Novu, Langfuse)
- [ ] Keygen.sh or Anystack for per-seat Pro licensing
- [ ] Max tier runtime gating implementation

### Auto-Sync Setup (implemented Session 4)

- **Git alias:** `git pushall` = push to origin + LTS
- **Claude Code hook:** PostToolUse on Bash detects `git push origin` and auto-pushes to `lts` remote
- **LTS remote:** `lts` -> `/mnt/e/professional/RevealUI` with `receive.denyCurrentBranch=updateInstead`

---

## CI/CD Optimization (Phase 1 work)

### Redundancy Audit (16 workflows, significant duplication)

| Check | Where It Runs | Times Per PR | Target |
|-------|---------------|-------------|--------|
| Biome lint | ci.yml, test.yml, pre-push hook | 3x | 1x (ci.yml) |
| ESLint | ci.yml, test.yml | 2x | 1x (ci.yml) |
| Type check | ci.yml, test.yml, quality-checks.yml, validate-types.yml | 4x | 1x + schema-only |
| Unit tests | ci.yml, test.yml | 2x | 1x (ci.yml) |
| Integration tests | ci.yml, test.yml | 2x | 1x (ci.yml) |
| Build | ci.yml, test.yml, quality-checks.yml, deploy.yml | 4x | 2x (ci + deploy) |
| Security audit | ci.yml, security-audit.yml, codeql.yml, secrets-scan.yml | 4 workflows | 1 workflow |
| Dep validation | ci.yml, security-audit.yml | 2x | 1x |
| Doc validation | doc-validation.yml, validate-docs.yml | 2 workflows | 1 workflow |

### Consolidation Plan

**Keep (9 workflows):**

| Workflow | Purpose |
|----------|---------|
| ci.yml | Primary quality gate (lint, typecheck, test, build, structure) |
| deploy.yml | Vercel deployment + smoke test |
| security-audit.yml | All security (absorb secrets-scan + codeql) |
| release.yml | Changesets + npm publish |
| doc-validation.yml | Documentation accuracy (merge both doc workflows) |
| validate-types.yml | Type system integrity (schema changes only) |
| visual-regression.yml | E2E visual snapshots |
| regenerate-types.yml | Weekly Supabase type regen |
| check-vultr-model.yml | Manual Vultr model check |

**Delete/merge (7 workflows):**

| Workflow | Action |
|----------|--------|
| test.yml | DELETE — fully duplicated by ci.yml |
| quality-checks.yml | DELETE — duplicated by ci.yml |
| secrets-scan.yml | MERGE into security-audit.yml |
| codeql.yml | MERGE into security-audit.yml |
| validate-docs.yml | MERGE into doc-validation.yml |
| structure-validation.yml | MERGE into ci.yml as a job |

### Pre-Push Gate Fix

- [ ] Add `--changed` flag to `scripts/gates/ci-gate.ts` using `turbo --filter=...[HEAD~1]`
- [ ] Update `.husky/pre-push` to use `pnpm gate --no-build --changed`
- [ ] Target: pre-push completes in <60s (currently >600s timeout)

---

## Dev Environment Setup (deferred from PLANS.md)

### Shell Profiles (B2 — not started)

- [ ] Create `~/.config/shell/env.sh` — orchestrator (BASH_ENV points here)
- [ ] Create `~/.config/shell/platform.sh` — POSIX platform detection
- [ ] Create `~/.config/shell/path.sh` — idempotent PATH construction
- [ ] Create `~/.config/shell/aliases.sh` — shell aliases (interactive only)
- [ ] Refactor `~/.bashrc` to source from `~/.config/shell/`
- [ ] Create `~/.bash_profile` — sources `~/.bashrc`

### DevDrive Auto-Mount (B4 — not started)

- [ ] Fix Task Scheduler `WSL-Mount-DevDrive` (S4U LogonType, USB trigger, retry logic)
- [ ] Fix `C:\Scripts\mount-wsl-dev.ps1` (retry loop, WSL readiness check)
- [ ] Verify end-to-end: reboot → auto-mount → projects accessible

---

## Planning Convention

### Single Source of Truth

This document (`docs/MASTER_PLAN.md`) is the **only** plan document for RevealUI. All Claude Code agents, all sessions, all instances work from this single plan.

### Rules

1. **No separate plan files** — session plan files in `~/.claude/plans/` are ephemeral scratch, not durable planning
2. **No parallel plan documents** — the former `PLANS.md` (1350 lines, Parts A-D) has been absorbed and deleted
3. **All agents read this file** on session start and verify work against the current phase
4. **All agents update this file** after completing work (checkboxes + Completed Work entry)
5. **Task sub-agents** receive current phase context in their prompt but do NOT create plan files

### Enforcement

- `.claude/rules/planning.md` — project-level rule (committed)
- `~/.claude/rules/planning.md` — global rule (Windows + WSL)
- `~/.claude/hooks/stop.js` — warns about plan file sprawl on session end

### Multi-Agent Coordination

- `.claude/rules/coordination.md` — Master Plan Protocol (read plan → verify task → update plan)
- `.claude/rules/priorities.md` — Multi-Agent Awareness (all agents share this plan)
- `.claude/workboard.md` — Plan Reference section with last-updated timestamp

---

## Remaining Skipped/Failing Tests (6 — all accounted for)

| Skip | Package | Reason | Blocked By |
|------|---------|--------|------------|
| 3 tests | services (stripe) | Requires real Stripe test key | Phase 0.5 |
| 2 tests | db (extract-units) | Edge cases not in real code | Low priority |
| 1 test | cms (memory-routes) | API routes not implemented | Phase 2 |
| 1 suite | cms (gdpr) | Needs E2E environment | Phase 1 |
| 1 suite | cms (health) | Needs E2E environment | Phase 1 |
| 1 suite | core (richtext) | Needs Lexical module | Phase 2 |

---

## Completed Work (Phases from previous plans)

These items are DONE and should not be revisited:

- [x] Phase 1 (old): Auth email system — implemented
- [x] Phase 1 (old): Vector search — implemented
- [x] Phase 1 (old): Populate support — implemented
- [x] Phase 2 (old): Quality & Testing — 0 any types, 0 console statements, 425/425 AI tests
- [x] Production blockers: 9/9 critical+high issues fixed (transactions, CORS, waitlist, migrations, error leaks, CI, tsconfig, SSL)
- [x] Build status: 23/23 packages building and typechecking
- [x] Session 2 (2026-02-21): 15 presentation tests fixed, Supabase boundary violations fixed, auth test flakiness fixed, CMS deployment blockers fixed (@revealui/services moved to deps, runtime exports added), unprotected test routes removed (chat-test, rate-limit-example), localhost fallbacks hardened (email service, ElectricSQL proxy), waitlist rate limiting made cold-start-safe (DB-backed), Node version aligned to 24.13.0 across all 20+ locations
- [x] Tooling: CI gate, audit scripts, Biome config, Nix flakes
- [x] Session 3 (2026-02-22): Landing page deployed to Vercel (https://revealui-landing.vercel.app), waitlist verified end-to-end, fixed POSTGRES_URL env var (trailing newline), fixed `isBuildTime()` false positive at runtime, made Stripe/Blob config vars optional, fixed `vercel.json` (removed invalid runtime, added monorepo install command), NeonDB verified from serverless functions
- [x] Session 4 (2026-02-22): Comprehensive pipeline planning — mapped current/ideal dev distribution workflow, CI redundancy audit (16→9 workflows), deleted 41 stale plan files across drives, established single-plan convention (MASTER_PLAN.md only), created multi-agent coordination protocol, set up auto-sync LTS hook + git alias, created planning rules + sprawl detection hook, absorbed PLANS.md into MASTER_PLAN.md
- [x] Session 5 (2026-02-22): CMS deployment push + distribution pipeline — pushed CMS auth/billing commit (cb2b66d2, 30 files, 1936 insertions) after fixing 5 Biome errors + 1 TS error across 5 push attempts. Cloned RevealUI to Windows (`C:\Users\joshu\projects\RevealUI`) for Claude Desktop access. Moved all Windows repos from `source/repos/` to `projects/`. Fixed Dependabot lockfile mismatch (pnpm catalog breakage). Set up Claude Code worktree infrastructure (4 agents: builder, tester, linter, gate-runner with `isolation: worktree`). Added `.claude/worktrees/` to `.gitignore`. Created `scripts/sync-clones.sh` for multi-location sync. Researched and planned distribution pipeline: tier strategy (OSS/Pro/Max/Experimental), npm trusted publishing (OIDC), canary releases, dual-registry publishing, /ee folder pattern (deferred to Phase 2+)
- [x] Session 7 (2026-02-22): Distribution strategy deep dive + implementation — Comprehensive research across 8 categories (commercial licensing, /ee patterns, feature gating enforcement, Changesets dual-registry, Docker enterprise distribution, WSL-Windows sync, DevBox golden image, Stripe revenue automation). Created `LICENSE.commercial` (RevealUI Commercial License v1.0, modeled after ELv2). Updated all 4 commercial package.json files with commercial license reference (ai, mcp, editors, services). Created `C:\Scripts\sync-revealui-to-windows.ps1` (automated robocopy mirror, excludes build artifacts). Created `C:\Scripts\setup-revealui-sync-task.ps1` (Task Scheduler setup, 15-min interval). Updated `.claude/rules/distribution.md` with Windows sync docs and licensing section. Added Max tier to distribution table. Documented complete revenue flow (Stripe → license JWT → package access → feature gating).
- [x] Session 8 (2026-02-23): Production DB migration + auth page refactor + seed pages — Applied migration 0005 via psql (added `_json` JSONB to pages, created contents/cards/heros/events/banners tables). Exported `AuthLayout` from `@revealui/presentation/server` and `components/index.ts`. Refactored CMS login, signup, and reset-password pages to use presentation components (AuthLayout, Card, FormLabel, InputCVA, ButtonCVA). Fixed biome.json schema version (2.3.14→2.4.4) and `useBiomeIgnoreFolder` pattern. Fixed core engine `create`/`update` to use `flattenFields()` for tabs-nested JSON field detection (was missing `layout` blocks field in pages). Fixed seed.ts to provide `path` field and `site_id` via `getOrCreateDefaultSite()`. Successfully seeded home/about/getting-started pages in production NeonDB. Commits: 03b73698, 0dcf5a31, 8b8793a0.
- [x] Session 10 (2026-02-23): Docs assessment and cleanup — Assessed all ~55 active docs against MASTER_PLAN. Archived 15 session artifacts, consolidated 6 duplicate bundle optimization files to 1 canonical, renamed API_REFERENCE→SCRIPT_MANAGEMENT_API, fixed PRODUCTION_READINESS_CHECKLIST grade (A-→C+), updated INDEX.md to reference MASTER_PLAN as single source of truth, removed empty optimization/ dir and docs/plans/. Reinstated Phase 0.3 (ElectricSQL) — code is correct per Feb 2026 review, only provisioning remains. Fixed ELECTRICSQL_API_VERIFICATION.md to reflect resolved hook params issue.
- [x] Session 11 (2026-02-23): Claude tool routing + Windows clone fix — Reconciled Windows clone divergence (was 1 ahead, 24 behind → hard-reset to origin/main). Added pre-commit hook to block commits on Windows clone. Created `.claude/rules/tool-routing.md` defining roles for each Claude tool (WSL=primary, Zed ACP=editing, Windows=read-only, Desktop=research). Updated `.claude/rules/distribution.md`: replaced robocopy sync with `git fetch + reset --hard`, added Windows Clone Policy section. Updated global `~/.claude/CLAUDE.md` (Windows reference → READ-ONLY mirror). Simplified `C:\Scripts\sync-revealui-to-windows.ps1` (git-based, replaced robocopy). Added Phase 2.11 (Internal vs Productized Boundary) to MASTER_PLAN. Updated distribution pipeline diagram. Archived old robocopy sync scripts.
- [x] Session 12 (2026-02-23): Password-reset fix + logger audit — Fixed password-reset endpoint returning 500 (was empty body after rate-limit body-read fix). Added try/catch in `withRateLimit` handler call → revealed `"logger.error is not a function"`. Traced through 3 logger packages: `@revealui/core/utils/logger` re-exports from `logger-client.ts` which had `'use client'` directive — Next.js creates a reference proxy for `'use client'` modules imported from server code, stripping all methods. Fixed in 4 commits: (1) try/catch in withRateLimit for error visibility, (2) server logger import in `packages/auth/src/server/password-reset.ts`, (3) server logger import in CMS route file, (4) **root cause fix**: removed `'use client'` from `packages/core/src/utils/logger-client.ts` — it's a plain utility module with no React hooks/browser APIs, so the directive was unnecessary. Audited all CMS routes: 28 CMS files + 24 package files used the broken import; root cause fix resolves all 18 server-side files at once. Password-reset endpoint now returns 200. Commits: 4316cc7f, 8334dcef, 2c8000e2, 8baed041.

---

## Claude Session Delegation

Each Claude setup scope has a clear mandate:

### Global (`~/.claude/`) — Cross-cutting standards
- TypeScript conventions (typescript.md)
- Git conventions (git.md)
- Hook development rules (hooks.md)
- Generic commands (review, deploy-check, add-tests, new-component, new-page)
- **Does NOT contain RevealUI-specific plans or priorities**

### RevealUI Project (`.claude/`) — Project-specific execution
- Monorepo structure rules (monorepo.md)
- Biome conventions (biome.md)
- Database architecture (database.md)
- Distribution/sync rules (distribution.md)
- Tool routing rules (tool-routing.md) — which Claude tool can do what
- Unused declarations policy (unused-declarations.md)
- Multi-instance coordination (coordination.md) — includes Master Plan Protocol
- Planning convention (planning.md) — single source of truth enforcement
- **Priorities rule (priorities.md) — ties all work to this master plan + multi-agent awareness**
- Commands: gate, audit, new-package

### Portfolio Project (`.claude/`) — Separate concern
- Next.js Pages Router rules
- Tailwind 3.4 rules
- Portfolio-specific commands
- **Completely independent from RevealUI**

### WSL Global (`~/.claude/`) — Partially set up (Session 4)
- **Status:** settings.json, hooks (stop.js, post-push-lts.js), and rules (planning.md) created
- **Approach:** Maintain separate `~/.claude/` directories for Windows and WSL
- **Do NOT cross-mount:** UNC paths (`\\wsl.localhost\...`) break file watchers, git, and symlinks

#### Completed (Session 4)
- [x] `settings.json` — PostToolUse (auto-sync LTS) + Stop (sprawl check) hooks registered
- [x] `hooks/stop.js` — warns about uncommitted changes + plan sprawl
- [x] `hooks/post-push-lts.js` — auto-sync to LTS drive on git push
- [x] `rules/planning.md` — single-plan convention

#### Remaining (Phase 1 priority)
1. Create `/home/joshua-v-dev/.claude/CLAUDE.md` — professional identity (founder@revealui.com)
2. Copy shared rules from Windows:
   - `typescript.md` — shared conventions
   - `git.md` — shared conventions
   - `hooks.md` — shared hook development rules
3. Add remaining hooks:
   - PreToolUse: block `.env` and lock file edits
   - PostToolUse: auto-format with Biome after Write/Edit

#### Two-Environment Model
| Environment | Claude Code | Projects | Global CLAUDE.md | Identity |
|-------------|-------------|----------|------------------|----------|
| Windows | Native install | Personal (`C:\Users\joshu\projects\`) | `C:\Users\joshu\.claude\CLAUDE.md` | joshua.v.dev@gmail.com |
| WSL | WSL install | Professional (`~/projects/RevealUI`) | `/home/joshua-v-dev/.claude/CLAUDE.md` | founder@revealui.com |

---

## Document Graveyard (moved to `docs/archive/`)

These documents are superseded by this master plan:

| Document | Reason |
|----------|--------|
| `PRODUCTION_READINESS.md` | Outdated (Feb 2, grade C+, metrics corrected since) |
| `PRODUCTION_BLOCKERS.md` | Completed (all 9 blockers fixed) |
| `PRODUCTION_ACTION_PLAN.md` | Completed (env template actions) |
| `PROJECT_ROADMAP.md` | Superseded (old 4-phase plan with wrong estimates) |
| `PROJECT_STATUS.md` | Superseded by this document |
| `TECHNICAL_DEBT.md` | Completed (all items resolved) |
| `BUILD_FIX_SUMMARY.md` | Historical (one-time session record) |
| `CACHING_DEPLOYMENT_SUMMARY.md` | Historical |
| `CACHING_QUICK_START.md` | Historical |
| `CYCLIC_DEPENDENCY_RESOLVED.md` | Historical |
| `DEPENDENCY_ANALYSIS_SUMMARY.md` | Historical |
| `DEPENDENCY_GRAPH.md` | Historical (use `pnpm deps:mermaid` instead) |
| `DEPENDENCY_TABLE.md` | Historical |
| `EDITOR_MIGRATION_COMPLETE.md` | Historical |
| `GLOBAL_CACHING_ENABLED.md` | Historical |
| `PROMPT_CACHING_IMPLEMENTATION.md` | Historical |
| `AI_CODE_VALIDATOR_README.md` | Tool documentation (keep in package README) |
| `UNFINISHED_WORK_INVENTORY.md` | Superseded by this plan |
| `PRIORITIZED_ACTION_PLAN.md` | Superseded by this plan |
| `~/.claude/plans/PLANS.md` | Absorbed into this plan (Parts A-D, 1350 lines) — deleted Session 4 |
| 39 session plan files (WSL) | Ephemeral session artifacts — deleted Session 4 |
| 2 session plan files (Windows) | Ephemeral session artifacts — deleted Session 4 |

---

## Review Schedule

- **Weekly:** Check Phase 0 progress, update checkboxes
- **At each phase gate:** Review exit criteria before proceeding
- **Never:** Add items to a phase that isn't current without updating this document first
