# RevealUI Master Plan

**Last Updated:** 2026-02-21
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

#### 0.1 Deploy Landing Page
- [ ] Deploy apps/landing to Vercel (build verified, config fixed, awaiting deploy)
- [x] Fix waitlist route: add `runtime = 'nodejs'` (was defaulting to Edge Runtime, would break DB calls)
- [x] Fix health route: add `runtime = 'nodejs'`
- [x] Fix vercel.json: upgrade function runtime from `nodejs22.x` → `nodejs24.x`
- [x] Fix waitlist rate limiting: replaced in-memory Map (cold-start reset) with DB-backed COUNT query
- [x] Update `.env.example` with all required vars (was missing REVEALUI_SECRET, SERVER_URL, etc.)
- [x] Connect waitlist to NeonDB (31 tables confirmed, waitlist schema verified, pgvector enabled)
- [x] Set POSTGRES_URL in Vercel dashboard
- [ ] Set REVEALUI_SECRET in Vercel dashboard (≥32 chars, required for config validation)
- [ ] Set NEXT_PUBLIC_SERVER_URL in Vercel dashboard (e.g. https://revealui.com)
- [ ] Deploy apps/landing to Vercel and smoke-test waitlist signup
- [ ] Verify email capture works end-to-end

#### 0.2 Verify Database in Production
- [x] Provision NeonDB instance (ep-bitter-snow-ahixm35n, us-east-1)
- [x] Run migrations (`packages/db/migrations/`)
- [x] Verify all 31 tables created correctly (confirmed via query)
- [x] pgvector extension enabled (required for vector(1536) columns)
- [ ] Test connection from Vercel serverless functions (pending first deploy)
- [ ] Verify `withTransaction` error is caught properly (currently throws — intentional)

#### 0.3 Verify ElectricSQL Integration
- [ ] Read ElectricSQL HTTP API documentation (not assume)
- [ ] Test actual shape query endpoint format
- [ ] Test actual CRUD endpoint format
- [ ] Update `packages/sync/` to match real API
- [ ] Write integration test against live ElectricSQL instance
- [ ] If ElectricSQL doesn't work as expected: document the gap, decide whether to keep or drop

#### 0.4 Verify Auth Flow
- [ ] Deploy CMS to staging (build clean — all 25 API routes now have `runtime = 'nodejs'`)
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
- Multi-instance coordination (coordination.md)
- **Priorities rule (priorities.md) — ties all work to this master plan**
- Commands: gate, audit, new-package

### Portfolio Project (`.claude/`) — Separate concern
- Next.js Pages Router rules
- Tailwind 3.4 rules
- Portfolio-specific commands
- **Completely independent from RevealUI**

### WSL Global (`~/.claude/`) — Needs parity with Windows
- **Status:** Claude Code installed in WSL, but no global config exists (no CLAUDE.md, no rules, no hooks)
- **Approach:** Maintain separate `~/.claude/` directories for Windows and WSL
- **Do NOT cross-mount:** UNC paths (`\\wsl.localhost\...`) break file watchers, git, and symlinks

#### Setup Plan (Phase 1 priority)
1. Create `/home/joshua-v-dev/.claude/CLAUDE.md` — professional identity (founder@revealui.com), RevealUI-focused global instructions
2. Copy shared rules from Windows:
   - `typescript.md` — shared conventions
   - `git.md` — shared conventions (professional identity already in RevealUI project rules)
   - `hooks.md` — shared hook development rules
3. Create WSL-specific settings:
   - `settings.json` — professional tool permissions
   - `settings.local.json` — WSL-specific paths
4. Add professional hooks:
   - PreToolUse: block `.env` and lock file edits
   - PostToolUse: auto-format with Biome after Write/Edit
   - Stop: warn about uncommitted changes
5. Sync strategy: one-way copy script (Windows → WSL for shared rules):
   ```bash
   # sync-claude-config.sh (run inside WSL)
   rsync -av /mnt/c/Users/joshu/.claude/rules/ ~/.claude/rules/ --exclude="*.json"
   ```

#### Two-Environment Model
| Environment | Claude Code | Projects | Global CLAUDE.md | Identity |
|-------------|-------------|----------|------------------|----------|
| Windows | Native install | Personal (`C:\Users\joshu\source\repos\`) | `C:\Users\joshu\.claude\CLAUDE.md` | joshua.v.dev@gmail.com |
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

---

## Review Schedule

- **Weekly:** Check Phase 0 progress, update checkboxes
- **At each phase gate:** Review exit criteria before proceeding
- **Never:** Add items to a phase that isn't current without updating this document first
