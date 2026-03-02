# RevealUI Master Plan

**Last Updated:** 2026-03-02 (Session 40)
**Status:** Active — Single source of truth for all planning
**Owner:** Joshua Vaughn (founder@revealui.com)

> This document supersedes all previous roadmaps, action plans, and status docs.
> Superseded documents have been moved to `docs/archive/`.
> All Claude sessions must reference this document for priorities and sequencing.

---

## Current Reality (as of 2026-02-24)

### What Exists

- **Codebase:** ~320,000 lines of TypeScript across ~1,786 files
- **History:** 648+ commits over 7 weeks (Dec 30, 2025 - Feb 20, 2026)
- **Apps:** 5 (cms, api, mainframe, docs, marketing)
- **Packages:** 17 (@revealui/core, ai, presentation, contracts, db, auth, services, cli, config, sync, editors, mcp, router, setup, dev, test, utils)
- **Tests:** 307+ test files, all packages build and typecheck (22/22 = 5 apps + 17 packages)
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
| ElectricSQL sync | **Verified** | **High — proxy + auth + shapes working in production (Railway → NeonDB)** |

### What Doesn't Exist

- Zero real users (admin account exists for testing)
- Stripe live integration unverified
- Email delivery unverified (Resend API key not set)
- No `create-revealui` CLI published to npm
- No documentation site deployed
- No marketing page deployed
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

## RevealUI Studio Suite

RevealUI Studio (`apps/studio`) is the **central command centre** for the full RevealUI Studio Suite. It evolves from a dev-env utility into a unified management hub — the one desktop app you open to run, manage, and configure everything else.

**Studio is the hub. Everything else is a module.**

| Product | Repo | Stack | Status | Description |
|---------|------|-------|--------|-------------|
| **RevealUI** | `RevealUIStudio/revealui` | TypeScript, Next.js, Hono, React 19 | Phase 0 (deploying) | Full-stack React CMS framework with AI agents |
| **Studio** | `RevealUIStudio/revealui` (`apps/studio`) | Rust, Tauri 2, React 19 | Active dev | Desktop hub: vault, tunnel, infra, sync, setup |
| **Revvault** | `RevealUIStudio/revault` | Rust, age encryption | MVP complete | Age-encrypted secret vault (core ported into Studio) |
| **DevKit** | `RevealUIStudio/revealui-devkit` | Bash, PowerShell, TOML | Phases 2-4,6 done | Portable WSL dev environment toolkit |

### Studio App — Unified Hub (`apps/studio`)

Tauri 2 + React 19 desktop application. 6-page sidebar (as of Session 35):

| Page | Purpose |
|------|---------|
| Dashboard | System status: WSL, tier, systemd |
| Vault | Age-encrypted secret management via `revvault-core` |
| Infrastructure | Tabbed: App Launcher + DevBox manager |
| Sync | Git sync across C: and E: drives |
| Tunnel | Tailscale VPN status, connect/disconnect, peer list |
| Setup | Full-page wizard: WSL · Nix · DevBox · Git · Vault · Tailscale · Project Setup |

**Rust commands:** 8 vault + 3 tunnel commands. `revvault-core` git dep. `arboard` for clipboard.
**First-run wizard:** 7 steps (same sections as Setup page, modal overlay on first launch).
**Remaining:** macOS/Linux tunnel stubs, `pnpm setup` shell-out (Phase 2), PeerCard sub-component.

### Revvault — Secret Vault & Password Manager

Personal + professional secret management. Replaces `passage` shell tooling with a proper vault (CLI + Tauri desktop app). Internal tool first, architected to become a Studio Suite product.

**Architecture:** Rust workspace with 3 crates:
- `revault-core` — age encryption, passage-compatible store, migration engine
- `revault-cli` — 10 clap commands (get, set, list, search, delete, edit, export-env, rotate, migrate, completions)
- `revault-tauri` — Tauri 2 desktop app with React frontend

