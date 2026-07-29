---
title: "What Works Today"
description: "This page is an honest account of what RevealUI can and can't do right now."
visibility: public
status: verified
audience: user
---

> Last verified: 2026-07-22

This page is an honest account of what RevealUI can and can't do right now.
If you're evaluating RevealUI for a project, read this before the marketing page.

---

## What works (high confidence)

These features are built, tested, and we'd bet money on them.

### Admin engine
Full content management engine with collections, access control, hooks, field types,
and a REST API. The heart of RevealUI and the most mature part of the codebase.

### UI component library
**65 native React components in `@revealui/presentation`** (plus admin and rich-text UI in `@revealui/core`), built on Tailwind CSS v4. No external UI dependencies (no Radix, no Headless UI, no shadcn). Just React hooks, clsx, and CVA. Buttons, forms, modals, tables, toasts, navigation, data display, and layout primitives.

### Database schema
**97 PostgreSQL tables** with Drizzle ORM, **81 CHECK constraints** enforced at the database level. NeonDB is the sole primary database (REST, agent memories, and RAG via pgvector on Neon). Supabase is not an internal datastore (ADR `2026-05-01-supabase-removal`); the customer-facing Supabase MCP adapter was removed (use Neon MCP). ElectricSQL is an optional sync layer (off by default).

### Rich text editing
Lexical-based rich text editor with custom nodes, serialization, and a plugin system.
Integrated into the admin content management flow.

### Real-time sync (optional)
ElectricSQL integration for real-time data synchronization. Proxy, auth, and shapes
have been verified working between Fly and NeonDB. Off by default — opt-in via env vars when you want it.

### CLI scaffolding
**`create-revealui` published to npm at v0.5.15**. `@revealui/cli` is at v0.9.2. Bootstraps a new RevealUI project with working config, database setup, and development server.

### CI and code quality
3-phase CI gate (lint, typecheck, test, build) with an extensive test suite across
unit, integration, and E2E layers. CodeQL and Gitleaks in CI. Biome for linting and formatting (no ESLint/Prettier). Pre-push gate on protected branches. The marketing site also runs a claim-drift gate that hard-fails on aspirational copy without qualifiers.

---

## What works (medium confidence)

These features are built and tested but have not been verified with real users or
real production traffic. The code exists and passes tests, but edge cases may surface
under real-world conditions.

### Authentication
Session-based auth (no JWT for user-facing auth, per [ADR-004](./architecture/ADR-004-session-only-auth.md)) with bcrypt (12 rounds), brute-force protection (database-backed), and rate limiting (database-backed). Password reset flow with email delivery via Gmail API. OAuth scaffolded for GitHub / Google / Vercel.
**Not yet tested with paying users.**

### Stripe payments
Webhook handlers for `checkout.session.completed`, `customer.subscription.updated`, license key generation, revocation tracking, and a DB-backed circuit breaker. **Stripe live mode is ON in production** (flipped 2026-06-26 after the internal billing-readiness audit closed). The full subscription lifecycle (signup to cancel to refund) was exercised end-to-end in test mode before the flip.

### REST API
Hono-based API with OpenAPI spec generation, Swagger docs, authentication middleware,
rate limiting, CSRF protection, and route handlers across `apps/server/src/routes`. Serves the admin dashboard. Deployed to `api.revealui.com`. **Has not handled production traffic from paying users.**

### AI agent system
LLM provider abstraction (default: Ollama; opt-in: Groq, HuggingFace, OpenAI-compatible), CRDT-based memory (`WorkingMemory`, `EpisodicMemory`, `SemanticMemory`, `ProceduralMemory`), tool registry, streaming runtime, and orchestration layer. Embeddings default to Ollama `nomic-embed-text` (768 dim). Pro packages (`@revealui/ai`, `@revealui/engines`, `@revealui/harnesses`, `@revealui/mcp`, `@revealui/services`) are Fair Source / FSL-1.1-MIT.
**Untested in production. The agent system works in development; not yet stress-tested with real workloads or paying users.**

### Security
RBAC + ABAC policy engine (50+ enforcement tests), AES-256-GCM encryption,
Content Security Policy headers, CORS, HSTS, rate limiting, webhook rate limiting, audit-log framework, and GDPR compliance utilities (consent, deletion, export, anonymization).
**Security has been audited internally multiple times. A professional penetration test is on the pre-launch checklist; KEK rotation tooling ships in `scripts/security/rotate-kek.ts` (zero-downtime dual-key path).**

### License enforcement
JWT-based licensing (EdDSA/Ed25519, server-side only — distinct from user-facing auth which is session-only) with tier checks (free / pro / max / enterprise), feature gating, grace periods (3-day subscription, 30-day perpetual, 7-day infrastructure), and revocation via DB status checks. Perpetual and subscription models supported.
**License generation and enforcement work in tests. Not yet tested with paying customers.**

