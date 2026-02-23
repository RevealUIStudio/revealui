# RevealUI Master Plan

**Last Updated:** 2026-02-22
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
- [x] Deploy apps/landing to Vercel (live at https://revealui-landing.vercel.app)
- [x] Fix waitlist route: add `runtime = 'nodejs'` (was defaulting to Edge Runtime, would break DB calls)
- [x] Fix health route: add `runtime = 'nodejs'`
- [x] Fix vercel.json: removed invalid `functions.runtime` field, added `cd ../.. && pnpm install` for monorepo catalogs
- [x] Fix waitlist rate limiting: replaced in-memory Map (cold-start reset) with DB-backed COUNT query
- [x] Update `.env.example` with all required vars (was missing REVEALUI_SECRET, SERVER_URL, etc.)
- [x] Connect waitlist to NeonDB (31 tables confirmed, waitlist schema verified, pgvector enabled)
- [x] Set POSTGRES_URL in Vercel (fixed: was stored with trailing newline, re-set correctly)
- [x] Set REVEALUI_SECRET in Vercel (32-byte hex, config validation passing)
- [x] Set NEXT_PUBLIC_SERVER_URL and REVEALUI_PUBLIC_SERVER_URL in Vercel
- [x] Deploy apps/landing to Vercel and smoke-test waitlist signup
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

#### 0.3 Verify ElectricSQL Integration — DEFERRED
> **Decision (2026-02-21):** Deferred to Phase 2. ElectricSQL sync is a Pro+ feature gated behind `isFeatureEnabled('advancedSync')`. Not required for Pro tier launch. The `packages/sync/` package has a placeholder `ElectricProvider` and Yjs-based collab (which works independently). Real-time sync verification postponed until after Pro tier ships.

- [ ] Read ElectricSQL HTTP API documentation (not assume)
- [ ] Test actual shape query endpoint format
- [ ] Test actual CRUD endpoint format
- [ ] Update `packages/sync/` to match real API
- [ ] Write integration test against live ElectricSQL instance
- [ ] If ElectricSQL doesn't work as expected: document the gap, decide whether to keep or drop

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
- [ ] Test signup → login → session → logout flow manually
- [ ] Test password reset with real email (Resend)
- [ ] Verify rate limiting works
- [ ] Verify brute force protection works

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

**Exit Criteria:** Core differentiators (CMS + AI + real-time) working in deployed environment. CLI generates working projects. Studio app scaffolded. Harnesses package mirrors editors pattern. Paywall pipeline tested end-to-end. Agent Maker operational. BYOK infrastructure functional. Image generation research complete.

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

### Current State (as of 2026-02-22, updated Session 5)

```
Developer Laptop (WSL: ~/projects/RevealUI)
    |
    |--[git push origin]-->  GitHub (RevealUIStudio/revealui) --> CI (16 workflows)
    |                                                              |
    |                                                              |-->  Vercel (landing + CMS)
    |                                                              '-->  npm (not publishing yet)
    |
    |--[git push lts]----->  LTS Drive (E:\professional\RevealUI) [auto via hook]
    |
    |--[git pull origin]<-- DevBox (/mnt/wsl-dev/projects/RevealUI) [when mounted, manual]
    |
    '--[git pull origin]<-- Windows Clone (C:\Users\joshu\projects\RevealUI) [read-only reference]
```

**Windows Clone (Session 5):** Read-only reference for Claude Code Desktop (Windows can't read WSL filesystem).
Sync via `scripts/sync-clones.sh` or manually: `git -C /mnt/c/Users/joshu/projects/RevealUI pull origin main`

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

| Tier | Price | Packages | Distribution | Gating |
|------|-------|----------|-------------|--------|
| OSS (MIT) | Free | core, cli, presentation, contracts, db, auth, config, router, setup, sync, dev, test, utils | Public npm | None |
| Pro | $49/mo | ai, mcp, editors, services, harnesses | GitHub Packages (private) | License JWT + feature flags |
| Enterprise | $299/mo | Same as Pro + higher limits | GitHub Packages (private) | License JWT + domain lock |
| Experimental | Founder only | Bleeding-edge features | main branch, dark-launched | `REVEALUI_DEV_MODE=true` |

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