**Current state:**
- Core library hardened (path validation, 31+ tests passing)
- CLI fully functional (40 secrets in store, migration from plaintext complete)
- Tauri app renders via WSLg (Mesa software rendering), browse/search/reveal/copy/delete work
- Nix flake provides reproducible build environment
- Store: `~/.revealui/passage-store/` (40 entries across revealui/*, streetbeefs/*, credentials/*, misc/*, ssh/*)

**Remaining work (2 phases):**

#### Revvault Phase 6: Rotation Engine
- [ ] Implement `RotationProvider` trait in `crates/core/src/rotation/`
- [ ] Stripe provider: create new restricted key → verify → delete old (`POST /v1/api_keys`)
- [ ] Vercel provider: create new token → verify → revoke old (`POST /v5/user/tokens`)
- [ ] Neon provider: reset role password → update connection strings (`POST .../roles/{role}/reset_password`)
- [ ] CLI commands: `revault rotate <provider> [--dry-run]`, `revault rotation-status`
- [ ] Config: `<store>/.revault/rotation.toml` (provider, schedule, secret paths)
- [ ] Audit log: `rotation-log.jsonl` (manual-trigger only, no daemon)

#### Revvault Phase 7: Integration — Replace Shell Tooling
- [ ] Update `~/.revealui/wsl/bashrc.d/40-secrets.sh`: `passenv`/`passenv-file` call `revault` instead of `passage`
- [ ] Create `powershell/.../Get-Secret.ps1`: call `revault.exe` natively (no WSL shelling)
- [ ] Update RevealUI `.envrc`: `eval "$(revault export-env revealui/env/reveal-saas-dev-secrets)"`
- [ ] Cross-platform store access: `revault.exe` on Windows + `revault` on Linux via `/mnt/c/` path mapping
- [ ] Verify: `passenv` works in WSL, `Get-Secret` works in PowerShell, direnv loads secrets on `cd`

### DevKit — Portable Dev Environment Toolkit

Config-driven portable dev environment. Currently powers RevealUI's WSL setup (`.revealui/`), planned for white-label sale.

**Current state:**
- Phases 2-4, 6 complete: E: restructured, Studio drive mounted, Docker/Postgres/Redis/Ollama running, tier validation passing
- `.revealui/` on `C:\Users\joshu\.revealui\` with WSL configs, shell fragments, helper scripts, boot optimization
- Tier detection: T0 (laptop only) ↔ T1 (+ Studio drive) transitions work
- `studio` CLI: up/down/status/logs/pull/psql/redis-cli commands

**Remaining work (3 phases):**

#### DevKit Phase 1: Parameterize Toolkit
- [ ] Create `devkit` repo from `.revealui/` source
- [ ] Replace all personal info with `{{PLACEHOLDERS}}` in templates
- [ ] Build `render.sh` (bash `sed`-based template engine)
- [ ] Write `config.example.toml` (identity, hardware, branding, features, infrastructure)
- [ ] Create profile presets: `solo-dev.toml`, `full-stack.toml`, `ai-studio.toml`, `team.toml`
- [ ] Verify: render with personal config → diff matches current `.revealui/`
- [ ] Verify: render with test config → `bash -n` passes, no personal info in output

#### DevKit Phase 5: Staging Distro (Optional)
- [ ] Clone primary WSL distro to Studio drive (`wsl --export` + `wsl --import`)
- [ ] Configure staging distro for production-like settings
- [ ] Build promotion workflow: dev (primary) → staging (clone) → prod (cloud)

#### DevKit Phase 7: White-Label Polish
- [ ] Write documentation (getting-started, hardware-guide, tier-reference)
- [ ] Build `render.ps1` (Windows-native for users without WSL)
- [ ] Test: render 3 profiles, bootstrap from clean machine
- [ ] Set up Gumroad distribution

**DevKit monetization:**

| Tier | Price | Layers |
|------|-------|--------|
| Free | $0 | Boot optimization only |
| Solo | $29 | Layer 0: boot opt + auto-mount + shell config + sync |
| Pro | $49 | Layer 0+1: + infrastructure + Docker Compose |
| AI Studio | $79 | Pro + Ollama + model management |
| Team | $149 | Everything + team profiles + onboarding |

---

## Phased Plan

### Phase 0: Prove It Works (CURRENT — Weeks 1-3)

**Goal:** Deploy something real. Verify core integrations. Get first user.

**Why this is first:** ~320,000 lines of code mean nothing if the product doesn't work when deployed. Every minute spent adding features before verifying the foundation is a gamble.

#### 0.1 Deploy Marketing Page (COMPLETE - 2026-02-22)
- [x] Deploy apps/marketing to Vercel (live at https://revealui-marketing.vercel.app)
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
- [x] Verify `withTransaction` error is caught properly (Session 13 — 9/9 tests pass: Neon HTTP throws clear error, pg Pool executes correctly, errors propagate from callbacks)

#### 0.3 Verify ElectricSQL Integration (COMPLETE - 2026-02-24)
- [x] Enable logical replication on NeonDB (Neon Dashboard → Settings)
- [x] Deploy Electric to Railway (self-hosted, ~$5/mo, persistent volume)
  - Railway URL: `https://electric-production-99bd.up.railway.app`
  - Connected to NeonDB via direct (non-pooled) connection string
  - `ELECTRIC_SECRET` configured for API authentication
- [x] Set `ELECTRIC_SERVICE_URL` in Vercel CMS env vars
- [x] Fix `electric-proxy.ts`: send `ELECTRIC_SECRET` independently of `ELECTRIC_SOURCE_ID` (self-hosted doesn't use source_id)
- [x] Fix shape proxy routes: ElectricSQL HTTP API does not support parameterized `where`/`params` — switched to inline `where` with validated values (UUID regex for user/session IDs, alphanumeric for agent IDs)
- [x] Smoke test all 3 shape endpoints with auth:
  - `GET /api/shapes/conversations` → 200 (empty snapshot, row-level filtered by user_id)
  - `GET /api/shapes/agent-contexts` → 200 (empty snapshot, filtered by session_id)
  - `GET /api/shapes/agent-memories?agent_id=assistant` → 200 (empty snapshot, filtered by agent_id)
- [x] Unauthenticated requests correctly return 401
- [x] Write integration test against live instance — `e2e/electric.e2e.ts`: 3 unauthenticated tests (401 ✓), 3 authenticated tests (sign-up via API → session cookie → 200 ✓, graceful skip if rate-limited) — Session 23

**Architecture:** CMS auth (session cookie) → proxy route (validates session, adds row-level filter) → Electric (Railway) → NeonDB (logical replication)

**Deployment decision (Session 12):** Self-hosted on Railway.
- Vercel cannot host Electric — requires persistent volume for replication slot state
- Electric must use the **direct** (non-pooled) Neon connection string for replication
- `ELECTRIC_SOURCE_ID` is Electric Cloud-only — omit for self-hosted

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
  - CMS live at https://cms.revealui.com (custom domain added, previously revealui-joshuas-projects-c07004e7.vercel.app)
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
- [x] Test password reset with real email (Resend) — email delivered, reset link worked (Session 16 — 2026-02-25)
- [x] Wire Resend in Vercel: set `RESEND_API_KEY` (Sender scope) + `RESEND_FROM_EMAIL` + `NEXT_PUBLIC_SERVER_URL`=`https://cms.revealui.com` + `REVEALUI_PUBLIC_SERVER_URL`=`https://cms.revealui.com`; full flow verified: email arrives → link works → new password accepted (Session 16 — 2026-02-25)
- [x] Fix CMS dark mode: `darkMode: ['selector', '[data-theme="dark"]']` already configured in `apps/cms/tailwind.config.ts` (verified 2026-02-25)
- [x] Fix ThemeSelector dropdown rendering: added `*:bg-zinc-800 *:text-white` to style `<option>` elements in dark mode, plus `cursor-pointer` and `aria-label` (2026-02-25)
- [x] Fix favicon 404s: `apps/cms/public/favicon.ico` (4 icons, 16x16+32x32) + `favicon.svg` already exist (verified 2026-02-25)
- [x] Fix CSP: Vercel Live origins already added to `script-src`/`frame-src` in `apps/cms/csp.js` lines 36-40 (verified 2026-02-25)
- [x] Add email whitelist signup gating: already implemented — `REVEALUI_SIGNUP_WHITELIST` + `REVEALUI_SIGNUP_OPEN` in config schema; `isSignupAllowed()` in `@revealui/auth/server`; sign-up route calls it before rate limit (verified 2026-02-25)

#### 0.5b Deploy API to Vercel (Session 15 — 2026-02-25)

**Architecture decision:** REST-only collab via ElectricSQL (no WebSockets). API deploys as Vercel serverless.

- [x] Fix `getCorsOrigins()`: changed throw → `logger.error()` (module-init throw killed every cold start)
- [x] Add `.catch()` to both `initializeLicense()` call sites (was unhandled rejection)
- [x] Remove `@hono/node-ws` and all WebSocket infrastructure (incompatible with Vercel serverless)
- [x] Rewrite `apps/api/src/routes/collab.ts`: REST endpoints replacing WebSocket collab
  - `POST /api/collab/update` — accept base64 Yjs binary, merge with DB state, persist
  - `GET /api/collab/snapshot/:documentId` — initial client load (before ElectricSQL shapes catch up)
  - ElectricSQL `yjs_documents` shape subscription handles real-time sync to clients
- [x] Remove `@hono/node-ws` from `apps/api/package.json`
- [x] Fix Vercel project: `framework` was set to "hono" in dashboard → Vercel ran extra TypeScript step that included CMS/web files (JSX errors). Fixed via API: `framework: null`
- [x] Set production env vars in Vercel API project: `POSTGRES_URL`, `REVEALUI_SECRET`, `CORS_ORIGIN`, `NODE_ENV`
- [x] Trigger new production deployment (`dpl_8rZei89MDe3ZNryG7QTvgQn6c458`)
- [x] Verify deployment reaches READY state
- [x] Smoke-test `GET /health` → 200 ✓
- [x] Smoke-test `GET /api/collab/snapshot/<id>` → 404 (no document) ✓ (migration 0007 added missing yjs_documents table)

**Root causes found:**
1. Vercel "hono" framework preset runs its own TypeScript step AFTER buildCommand completes — picks up CMS/web files → JSX errors. Fix: set `framework: null` in dashboard.
2. GitHub Actions billing failed — all CI jobs blocked ("recent account payments have failed"). Not a code issue; needs billing attention.
3. Old collab route used `getSharedRoomManager` (in-memory Yjs rooms) — requires persistent server, incompatible with serverless. Replaced with stateless REST.

#### 0.5 Verify Stripe Integration (COMPLETE - 2026-02-28)
- [x] Stripe seed script (`pnpm stripe:seed`) + license key generator (`pnpm stripe:keys`) — commit 99825def; idempotent, keyed by `metadata.revealui_product_key`
- [x] Configure Stripe test mode: Pro ($49/mo) + Enterprise ($299/mo) products created; billing portal configured; webhook endpoint registered at `https://revealui-cms.vercel.app/api/webhooks/stripe`
- [x] Price IDs set in Vercel env vars (`NEXT_PUBLIC_STRIPE_PRO_PRICE_ID=price_1T4YLE2Y57LKzXU73IX1OU0G`)
- [x] RSA-2048 key pair generated; `REVEALUI_LICENSE_PRIVATE_KEY` + `REVEALUI_LICENSE_PUBLIC_KEY` set in both CMS and API Vercel env vars
- [x] End-to-end billing test (Session 18 — 2026-02-28):
  - Signup → `GET /api/billing/subscription` → `{tier:"free", status:"active"}` ✓
  - `POST /api/billing/checkout` → returns valid Stripe checkout URL ✓
  - `checkout.session.completed` webhook → `{tier:"pro", status:"active"}` ✓ (license row created in NeonDB)
  - `customer.subscription.deleted` webhook → `{tier:"pro", status:"revoked"}` ✓
  - `customer.subscription.updated` (past_due) webhook → `{status:"expired"}` ✓
  - `POST /api/billing/portal` → returns valid Stripe Billing Portal URL ✓
  - Webhook signature verification using `whsec_` secret confirmed working
- [x] CMS billing page live at `https://cms.revealui.com/account/billing` (Upgrade + Manage Billing buttons)
- [ ] Verify circuit breaker behavior: trigger 429s from Stripe → confirm retry logic + circuit open after threshold (deferred to Phase 1)

**Exit Criteria:** Marketing page live with working waitlist. CMS deployed to staging with working auth and database. At least one integration (ElectricSQL or Stripe) verified or flagged as broken.

---

### Phase 1: Production Hardening (Weeks 4-6)

**Goal:** Fix everything Phase 0 revealed. Harden for real traffic.

#### 1.1 Fix Integration Issues
- [x] Apply missing DB migrations to production: 0003 (performance indexes), 0004 (stripe_customer_id), 0006 (token_salt) — Session 20
- [x] Create and apply migration 0008 (licenses table) — Session 20
- [x] Fix webhook PEM key newline escaping (`jose/importPKCS8` "Invalid character") — Session 20
- [x] Make Stripe subscription metadata update non-critical in webhook handler — Session 20
- [x] Verify CMS `next.config.mjs` has no `ignoreBuildErrors` — confirmed absent
- [x] Replace any remaining placeholder implementations with real ones — global-setup.ts (fake bcrypt hash → env-var login) — Session 21

#### 1.2 E2E Test Coverage
- [x] Smoke E2E: 9/9 passing against production (API health, openapi, docs, CMS render, marketing, waitlist) — Session 21
- [x] Auth flow E2E (signup, login, reset, session) — e2e/auth.e2e.ts fixed: correct CMS routes (/login, /signup, /reset-password), rate-limit-graceful skips, sign-out via API. Tests pass/skip cleanly against production; rate limiting (IP-based 15min) causes skips when re-run within window — Session 22
- [x] CMS content CRUD E2E — COMPLETE (Session 36): 2/2 passing against production in 8.7s — Session 36
  - CMS auth reads from `public.users.password` (NOT `neon_auth.account`) — seed-admin.mjs was inserting into the wrong table
  - `public.users.password` updated to hash of `ewDV1GawgWL97XjBbcFeGXYMiwVoIui` (matches `CMS_ADMIN_PASSWORD` in Vercel)
  - **AdminDashboard is NOT URL-aware** — state machine SPA; `[[...segments]]` catch-all ignores URL params; navigating to `/admin/collections/posts/create` always shows the dashboard. Tests MUST drive via button clicks.
  - **`collections.slice(0,3)` bug** — only first 3 collections (users, tenants, pages) were clickable; "posts" hidden in "+18 more" text. Fixed: show all collections in scrollable list (commit `c6c0f30d`)
  - **InMemoryStorage on Vercel** — `storage/index.ts` fell back to InMemoryStorage because `config?.database?.url` threw `ConfigValidationError` (any missing env var). Fixed: read `process.env.DATABASE_URL` directly as fallback → DatabaseStorage used → shared rate limit state in `rate_limits` table (commit `c6c0f30d`)
  - `SKIP_GLOBAL_AUTH=1` added to `global-setup.ts` — skips global sign-in slot when per-test sign-in is used (commit `c6c0f30d`)
  - `e2e/content.e2e.ts` rewritten to drive admin via button clicks: signIn → goToAdmin → click collection button → Create New → fill title → Save → assert navigation back to list
  - DocumentForm supports text/number/checkbox/select/date only — no file upload; media E2E skipped (TODO phase 1)
  - **`nestedDocsPlugin` renders `breadcrumbs` as text input** — adds `breadcrumbs` array field with no `admin.position: 'sidebar'` or `admin.hidden`; after `serializeConfig` strips `RowLabel` function, DocumentForm shows it as a freeform text input labeled "breadcrumbs". Does not block save (not required).
  - **Server-side field hooks** — FIXED (Session 31, commit `ee34d58d`): new `fieldHooks.ts` utility (`runBeforeFieldHooks`) wired into `create()` and `update()` at `beforeValidate` (pre-validation) and `beforeChange` (pre-DB-write) lifecycle positions. Client-side workaround in `AdminDashboard.handleSave` removed. 3 new tests added; 638 total passing.
  - **Success toast cleared by React 18 batching** — `handleSave` sets success message then immediately calls `handleCollectionClick` which synchronously clears it; both state updates batch to null. Assertion changed to wait for "Create New" button reappearance (post-save navigation) + document title visible in list (commit `40429f53`).
  - **Vercel build rate limit (Hobby plan)** — rate limit affects all 4 Vercel projects. Pending Vercel rate limit reset; 3 commits on `main` now waiting to deploy (`40429f53`, `ee34d58d`, `2fae5482`).
  - Run command: `CI=1 PLAYWRIGHT_BASE_URL=https://cms.revealui.com CMS_ADMIN_EMAIL=founder@revealui.com CMS_ADMIN_PASSWORD=ewDV1GawgWL97XjBbcFeGXYMiwVoIui node_modules/.bin/playwright test e2e/content.e2e.ts --project=chromium --retries=0 --reporter=line`
  - Only run with `--project=chromium` + `--retries=0` (2 sign-in requests — well within 5-slot limit)
- [x] Stripe payment flow E2E (test mode) — webhook endpoint: rejects unsigned payload (400) ✓ — Session 22. Full checkout UI flow needs production admin credentials (blocked; verified manually in Session 18)
- [x] Waitlist signup E2E — covered by smoke test (Waitlist POST returns success ✓) — Session 21

#### 1.3 Environment & Secrets
- [x] Secret management: Revvault (age-encrypted vault) replaces SOPS+age plan — CLI + Tauri app built, 40 secrets migrated, plaintext originals deleted
- [x] Wire Revvault into RevealUI dev workflow — Session 27
  - WSL interop (Windows EXE from WSL) does NOT pass custom env vars to Windows processes — age key path fails
  - Native WSL ELF binary built via `nix shell nixpkgs#cargo nixpkgs#rustc` — target/release/revvault in revault repo
  - Binary installed to `~/.local/bin/revvault` (not committed — install manually after clone)
  - Age key: `/mnt/c/Users/joshu/.config/age/keys.txt` (matches store recipient `age1k926...`; the `~/.age-identity/keys.txt` has a DIFFERENT key — wrong one)
  - Store: `/mnt/c/Users/joshu/.revealui/passage-store` (WSL mount of Windows home)
  - Secret format in vault: `KEY: VALUE` (colon-space, not `=`) — use `revvault get --full | sed 's/: /=/'` not `export-env`
  - `.envrc` updated: loads `revealui/env/reveal-saas-dev-secrets` (6 keys: PAYLOAD_SECRET, JWT_SECRET, SESSION_SECRET, CRON_SECRET, BETTER_AUTH_SECRET, MCP_ENCRYPTION_KEY) before `dotenv_if_exists .env`
  - To migrate to `KEY=VALUE` format: `revvault edit revealui/env/reveal-saas-dev-secrets` and replace `: ` with `=`; then switch to `revvault export-env` in `.envrc`
- [x] Create `.env.production.template` for all apps — Session 21
  - `apps/api/.env.production.template`: POSTGRES_URL, REVEALUI_SECRET, CORS_ORIGIN, STRIPE_*, REVEALUI_LICENSE_*, optional AI keys
  - `apps/cms/.env.production.template`: above + RESEND_*, NEXT_PUBLIC_STRIPE_*, ELECTRIC_*, signup gating, Sentry, Supabase optional
  - `apps/marketing/.env.production.template`: POSTGRES_URL, REVEALUI_SECRET, public URLs, NEXT_PUBLIC_CMS_URL, Sentry optional
- [x] Document required env vars per app — covered by `.env.production.template` files — Session 21

#### 1.4 Monitoring & Observability
- [x] Error tracking: custom `error_events` NeonDB table — Session 24 (Axiom dropped — Vercel Pro required for log drain)
  - `error_events` table (migration 0009 applied): captures level, message, stack, app, context, environment, url, userId, requestId, metadata
  - API `POST /api/errors` route: unauthenticated ingestion endpoint (50 req/min rate limit)
  - API `errorHandler`: persists 5xx errors to DB after logging (fire-and-forget)
  - CMS `global-error.tsx`: POSTs fatal client-side errors to API on unhandled React error
  - CMS `instrumentation.ts`: captures `unhandledRejection` via fetch to API (avoids sharp/Edge bundle issue)
  - CMS `/admin/errors` page: server component, last 100 events, color-coded by level, expandable stack traces
- [x] Structured log pipeline: roll-our-own `app_logs` NeonDB table — Session 25
  - `app_logs` table (migration 0010 applied): captures warn/error/fatal from all apps
  - `packages/db/src/log-transport.ts`: `createDbLogHandler(app)` factory — exported as `@revealui/db/log-transport`
  - `packages/utils/logger`: `Logger.addLogHandler()` + child-logger propagation
  - API: `createDbLogHandler('api')` wired at startup (direct DB write, no Edge issues)
  - API `POST /api/logs`: ingestion endpoint (200 req/min) for apps that cannot import `@revealui/db` (Next.js Edge bundle constraint)
  - CMS `instrumentation.ts`: fetch-based log handler → `POST /api/logs` (avoids Edge bundle tracing of Node.js imports)
  - CMS `/admin/logs` page: filter by app/level, last 200 entries, expandable data column
- [x] Basic health check endpoints verified working — `/health` (liveness), `/health/live` (alias), `/health/ready` (DB check) all return 200 on api.revealui.com — Session 21
- [x] Structured logging confirmed in production mode — `packages/utils/src/logger/index.ts`: `pretty: process.env.NODE_ENV !== 'production'` → JSON output in production, ANSI in dev — Session 21

**Exit Criteria:** CMS is usable by a real person. Auth works. Content can be created and persisted. Errors are captured. Env vars are documented.

---

### Phase 2: Feature Completion (Weeks 7-10)

**Goal:** Complete the features that make RevealUI differentiated.

#### 2.1 Rich Text Editor Polish
- [x] Verify Lexical integration works in deployed CMS
- [x] Test rich text serialization/deserialization roundtrip
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
- [x] Test scaffolding locally — 8 integration tests for `createProject()` (Session 39: template copy, .env.local, README, devcontainer, devbox, _gitignore→.gitignore rename, src/app layout — all passing)
- [x] Prepare for npm publish (dry-run) — `npm pack --dry-run` from `packages/cli/` confirms 19 files, 41.7 kB tarball; `bin/create-revealui.js`, `dist/`, and `templates/minimal/` all present (Session 39)
- [x] Fix _gitignore → .gitignore rename — npm silently drops `.gitignore` from tarballs; store as `_gitignore`, rename on copy in `createProject()` (Session 39)
- [ ] Verify generated project builds and runs — blocked until @revealui/* packages are published to npm; `pnpm install` in generated project will fail until then

#### 2.5 RevealUI Studio (`apps/studio`) — Tauri Desktop Companion
- [x] Scaffold Tauri app in apps/studio (Session 31 — React 19 + Tauri 2 + Tailwind v4, Windows platform)
- [x] DevBox manager: mount/unmount, sync, drive info (Session 31 — DevBoxPanel + SyncPanel)
- [x] App launcher: start `pnpm dev`, open apps in browser, manage ports (Session 32 — AppsPanel, port-based status, WSL nohup start, fuser stop)
- [x] First-run wizard: detect WSL, install Nix, mount DevBox, configure git (Session 32 — SetupWizard overlay, check_setup/set_git_identity Tauri commands, sidebar Setup button, localStorage persistence)
- [x] System tray integration (Session 33 — tray icon, Show/Mount/Unmount/Quit menu, left-click focuses window, background thread for mount ops; notifications deferred — tauri-plugin-notification requires GTK on Linux but app compiles on Windows)
- [x] Native OS integration (Session 33 — hide-to-tray on X button, Quit-only via tray menu; Tauri bundle targets="all" generates NSIS installer on Windows; PWA deferred to Phase 2)
- [x] Update RevealUI CLAUDE.md package map (Session 33 — Apps (5)→(6), studio row added, workspace count 22→23)
- [x] Vault page + Rust backend (Session 34 — VaultPanel, useVault hook, SecretList/SecretDetail/SearchBar/NamespaceFilter/CreateSecretDialog components; vault_init/list/get/set/delete/search/copy Tauri commands; revvault-core PassageStore + arboard clipboard)
- [x] Tunnel page + Rust backend (Session 34 — TunnelPanel with 10 s polling, useTunnel hook; get_tailscale_status/tailscale_up/tailscale_down Tauri commands; PlatformOps trait extended with TailscaleStatus/TailscalePeer; Windows impl parses `tailscale status --json`)
- [x] Infrastructure page (Session 34 — InfrastructurePanel composite: DevBoxPanel + AppsPanel under one route)
- [x] Setup page (Session 34 — full-page SetupPage replacing overlay-only wizard; WSL/Nix/DevBox/Git-identity rows)
- [x] Biome: exclude `**/target` from scan (Session 34 — Cargo build artifacts in src-tauri/target/ were causing 442 false Biome errors on push)
- [x] Upgrade VaultPanel to use granular components (Session 34 — useVault hook + SecretList + SecretDetail + SearchBar + NamespaceFilter + CreateSecretDialog; three-panel layout; InfrastructurePanel converted to tabs; onSetup prop thread removed from AppShell/Sidebar; Tunnel icon → globe)
- [x] Wire useTunnel hook into TunnelPanel (Session 34 — replaced 96 lines of inline state with 6-line hook destructure; useRef interval, single toggling flag)
- [x] Hand-rolled Windows build script (Session 34 — `apps/studio/build-windows.ps1`: prereq check, git pull, pnpm install, vite build, cargo tauri build, opens Explorer at NSIS; `pnpm build:windows` alias)

> **Name rationale:** "Studio" fits as the native desktop companion (like Android Studio, Visual Studio). It manages your environment, not just installs it. Works as both product name ("Download RevealUI Studio") and package name (`@revealui/studio`).

> **Studio Suite note:** `apps/studio` is the RevealUI-specific desktop companion (first-run wizard, DevBox manager, app launcher). Revvault is a separate standalone product in its own repo (`joshua-v-dev/revault`) that handles secret management across all Studio Suite products. DevKit is the portable dev environment toolkit in `RevealUIStudio/revealui-devkit`.

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
- [x] Add license-check middleware to all API routes (Session 38 — `checkLicenseStatus` wired globally on `/api/*`; `requireFeature('ai')` on agent routes; `requireFeature('dashboard')` on provenance routes)
- [x] Add feature-gate checks to UI components (Session 38 — `LicenseGate` client component wired into `/admin/monitoring`, `/admin/errors`, `/admin/logs`; UpgradePrompt shown to free tier)
- [x] Build `/account/billing` subscription management portal (Session 18 — billing page with Stripe checkout + portal; verified end-to-end)
- [x] Build `/account/license` page (display license key, tier, limits) (Session 38 — tier badge, resource limits, feature access matrix)
- [ ] Implement tier upgrade flow (Pro → Enterprise mid-subscription via Stripe)
- [ ] Enforce AI provider limitation (Pro: 1 provider only)
- [ ] Enforce MCP server gating (`@revealui/mcp` requires Pro+)
- [ ] Enforce editor/harness gating (requires Pro+)
- [x] Add rate limiting by tier (Session 38 — `tieredRateLimitMiddleware` wired on `/api/*`: free=60/min, pro=300/min, enterprise=1000/min)
- [x] Validate `domains` field in license — `requireDomain()` built; wired for Enterprise domain-lock (Session 38)
- [x] Add license revocation mechanism — `checkLicenseStatus` catches revoked/expired via DB; Stripe webhooks handle subscription cancel → revoke (Session 18)
- [ ] Add audit logging for tier changes and license events (Enterprise) — `auditMiddleware` built, not wired to license events
- [ ] CLI license check (`create-revealui` validates license for Pro templates)
- [ ] White-label branding removal (Enterprise only, controlled by license flag)
- [ ] Test full funnel: landing → pricing → signup → checkout → license → feature access
- [ ] Verify idempotent webhook handling (Stripe checkout.session.completed → license generation)

#### Implementation Details (from session plans)

**Auth-Stripe bridge (critical — services/ webhook uses Supabase auth but RevealUI uses NeonDB sessions):**
- [x] Add `stripeCustomerId: text('stripe_customer_id')` column + index to NeonDB `users` table + migration (migration `0004_add_stripe_customer_id.sql` existed since Session 18)
- [x] New Hono billing routes (`apps/api/src/routes/billing.ts`) — `POST /api/billing/checkout`, `POST /api/billing/portal`, `GET /api/billing/subscription` (Session 18)
- [x] New Hono webhook handler (`apps/api/src/routes/webhooks.ts`) writing to NeonDB — `checkout.session.completed` → license created; `customer.subscription.deleted` → revoked; `customer.subscription.updated` → expired (Session 18)
- [x] CMS proxy routes not needed — API `CORS_ORIGIN` already includes `https://cms.revealui.com`; verified via CORS preflight (`access-control-allow-origin: https://cms.revealui.com`, `credentials: true`); session cookie uses `domain: .revealui.com` (Session 40)
- [x] Fix trailing `\n` in `NEXT_PUBLIC_API_URL` Vercel env var — was causing invalid URLs in all billing/license fetch calls; added `.trim()` in LicenseProvider, billing page, license page; re-set Vercel env var via CLI (Session 40, commit `8a452307`)
- [ ] Update pricing page CTAs to link to `/signup?plan=pro` (not just `/signup`)

**License enforcement middleware (`apps/api/src/middleware/license.ts`) — COMPLETE (Session 38):**
- [x] `requireLicense(minimumTier)` factory — checks `isLicensed(tier)`, returns 403 with upgrade URL; 6 tests passing
- [x] `requireFeature(feature)` factory — checks `isFeatureEnabled(feature)`, returns 403 with required tier; tests passing
- [x] `checkLicenseStatus()` — queries `licenses` table by `customerId` with 5-min TTL cache; 403 if status=revoked/expired; wired globally on `/api/*`
- [x] `requireDomain()` — validates `Origin` against `getLicensePayload().domains[]`; supports subdomains; skips if no restrictions (Enterprise only)
- [x] Call `initializeLicense()` at API startup — wired in both dev and production startup blocks
- [x] Wire `checkLicenseStatus` globally on `/api/*` after auth middleware

**Tiered rate limits (`apps/api/src/middleware/rate-limit.ts`) — COMPLETE (Session 38):**
- [x] `tieredRateLimitMiddleware()`: free=60 req/min, pro=300 req/min, enterprise=1000 req/min; key includes tier (`api:pro:${ip}`) so upgrades reset counters; wired in API index

**Resource limits (`apps/api/src/middleware/resource-limits.ts`) — BUILT, not yet wired (Session 38):**
- [x] `enforceSiteLimit()` — count sites by ownerId vs `getMaxSites()` by tier, 403 at limit
- [x] `enforceUserLimit()` — count active users vs `getMaxUsers()` by tier, 403 at limit

**Audit middleware (`apps/api/src/middleware/audit.ts`) — BUILT, not wired to license events (Session 38):**
- [x] Hono adapter for existing `AuditSystem` from `packages/core/src/security/audit.ts`; fire-and-forget after response; active only when `isFeatureEnabled('auditLog')` (Enterprise)

**DB indexes (add to schema files, not new migrations):**
- [ ] `users`: email, status, type; `sessions`: userId, tokenHash, expiresAt; `licenses`: customerId, userId, status, subscriptionId; `audit-log`: eventType, agentId, timestamp, severity

**Billing UI — COMPLETE (Sessions 18, 38):**
- [x] `apps/cms/src/app/(frontend)/account/billing/page.tsx` — shows tier/status/renewal; Free: "Upgrade to Pro" → checkout; Pro/Enterprise: "Manage Billing" → portal; success banner on `?success=true`
- [x] `LicenseProvider.tsx` React context in CMS: fetch tier + features, expose to components
- [x] `UpgradePrompt.tsx` reusable "requires Pro" card component

> **Current state (Session 38, 2026-03-02):** License enforcement is ~90% built. Middleware is wired in API. Billing UI exists. License page exists. The remaining gaps: UI feature gating in specific admin components, CMS proxy routes, DB indexes, audit log for tier changes, CLI license check, Enterprise white-label.

| Layer | Status | Gap |
|-------|--------|-----|
| License validation (`core/license.ts`) | Complete | — |
| Feature definitions (`core/features.ts`) | Complete | — |
| Database schema (`db/schema/licenses.ts`) | Complete | — |
| Stripe webhooks + checkout | Complete | Verified in test mode (Session 18) |
| License API (`api/routes/license.ts`) | Complete | — |
| Pricing page (`landing/pricing/`) | Complete | — |
| Middleware enforcement in routes | **Complete** | — |
| Rate limiting by tier | **Complete** | — |
| License revocation (via webhooks) | **Complete** | — |
| Subscription management portal | **Complete** | — |
| License page | **Complete** | — |
| **UI feature gating in components** | **Partial** | `UpgradePrompt` built, not wired in admin |
| **CMS proxy routes for billing** | **Not implemented** | CORS isolation from API |
| DB indexes | Not implemented | Performance |
| Domain-based license validation | Complete (built) | Not wired for Enterprise routes |
| Audit log for tier changes | Not implemented | Enterprise |
| White-label branding toggle | Not implemented | Enterprise |

#### 2.8 Agent Maker — "The Creator"
- [ ] Build agent scaffolding system ("The Creator") that generates new AI agents
- [ ] The Creator addresses the founder (Joshua Vaughn) as "Father" in all interactions
- [ ] Generated agents inherit RevealUI's type-safe contracts and memory system
- [ ] Agent templates: content agent, code agent, support agent, analytics agent
- [ ] Agent configuration UI in CMS admin (name, capabilities, personality, constraints)
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
- [ ] Integration point: `@revealui/ai` image generation module, usable from CMS editor and admin
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

#### 2.12 Design System Enhancements (Catalyst-Inspired) ✅

All presentation components now use native RevealUI implementations with zero external UI library dependencies (no HeadlessUI, no Framer Motion, no Radix UI). The package depends only on `clsx` and `class-variance-authority`.

- [x] **Button** (`button-headless.tsx`): 22 color variants (zinc, white, indigo, cyan, red, orange, amber, yellow, lime, green, emerald, teal, sky, blue, violet, purple, fuchsia, pink, rose, dark/zinc, dark/white, light); `outline`, `plain`, and `solid` styles; `TouchTarget` compound component
- [x] **Input** (`input-headless.tsx`): Catalyst border/focus pattern with `data-invalid` styling for validation errors
- [x] **Select** (`select-headless.tsx`): native select with chevron icon, consistent border/focus treatment
- [x] **Checkbox, Radio, Switch**: Catalyst color/sizing patterns with native implementations
- [x] **Fieldset** (`fieldset.tsx`): `Fieldset`, `Legend`, `Field`, `FieldGroup`, `Description`, `ErrorMessage`; context-based via `useFieldContext` hook
- [x] **Badge** (`badge.tsx`): 16 color variants matching Catalyst
- [x] **Divider** (`divider.tsx`): `soft` prop for lighter border
- [x] **Catalyst reference files deleted** — native RevealUI components are the authoritative implementations

---

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
- No new external UI dependencies (native implementations complete)
- No architecture changes

**The only acceptable work is:**
1. Deploying what exists
2. Fixing what's broken
3. Verifying integrations
4. Writing tests for deployed features

Phase 5 items from the previous plan (native UI components, native animation library, MCP UI) are deferred indefinitely. They are optimization of code that hasn't proven its value yet.

---

## Development & Distribution Pipeline

### Current State (as of 2026-02-24, updated Session 14)

```
Developer Laptop (WSL: ~/projects/RevealUI)
    |
    |--[git push origin]-->  GitHub (RevealUIStudio/revealui) --> CI (16 workflows)
    |                                                              |
    |                                                              |-->  Vercel (4 projects)
    |                                                              |      revealui-cms      (apps/cms)
    |                                                              |      revealui-marketing (apps/marketing)
    |                                                              |      revealui-api       (apps/api)
    |                                                              |      revealui-web       (apps/mainframe)
    |                                                              |
    |                                                              |-->  Railway (ElectricSQL)
    |                                                              '-->  npm (not publishing yet)
    |
    |--[auto: post-push hook]-->  LTS Drive (E:\professional\RevealUI)
    |
    |--[git pull origin]<-- DevBox (/mnt/wsl-dev/projects/RevealUI) [when mounted, manual]
    |
    '--[git fetch+reset]--> Windows Clone (C:\Users\joshu\projects\RevealUI) [read-only, commits blocked]
```

### Vercel Multi-Project Deployment (Session 14)

| Vercel Project | App | Root Dir | Framework | Domain | Status |
|---------------|-----|----------|-----------|--------|--------|
| `revealui-cms` | CMS | `apps/cms` | Next.js | `revealui-cms.vercel.app` | Deployed, auth + shapes working |
| `revealui-marketing` | Marketing | `apps/marketing` | Next.js | `revealui-marketing.vercel.app` | Deployed (renamed from landing) |
| `revealui-api` | API | `apps/api` | Other | `revealui-api-joshuas-projects-c07004e7.vercel.app` | Deploying (Session 15) |
| `revealui-web` | Mainframe | `apps/mainframe` | TanStack Start | — | Created, not deployed |

Each project has `vercel.json` with `cd ../.. && pnpm turbo build --filter=<app>`. Root `package.json` build script uses `turbo run build` (no `--parallel`) to respect dependency ordering.

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
- **LTS remote:** `lts` -> `/mnt/e/repos/professional/RevealUI` with `receive.denyCurrentBranch=updateInstead`

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

- [x] Add `--changed` flag to `scripts/gates/ci-gate.ts` using `turbo --filter=...[HEAD~1]` — Session 26
- [x] Update `.husky/pre-push` to use `pnpm gate --no-build --changed` — Session 26
- [x] Target: pre-push completes in <60s — Session 26 (changed-only skips security audit + scopes typecheck/ESLint to changed packages)

### Revvault WSL Integration

- [x] Diagnose: WSL interop (Windows EXE) cannot receive custom env vars from WSL shell — Session 27
- [x] Build native WSL ELF binary: `nix shell nixpkgs#cargo nixpkgs#rustc` + `cargo build --release --bin revvault` — Session 27
- [x] Install to `~/.local/bin/revvault` — Session 27
- [x] Identify correct age key: `~/.config/age/keys.txt` (not `~/.age-identity/keys.txt` — different key pair) — Session 27
- [x] Secret format is `KEY: VALUE` not `KEY=VALUE` — use `get --full | sed 's/: /=/'` not `export-env` — Session 27
- [x] Wire `.envrc`: loads 6 vars (PAYLOAD_SECRET, JWT_SECRET, SESSION_SECRET, CRON_SECRET, BETTER_AUTH_SECRET, MCP_ENCRYPTION_KEY) before `dotenv_if_exists .env` — Session 27

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
| 3 tests | services (stripe) | Uses `skipIf(!hasStripeKey)` — runs when `STRIPE_SECRET_KEY` is set in env | Phase 0.5 ✅ |
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
- [x] Session 14 (2026-02-24): ElectricSQL verified + multi-project deployment + rename landing→marketing — **Phase 0.3 COMPLETE.** Deployed ElectricSQL to Railway (self-hosted, connected to NeonDB via logical replication). Fixed `electric-proxy.ts` to send `ELECTRIC_SECRET` independently of `ELECTRIC_SOURCE_ID` (self-hosted pattern). Fixed all 3 shape proxy routes — ElectricSQL HTTP API doesn't support parameterized `where`/`params`, switched to inline `where` with validated values. All shape endpoints verified: conversations, agent-contexts, agent-memories return 200 with auth, 401 without. Renamed `apps/landing` → `apps/marketing` across entire codebase (package.json, vercel.json, Dockerfile, CI workflows, dependabot, size-limit, e2e, maintenance scripts, docs). Removed `--parallel` from root build script (was bypassing Turbo dependency ordering on cold cache, causing TS2307 errors). Set up 4 Vercel projects (revealui-cms, revealui-marketing, revealui-api, revealui-web) with correct root directories. Fixed admin seeding: password was 11 chars (minimum 12), then test user prevented re-seeding — resolved by clearing users table and updating password. Installed Vercel CLI globally on Windows for cross-filesystem deploys. Commits: 0fab4f04, 8b633ce6, f3d0530d, fe4353a9.
- [x] Session 13 (2026-02-24): Deep codebase audit + security hardening + dead code cleanup — Full monorepo audit across all 6 apps, 18 packages, 286 scripts, CI/CD, database, security, and testing. Key findings: API app production-ready (85%), CMS functional (65%), Dashboard/Docs/Web half-finished (<55%); security implementation is enterprise-grade (9/10); test suite is largely decorative (742 files, 0.18 assertions/test in presentation). **Fixes applied:** (1) `engine-strict=true` in .npmrc (was false, defeating Node version enforcement), (2) wired `validateContext()` into `SemanticMemory.store()` (prototype pollution prevention existed but wasn't called), (3) CORS default changed from `'*'` to `[]` (fail-closed instead of fail-open). **Dead code removed:** 59 unreferenced scripts deleted across scripts/workflows, analyze, validate, gates, setup, dev-tools, generate, cli, agent, system, utils. **Phase 0.2 completed:** verified `withTransaction` error handling (9/9 tests pass). Gate passed clean.
- [x] Session 15 (2026-02-24): WSL/Windows workflow split finalized + CLAUDE.md accuracy fixes — Completed WSL global Claude Code setup (now PRIMARY for professional work). Created `~/.claude/CLAUDE.md` with professional identity (founder@revealui.com), full environment context, and preferences. Copied `typescript.md`, `git.md`, `hooks.md` from Windows global rules. Added `hooks/pre-tool-use-guard.js` (blocks .env and lock file edits) and `hooks/post-tool-use-format.js` (auto-formats with Biome after Write/Edit). Registered all hooks in `settings.json` PreToolUse/PostToolUse. Created `.claude/rules/tool-routing.md` defining strict environment roles (WSL=primary dev, Zed ACP=editing, Windows=read-only, Claude Desktop=research only). Fixed CLAUDE.md accuracy: renamed `landing`→`marketing` in apps table, corrected `18 packages`→`17`, `24 workspaces`→`23` (two occurrences), build comment `parallel`→`respects dependency order`, security CI line to `security-audit.yml (consolidated)`.
- [x] Session 16 (2026-02-25): **Phase 0.4 COMPLETE** — Password reset verified end-to-end + CMS build fix. Wired Resend in Vercel (Sender-scoped API key + from email). Set `NEXT_PUBLIC_SERVER_URL` and `REVEALUI_PUBLIC_SERVER_URL` to `https://cms.revealui.com` (custom domain). Password reset email delivered, link worked, password changed successfully. Fixed `packages/dev` build: switched from `moduleResolution: "NodeNext"` to `"bundler"` — package serves raw `.ts` source via exports field, but Next.js webpack couldn't resolve `.js` → `.ts` extensions. Dropped `.js` extensions from all internal imports across tailwind, vite, postcss, biome, and code-validator modules. Commit: 5ef12dea.
- [x] Session 17 (2026-02-28, Windows): Revvault sessions consolidated — Completed plaintext migration (39 secrets imported, originals deleted, 36 duplicates removed, 3 noise entries cleaned → 40 clean entries). Fixed Tauri `beforeDevCommand` path resolution. Fixed WSLg EGL rendering (Mesa drivers in nix `LD_LIBRARY_PATH`). Consolidated all remaining work from Revvault (Phases 6-7), DevKit (Phases 1,5,7), and prior session plans into MASTER_PLAN.md under new "RevealUI Studio Suite" section. Commits: 57712f3, 7d11fe6, 264027e (all in revault repo).
- [x] Session 18 (2026-02-28, WSL): **Phase 0.5b + Phase 0.5 Stripe COMPLETE** — API `GET /health` → 200. Three cascading crashes fixed: (1) `dynamic require of "events"` — `pg` externalized in tsup config (commit 14419e2e). (2) `dynamic require of "fs"` — `createRequire` banner added to tsup config (commit af08fa74). (3) `ReferenceError: Prism is not defined` — root cause: three packages imported from `@revealui/core` main entry which bundled the entire core including Lexical editor + `@lexical/code` (expects Prism as browser global). Fixes: removed client React hooks re-export from `@revealui/ai/src/index.ts`, changed `@revealui/ai/memory/utils/deep-clone.ts` → `@revealui/core/utils/deep-clone` (added subpath export), changed `@revealui/auth/server/auth.ts` + `session.ts` → `@revealui/core/observability/logger`. Commit: 8b8b7ec3. Also: migration 0007 applied to production (yjs_documents table). Stripe WEBHOOK_SECRET trailing `\n` fixed in Vercel API project. **Stripe E2E verified**: signup → `{tier:"free"}` ✓ → checkout URL returned ✓ → `checkout.session.completed` → `{tier:"pro", status:"active"}` ✓ → `subscription.deleted` → `{status:"revoked"}` ✓ → `subscription.updated(past_due)` → expired ✓ → billing portal URL ✓. Webhook signature verification (`whsec_`) confirmed working against deployed CMS.
- [x] Session 19 (2026-02-28, WSL): **Stripe migrated from CMS → API** — CMS billing duplicates deleted (checkout, portal, subscription routes + CMS webhook). CMS billing page wired to `NEXT_PUBLIC_API_URL` (api.revealui.com). Session cookie domain fixed to `.revealui.com` (cross-subdomain). Stripe webhook URL updated in Stripe dashboard (→ api.revealui.com/api/webhooks/stripe). API env vars re-set without trailing newlines. `stripe` externalized in tsup config. **Root cause of webhook POST timeout diagnosed and fixed**: Vercel's serverless runtime puts `IncomingMessage` stream in a state where `Readable.toWeb(incoming).getReader().read()` never resolves. Fix: pre-buffer body in `api/index.js` and set `req.rawBody = Buffer.concat(chunks)` — `@hono/node-server/vercel` checks `rawBody` first and uses a completed ReadableStream. Added `.trim()` to `getWebhookSecret()` and `getStripeClient()` as defensive measure. **Verified**: `POST /api/webhooks/stripe` (no sig) → 400 in 330ms ✓; (fake sig) → 400 in 260ms ✓; (valid HMAC-SHA256) → `{"received":true}` 200 in 285ms ✓. Commits: d725f24c, a91ac75c, 6568e261, 6fa7975e, 381f2f1e.
- [x] Session 20 (2026-03-01, WSL): **Phase 1.1 start — DB migrations + full Stripe E2E on API** — Found 3 critical missing migrations: 0003 (performance indexes), 0004 (stripe_customer_id on users), 0006 (token_salt on password_reset_tokens) — all were in repo but never applied to production. Applied all three via psql. Created migration 0008 for `licenses` table (was in schema, never migrated) and applied. **Two webhook bugs discovered and fixed**: (1) `jose/importPKCS8` throws "Invalid character" — Vercel stores PEM keys with literal `\n` escaped chars; fix: `.replace(/\\n/g, '\n')` before passing to `generateLicenseKey`. (2) `stripe.subscriptions.update()` was throwing on non-existent subscription IDs — wrapped in try/catch (non-critical, license already in DB). **Full API webhook E2E verified** (2026-03-01): `checkout.session.completed` (mode=subscription) → license row created in NeonDB (`tier:pro, status:active, key_len:474`) ✓; `customer.subscription.deleted` → both licenses `status:revoked` ✓. Commits: 724a6829, 0f709772, df4185aa.
- [x] Session 21 (2026-03-01, WSL): **Phase 1.1 complete + Phase 1.2 smoke E2E 9/9 + Phase 1.3 env templates** — Fixed Phase 1.1 remaining placeholder: `e2e/global-setup.ts` replaced fake `$2a$10$YourHashedPasswordHere` bcrypt hash + broken `/login` URL with env-var-based login (`CMS_ADMIN_EMAIL`/`CMS_ADMIN_PASSWORD`). Added `GET /health/live` alias to API health route (load balancer convention). Fixed `e2e/payments.e2e.ts` webhook URL (CMS → API after Session 19 migration). Discovered correct production URLs: API=`api.revealui.com`, CMS=`cms.revealui.com`, Marketing=`revealui.com`. Fixed `biome.json` to exclude `playwright-report/` and `test-results/` (generated Playwright JSON was causing 9589+ false Biome errors). **Smoke E2E results against production: 9/9 passing** — API health/live ✓, health/ready ✓, openapi.json ✓, /docs Swagger UI ✓, CMS root ✓, CMS admin (no JS errors) ✓, marketing root ✓, pricing cards ✓, waitlist POST ✓. **Created `.env.production.template`** for all 3 apps (api, cms, marketing) — documents every required and recommended production env var with sources, format notes, and current Vercel project associations. Commits: 49f40b96, e9c7e21b, 6e69b654.
- [x] Session 22 (2026-03-01, WSL): **Phase 1.2 auth E2E + Phase 1.4 logging** — Fixed `e2e/auth.e2e.ts`: corrected CMS auth routes (`/login`, `/signup`, `/reset-password`), added name field filling for signup, sign-out via API (`POST /api/auth/sign-out`), rate-limit-graceful skips (probe → skip if 429), and rate-limiting test note. Discovered production CMS route map: admin area at `/admin/*` requires auth (redirects to `/login`); frontend at `/login`, `/signup`, `/reset-password`. Confirmed structured logging: `packages/utils/src/logger/index.ts` `pretty: process.env.NODE_ENV !== 'production'` → JSON in prod, ANSI in dev. Auth E2E 7/7 pass/skip cleanly (rate limiting test: PASS ✓; others: graceful SKIP when IP rate-limited within 15-min window).
- [x] Session 23 (2026-03-01, WSL): **Phase 0.3 ElectricSQL integration test + signIn() bug fix + Biome worktree fix** — Wrote `e2e/electric.e2e.ts`: 6 tests (3 unauthenticated → 401 enforcement, 3 authenticated → sign-up via API + session cookie → shape endpoint 200, rate-limit graceful skip). Fixed `signIn()` helpers in `e2e/content.e2e.ts` and `e2e/payments.e2e.ts` (wrong URL `/admin/login` → `/login`, wrong `waitForURL(/admin/)` → `waitForFunction` for nav away from login). Fixed `biome.json` to exclude `.claude/worktrees/` from Biome scan (gate-runner creates worktrees inside repo dir, causing "nested root configuration" conflict). Gate PASS.
- [x] Session 24 (2026-03-01, WSL): **Phase 1.4 error tracking COMPLETE** — Chose Axiom (Vercel Log Drain) as plan → discovered Vercel Pro required → fell back to custom `error_events` NeonDB table. Migration 0009 applied to production. `POST /api/errors` route (unauthenticated, 50/min rate limit). API errorHandler persists 5xx errors fire-and-forget. CMS `global-error.tsx` POSTs fatal client errors. CMS `instrumentation.ts` captures `unhandledRejection` via fetch. CMS `/admin/errors` page. Commits: e8984350, 8a7f49c5.
- [x] Session 26 (2026-03-01, WSL): **CI gate pre-push optimization + stale biome-ignore cleanup** — Added `--changed` flag to `scripts/gates/ci-gate.ts`: when set, ESLint uses `turbo run lint:eslint --filter=...[HEAD~1]`, typecheck uses `turbo run typecheck --filter=...[HEAD~1]`, and security audit is skipped (network call belongs in CI). Updated `.husky/pre-push` to use `pnpm gate --no-build --changed`. Also cleaned up 168 stale `biome-ignore lint/style/useNamingConvention` comments across 40 files (e2e tests, packages/ai, packages/config, packages/config/schema.ts, packages/contracts, packages/core, packages/mcp, packages/test load tests, scripts) — these were suppressing rules that Biome 2.4.4 no longer fires for (snake_case is now allowed for objectLiteralProperty and typeProperty via biome.json conventions). Fixed active Biome violations in 5 files (billing.ts `Variables` suppression, logs.ts catch block format + `_c` rename, instrumentation.ts catch block format, revealui.ts `_status` suppressions). Gate PASS.
- [x] Session 27 (2026-03-01, WSL): **Revvault WSL native binary + .envrc wiring** — Diagnosed WSL interop (Windows EXE) failure: Windows processes don't inherit custom env vars from WSL shell, so age key path fails. Built native WSL ELF binary via `nix shell nixpkgs#cargo nixpkgs#rustc -- cargo build --release`. Installed to `~/.local/bin/revvault`. Identified correct age key at `~/.config/age/keys.txt` (NOT `~/.age-identity/keys.txt` — different key pair). Secret format is `KEY: VALUE` (colon-space) not `KEY=VALUE`. Updated `.envrc` to load 6 vars (PAYLOAD_SECRET, JWT_SECRET, SESSION_SECRET, CRON_SECRET, BETTER_AUTH_SECRET, MCP_ENCRYPTION_KEY) from `revvault get --full | sed 's/: /=/'` before `dotenv_if_exists .env`.
- [x] Session 28 (2026-03-01, WSL): **CMS content CRUD E2E — credentials + initial investigation** — Set CMS admin credentials in Vercel: updated `public.users.password` to bcrypt hash of `ewDV1GawgWL97XjBbcFeGXYMiwVoIui` (CMS reads from `public.users` not `neon_auth.users`). Fixed `global-setup.ts` login URL (`/admin/login` → `/login`). First E2E run: all sign-in tests hit 429 "Too many requests" — rate limit window still active from setup + previous attempts. Root causes identified: (1) `content.e2e.ts` was navigating to `/admin/collections/posts/create` which AdminDashboard ignores (state machine SPA, URL-agnostic), (2) "posts" hidden behind `collections.slice(0,3)` — only first 3 clickable, (3) InMemoryStorage fallback on Vercel due to `ConfigValidationError` in storage factory → non-deterministic per-instance rate limits.
- [x] Session 29 (2026-03-01, WSL): **CMS content CRUD E2E — four root-cause fixes deployed** — Fixed all blockers found in Session 28. (1) `packages/auth/src/server/storage/index.ts`: reads `process.env.DATABASE_URL` directly as fallback when config proxy throws `ConfigValidationError` — DatabaseStorage now used on Vercel with shared `rate_limits` table. (2) `packages/core/src/client/admin/components/AdminDashboard.tsx`: replaced `collections.slice(0,3)` with full list in `max-h-48 overflow-y-auto` container — all 21 collections accessible. (3) `e2e/global-setup.ts`: added `SKIP_GLOBAL_AUTH=1` check — skips global sign-in slot when per-test sign-in handles auth. (4) `e2e/content.e2e.ts`: complete rewrite to click-based navigation (signIn → goToAdmin → click collection button → Create New → fill title → Save → assert "Document created successfully"); removed media upload test (no file input in DocumentForm); removed draft/publish distinction (only "Save" button exists). Commit `c6c0f30d` pushed, Vercel deployment triggered. Awaiting deploy → final E2E run.
- [x] Session 25 (2026-03-01, WSL): **Phase 1.4 structured log pipeline COMPLETE** — Roll-our-own `app_logs` table (migration 0010 applied to production). `packages/db/src/log-transport.ts`: `createDbLogHandler(app)` factory (exported as `@revealui/db/log-transport`). `Logger.addLogHandler()` + child-logger propagation in `@revealui/utils`. API: direct DB transport at startup. API `POST /api/logs`: ingestion endpoint (200/min) for Next.js apps that can't import `@revealui/db` (Edge bundle static tracing). CMS `instrumentation.ts`: fetch-based handler → `POST /api/logs` (no Node-only imports). CMS `/admin/logs` page: filter by app/level, last 200 entries, expandable data. All fixes: unsorted imports (×2), `unknown` ReactNode (`!!row.data`), Edge bundle (`@revealui/db/log-transport` still statically traced → switched to fetch). Commit: 06bd7346.
- [x] Session 30 (2026-03-01, WSL): **CMS content CRUD E2E — two additional root-cause fixes** — (1) Biome excludes `e2e/.auth/`: runtime-generated `user.json` auth state was being flagged by Biome formatter; added `"!e2e/.auth"` to `biome.json` `files.includes` (commit `d8681e71`). (2) `AdminDashboard.handleSave` client-side slug generation: `POST /api/collections/categories` was returning 500 because server-side `beforeValidate` field hook for slug auto-generation doesn't execute through the custom REST handler (`packages/core/src/api/rest.ts` → `revealui.create()`) — confirmed via curl (without slug → 500 "Field 'slug' is required", with explicit slug → 200). Workaround: `handleSave` detects required slug field and generates `data.title.replace(/ /g, '-').replace(/[^\w-]+/g, '').toLowerCase()` before the API call. (3) E2E assertion changed from waiting for success toast text to waiting for "Create New" button reappearance + document title in list — success message is cleared by React 18 state batching before it renders (`handleCollectionClick` synchronously calls `setSuccessMessage(null)` after `handleSave` sets it). Commit `40429f53` pushed; blocked from deploy by Vercel Hobby plan build rate limit (`upgradeToPro=build-rate-limit`). Re-test pending Vercel rate limit reset.
- [x] Session 35 (2026-03-01, WSL): **Studio Suite Integration — full 6-page sidebar + Revvault port complete + cargo check green** — Sidebar restructured to 6 pages (Dashboard, Vault, Infrastructure, Sync, Tunnel, Setup). `onSetup` prop removed from AppShell/Sidebar; Setup promoted to regular nav page. InfrastructurePanel tabbed (App Launcher + DevBox). VaultPanel refactored into sub-components (NamespaceFilter, SecretList, SecretDetail, SearchBar, CreateSecretDialog, useVault hook). SetupWizard extended with 3 new steps (Vault init, Tailscale, Project Setup). SetupPage extended with same 6 sections. TunnelPanel self-contained with 10s polling. MASTER_PLAN.md updated with Studio as unified hub + product table entry. `invoke.ts` updated with all 11 new typed wrappers. `cargo check` green after API correction: `revvault-core` exports `SecretEntry` (not `SecretInfo`), `PassageStore::open(Config)` (not `init()`), `store.get()` returns `SecretString` (needs `expose_secret()`), `set(path, &[u8])` / `upsert(path, &[u8])` (no force param). Added `age = "0.11"`, `secrecy = "0.10"`, `dirs = "6"` direct deps. Removed vault cache from AppState (open-on-demand simpler + correct). Tauri Linux system deps installed via apt (`libwebkit2gtk-4.1-dev`, `libayatana-appindicator3-dev`).
- [x] Session 34 (2026-03-01, WSL): **Studio vault, tunnel, infrastructure pages + Biome fix** — Bug fixes (Session 33 carry-overs): UTF-16LE decoding for `wsl.exe --list --running` output (`decode_utf16le()` helper), tier detection via `mountpoint -q` (no env var), deduplicated status polling via `StatusContext`/`useStatusContext()`. New Rust backend: `commands/vault.rs` (8 commands, `revvault-core` + `arboard`), `commands/tunnel.rs` (3 commands, `tailscale status --json` parsing), `PlatformOps` trait extended with `TailscaleStatus`/`TailscalePeer` structs + 3 new methods. New frontend pages: VaultPanel (init, search, add, copy, delete), TunnelPanel (status, connect/disconnect, peers, 10 s poll), InfrastructurePanel (DevBoxPanel + AppsPanel composite), SetupPage (full-page wizard). Granular vault components: useVault hook, useVault hook, SecretList, SecretDetail, SearchBar, NamespaceFilter, CreateSecretDialog. Biome: added `!**/target` to `files.includes` — Cargo artifacts were causing 442 false lint errors on pre-push gate. Commits: `1354d685`, `c2b0c89a`.
- [x] Session 40 (2026-03-02, WSL): **Phase 2.7 billing funnel unblocked — NEXT_PUBLIC_API_URL fix** — Audited Phase 2.7 billing prerequisites. Found: (1) `stripeCustomerId` migration already existed (`0004`); (2) CORS preflight confirmed: `access-control-allow-origin: https://cms.revealui.com` + `access-control-allow-credentials: true` — no proxy routes needed; (3) Critical bug: `NEXT_PUBLIC_API_URL="https://api.revealui.com\n"` in Vercel — trailing `\n` broke every billing/license fetch call. Fixed with `.trim()` in LicenseProvider, billing page, license page; re-set Vercel env var via CLI (`vercel env rm` + `vercel env add`). Gate PASS, commit `8a452307`. Funnel is now unblocked — ready for end-to-end test.
- [x] Session 39 (2026-03-02, WSL): **Phase 2.4 CLI verified — 8 integration tests + _gitignore fix + dry-run confirmed** — Wrote `packages/cli/src/__tests__/create.test.ts` (8 tests covering template copy, package.json placeholder replacement, .env.local generation, devcontainer/devbox generation, _gitignore→.gitignore rename, src/app layout — all passing, 23 total). Fixed npm tarball bug: npm silently excludes `.gitignore` files; renamed template file to `_gitignore` and updated `copyDir` to rename on copy. `npm pack --dry-run` from `packages/cli/` confirmed: 19 files, 41.7 kB, `bin/`, `dist/`, `templates/minimal/` all present. Remaining Phase 2.4 item blocked: generated project can't `pnpm install` until `@revealui/*` packages published to npm. Gate PASS.
- [x] Session 38 (2026-03-02, WSL): **Phase 2.7 UI feature gating + billing UI complete** — Audited Phase 2.7: most middleware already built but unchecked. Updated MASTER_PLAN with correct status for all completed items. New work: `LicenseGate` client component wraps `useLicense()` — spinner → UpgradePrompt (free tier) → children (Pro/Enterprise). Gated `/admin/monitoring`, `/admin/errors`, `/admin/logs` behind `dashboard` feature (Pro). `UpgradePrompt` component links to `/account/billing`. Fixed pre-existing Biome errors: `noArrayIndexKey` in mainframe Events/Main.tsx, unsorted imports in `packages/cli/src/commands/create.ts`. Gate PASS, 5 commits pushed (`cfef9e6f`). Remaining 2.7 gaps: DB indexes, Pro→Enterprise upgrade flow, CLI license check, Enterprise features.
- [x] Session 37 (2026-03-02, WSL): **Phase 2.1 COMPLETE — Lexical rich text verified in production** — Root cause of all post-deployment build skips: `ignoreCommand` ran from `apps/cms/` (not repo root), making paths like `apps/cms packages` resolve to non-existent locations → git diff exits 0 → skip. Fixed by switching to relative paths (`.` + `../../packages` etc.) and `HEAD~1..HEAD` diff (avoids SHA availability issues). Commits `518a108e` + `be1fa347`. Production DB fixes: `_json` column was missing from `posts` table in the correct NeonDB instance (`ep-solitary-glitter-ahfkee19`, not `ep-bitter-snow-ahixm35n` from `.env`). Added migration `0011_add_posts_json_column.sql` + applied directly. Rich text roundtrip E2E: 2/2 passing — Lexical editor renders in admin UI, post creates with content stored in `_json`, reads back with structure intact. **Phase 2.1 partially complete** (image upload test deferred).
- [x] Session 36 (2026-03-02, WSL): **Phase 1.2 COMPLETE — CMS content CRUD E2E 2/2 passing** — Root cause of all deployment failures since Session 28: `vercel.json` `ignoreCommand` exceeded Vercel's 256-char limit (was 329–475 chars across all 4 apps) causing schema validation failure before any build ran. Fixed by trimming exclusion lists to stay ≤256 chars (commits `302f1097`, `6be8921f`). Second issue: Vercel's shallow clone didn't contain `$VERCEL_GIT_PREVIOUS_SHA` → `git diff` exited 128 → Vercel treated as deployment error. Fixed by wrapping in subshell with `|| exit 1` to normalize all errors to "force build". After CMS deployed commit `6be8921f` (includes fieldHooks server-side, client slug generation, collections list fix, storage fix from Sessions 29–31), content CRUD E2E ran: 2/2 tests passing in 8.7s. **Phase 1.2 complete. Phase 1 complete.**
- [x] Session 31 (2026-03-01, WSL): **Field-level hook execution permanently fixed** — Created `packages/core/src/collections/operations/fieldHooks.ts` (`runBeforeFieldHooks` utility); wired into `create.ts` (beforeValidate before required-field check, beforeChange before INSERT) and `update.ts` (same lifecycle positions before UPDATE). Removed client-side slug workaround from `AdminDashboard.handleSave` (commit `40429f53`). Added 3 new tests (create beforeValidate, create beforeChange, update beforeValidate) — 638 tests passing in `@revealui/core`. Gate PASS. Commits `ee34d58d` + `2fae5482` (Biome format fix for `apps/studio/src-tauri/capabilities/default.json` introduced by concurrent studio scaffold commit). Pending: Vercel deploy + E2E re-run to confirm slug auto-generation works end-to-end without client-side workaround.

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

### WSL Global (`~/.claude/`) — PRIMARY for professional work (fully set up Session 15)
- **Status:** Complete — all rules, hooks, and identity configured
- **Approach:** Separate `~/.claude/` directories for Windows and WSL (never cross-mount)
- **Do NOT cross-mount:** UNC paths (`\\wsl.localhost\...`) break file watchers, git, and symlinks

#### Completed (Sessions 4 + 15)
- [x] `settings.json` — PreToolUse (block .env/lock edits) + PostToolUse (auto-format Biome, auto-sync LTS) + Stop (sprawl check) hooks registered
- [x] `hooks/stop.js` — warns about uncommitted changes + plan sprawl
- [x] `hooks/post-push-lts.js` — auto-sync to LTS drive on git push
- [x] `hooks/pre-tool-use-guard.js` — blocks edits to `.env` and lock files
- [x] `hooks/post-tool-use-format.js` — auto-formats with Biome after Write/Edit in RevealUI
- [x] `rules/planning.md` — single-plan convention
- [x] `rules/typescript.md` — shared TypeScript conventions
- [x] `rules/git.md` — shared git conventions (professional identity)
- [x] `rules/hooks.md` — shared hook development rules
- [x] `CLAUDE.md` — professional identity (founder@revealui.com), RevealUI project context, environment, preferences

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
| `floating-moseying-haven.md` | CMS dark mode/ThemeSelector/component enhancements plan — absorbed into Phase 0.4 + Phase 2.12, deleted Session 15 |
| `purrfect-stirring-ritchie.md` | CMS console errors + email whitelist plan — absorbed into Phase 0.4, deleted Session 15 |
| `shimmering-dazzling-snowglobe.md` | Enterprise enforcement (license middleware A1-A3) — absorbed into Phase 2.7, deleted Session 15 |
| `stateless-weaving-feigenbaum.md` | Stripe seed script plan — absorbed into Phase 0.5 (script already shipped 99825def), deleted Session 15 |
| `wiggly-waddling-kettle.md` | Ship Pro tier plan (WS1-WS6) — absorbed into Phase 0.4/0.5/2.7, deleted Session 15 |
| `~/.claude/plans/temporal-moseying-backus.md` | Revvault master plan — absorbed into Studio Suite section |
| `~/.claude/plans/vast-tinkering-boole.md` | DevKit layered dev environment plan — absorbed into Studio Suite section |
| `~/.claude/plans/humming-weaving-tower.md` | Revvault CLI+Tauri hardening plan — absorbed into Studio Suite section |

---

## Deferred Tasks (invoke manually)

These tasks are removed from the phase schedule. Call upon them explicitly when ready.

### Credential Rotation

Rotate all credentials exposed during the Revvault plaintext migration (the old passage store held secrets in plaintext before `revault migrate` was run). Affected services: Stripe, Supabase, Neon. Also covers replacing `KEY: VALUE` format in the vault with `KEY=VALUE` so `revvault export-env` works cleanly.

**Steps:**
1. Rotate Stripe restricted key: Stripe Dashboard → API keys → create new restricted key → update `STRIPE_SECRET_KEY` in Vercel (CMS + API) → delete old key
2. Rotate Supabase service role key: Supabase Dashboard → Project Settings → API → regenerate service_role key → update all Vercel env vars
3. Rotate Neon password: Neon Dashboard → Branches → main → reset role password → update `POSTGRES_URL` / `DATABASE_URL` / `DIRECT_URL` in all Vercel projects
4. Update vault entries: `revvault edit revealui/env/reveal-saas-dev-secrets` → replace `: ` with `=` in each line → switch `.envrc` to use `eval "$(revault export-env revealui/env/reveal-saas-dev-secrets)"`
5. Verify: `direnv reload` in RevealUI root → env vars load correctly

---

## Review Schedule

- **Weekly:** Check Phase 0 progress, update checkboxes
- **At each phase gate:** Review exit criteria before proceeding
- **Never:** Add items to a phase that isn't current without updating this document first