---

## What doesn't work yet

Honest list of things that are not done, not deployed, or not verified.

- **Zero paying customers.** Pre-launch posture. The admin account exists for the studio's own use.
- **Marketing site is live but external traffic is near-zero.** Deployed at [revealui.com](https://revealui.com); near-zero outside-the-team traffic to date.
- **Docs site is live but external traffic is near-zero.** Deployed at [docs.revealui.com](https://docs.revealui.com); same caveat.
- **No managed hosting service.** RevealUI Studio's own marketing site runs on Vercel; we do not (today) offer to host customer instances. Self-host (Vercel, Cloudflare, Fly, Hetzner, Docker, Fleet kit when GHCR images publish) is the path. Vercel and Cloudflare are friendly deploy targets, not competitors.
- **Fleet Docker images not yet published to GHCR.** The `docker/` stack and stamp scripts are production-ready, but the images at `ghcr.io/revealuistudio/revealui-{api,admin}` have not yet been published. Until then, Fleet customers build from source.
- **Stripe live mode is ON in production** (flipped 2026-06-26 after the billing-readiness audit closed).
- **REVEALUI_KEK rotation tooling ships** (`scripts/security/rotate-kek.ts`) — zero-downtime dual-key rotation; see the credential-rotation runbook.
- **No status page publicly advertised.** Uptime monitoring is configured.
- **No public support channel.** There is no public support email, chat, or ticketing system yet.
- **Terms of Service and Privacy Policy are live, but not yet lawyer-reviewed.** Drafted in good faith by RevealUI Studio and published at [/terms](https://revealui.com/terms) and [/privacy](https://revealui.com/privacy). Each page carries an explicit "draft pending counsel review" banner — we disclose this rather than hide it. Counsel review is scheduled post-first-revenue. Subscription prices are referenced as "published at /pricing at the time of purchase" rather than hardcoded, so the pricing page is the single source of truth.
- **No SOC2 or ISO 27001.** Security certifications are planned for Phase 6, not current.
- **MCP marketplace is preview, not live.** Publish/list/invoke/onboard endpoints are wired; third-party developer payouts are not fully shipped yet.
- **No SSO / SCIM in code.** Roadmap items.
- **No dunning logic.** Best-practice guidance only.
- **No Prompts collection.** admin ships Pages, Posts, Products, Contents, Videos, Tenants — no Prompts.

---

## Numbers

| Metric | Value | Verified |
|--------|-------|----------|
| Workspaces (apps + packages) | 33 | Yes |
| Apps | 4 (`admin`, `server`, `docs`, `marketing`) | Yes |
| OSS packages (MIT) | 23 | Yes |
| Pro packages (FSL-1.1-MIT) | 5 (`ai`, `engines`, `harnesses`, `mcp`, `services`) | Yes |
| Internal packages | 1 (`@revealui/scripts`, unlicensed build tooling) | Yes |
| UI components | 65 in `@revealui/presentation` | Yes |
| Database tables | 97 | Yes (run `grep -h 'pgTable(' packages/db/src/schema/*.ts \| wc -l`) |
| CHECK constraints | 81 | Yes (run `grep -rh 'check(' packages/db/src/schema/*.ts \| wc -l`) |
| MCP servers | 13 | Yes (run `ls packages/mcp/src/servers/*.ts` and count non-`_` files) |
| Test cases | run `pnpm test` for current count | Reproducible |
| Test files | run `find . -name "*.test.ts*" -not -path "*/node_modules/*"` | Reproducible |
| API route files | run `find apps/server/src/routes -name '*.ts' -not -name '*.test.ts' \| wc -l` | Reproducible |
| Real production users | 0 | Yes |

> Counting rules (enforced in CI by `pnpm validate:claims`, canonical values in `apps/marketing/app/content/site.ts` `METRICS`): **UI components** counts `.tsx` files in `packages/presentation/src/components/` excluding `_`-prefixed helpers. **MCP servers** counts `.ts` files in `packages/mcp/src/servers/` excluding `index*` and `_`-prefixed helpers, which includes the `adapter.ts` framework module (so the honest total is 14, not 13). **Workspaces** counts `packages/*` plus `apps/*` that carry a `package.json`. **Database tables** counts `pgTable(` declarations; the **license split** is read from each `packages/*/package.json` `license` field.

---

## How to verify

RevealUI is open source (MIT for OSS packages, FSL-1.1-MIT → MIT-after-2-years for Pro packages). Every claim on this page can be verified:

```bash
git clone https://github.com/RevealUIStudio/revealui
cd revealui
pnpm install
pnpm gate                # Run the full CI gate locally
pnpm test                # Run the full test suite
pnpm typecheck:all       # Typecheck all 36 workspaces
pnpm validate:claims     # Run the marketing/docs claim-drift gate
```

If something on this page doesn't match what you see in the code, file an issue.
