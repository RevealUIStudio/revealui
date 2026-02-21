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
- [ ] Connect waitlist to NeonDB (schema exists: `packages/db/src/schema/waitlist.ts`)
- [ ] Verify email capture works end-to-end
- [~] Set up CORS_ORIGIN, DATABASE_URL in Vercel env (POSTGRES_URL identified, awaiting NeonDB string)

#### 0.2 Verify Database in Production
- [ ] Provision NeonDB instance
- [ ] Run migrations (`packages/db/migrations/`)
- [ ] Verify all 25 tables created correctly
- [ ] Test connection from Vercel serverless functions
- [ ] Verify `withTransaction` error is caught properly (currently throws — intentional)

#### 0.3 Verify ElectricSQL Integration
- [ ] Read ElectricSQL HTTP API documentation (not assume)
- [ ] Test actual shape query endpoint format
- [ ] Test actual CRUD endpoint format
- [ ] Update `packages/sync/` to match real API
- [ ] Write integration test against live ElectricSQL instance
- [ ] If ElectricSQL doesn't work as expected: document the gap, decide whether to keep or drop

#### 0.4 Verify Auth Flow
- [ ] Deploy CMS to staging (build clean — all 17+ API routes have `runtime = 'nodejs'`)
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

**Exit Criteria:** Core differentiators (CMS + AI + real-time) working in deployed environment. CLI generates working projects.

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
- Currently missing: rules, hooks, commands
- Should mirror Windows global rules (typescript.md, git.md)
- Lower priority — RevealUI project config covers most WSL work

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
