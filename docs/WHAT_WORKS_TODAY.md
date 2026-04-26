# What Works Today

> Last verified: 2026-04-26

This page is an honest account of what RevealUI can and can't do right now.
If you're evaluating RevealUI for a project, read this before the marketing page.

---

## What works (high confidence)

These features are built, tested, and we'd bet money on them.

### Admin engine
Full content management engine with collections, access control, hooks, field types,
and a REST API. The heart of RevealUI and the most mature part of the codebase.

### UI component library
**57 native React components** in `packages/presentation/src/components/`, built on Tailwind CSS v4. No external UI dependencies (no Radix, no Headless UI, no shadcn) — just React hooks, clsx, and CVA. Buttons, forms, modals, tables, toasts, navigation, data display, and layout primitives.

### Database schema
**85 PostgreSQL tables** with Drizzle ORM. NeonDB is the primary database (REST + agent memories via pgvector). Supabase is an optional sidecar today (RAG chunks + a legacy duplicate billing copy); Phase 7 in the roadmap consolidates RAG onto NeonDB pgvector and retires the Supabase dependency. ElectricSQL is an optional sync layer (off by default).

### Rich text editing
Lexical-based rich text editor with custom nodes, serialization, and a plugin system.
Integrated into the admin content management flow.

### Real-time sync (optional)
ElectricSQL integration for real-time data synchronization. Proxy, auth, and shapes
have been verified working between Railway and NeonDB. Off by default — opt-in via env vars when you want it.

### CLI scaffolding
**`create-revealui` published to npm at v0.5.5**. `@revealui/cli` is at v0.7.0. Bootstraps a new RevealUI project with working config, database setup, and development server.

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
Webhook handlers for `checkout.session.completed`, `customer.subscription.updated`, license key generation, revocation tracking, and a DB-backed circuit breaker. **Stripe runs in TEST MODE in production** — `STRIPE_LIVE_MODE` toggle exists, but the flip is gated on the internal billing-readiness audit (GAP-124). The full subscription lifecycle (signup to cancel to refund) has been exercised in test mode end-to-end; live-mode lifecycle is gated on the audit.

### REST API
Hono-based API with OpenAPI spec generation, Swagger docs, authentication middleware,
rate limiting, CSRF protection, and 120+ route files. Serves the admin dashboard. Deployed to `api.revealui.com`. **Has not handled production traffic from paying users.**

### AI agent system
LLM provider abstraction (default: Ollama; opt-in: Groq, Vultr, HuggingFace, OpenAI-compatible), CRDT-based memory (`WorkingMemory`, `EpisodicMemory`, `SemanticMemory`, `ProceduralMemory`), tool registry, streaming runtime, and orchestration layer. Embeddings default to Ollama `nomic-embed-text` (768 dim). Pro packages (`@revealui/ai`, `@revealui/harnesses`) are Fair Source / FSL-1.1-MIT.
**Untested in production. The agent system works in development; not yet stress-tested with real workloads or paying users.**

### Security
RBAC + ABAC policy engine (50+ enforcement tests), AES-256-GCM encryption,
Content Security Policy headers, CORS, HSTS, rate limiting, webhook rate limiting, audit-log framework, and GDPR compliance utilities (consent, deletion, export, anonymization).
**Security has been audited internally multiple times. A professional penetration test is on the pre-launch checklist; KEK rotation tooling is tracked as an open gap (GAP-126) — until that ships, KEK rotation requires a coordinated maintenance window.**

### License enforcement
JWT-based licensing (RS256, server-side only — distinct from user-facing auth which is session-only) with tier checks (free / pro / max / enterprise), feature gating, grace periods (3-day subscription, 30-day perpetual, 7-day infrastructure), and revocation via DB status checks. Perpetual and subscription models supported.
**License generation and enforcement work in tests. Not yet tested with paying customers.**

---

## What doesn't work yet

Honest list of things that are not done, not deployed, or not verified.

- **Zero paying customers.** Pre-launch posture. The admin account exists for the studio's own use.
- **Marketing site is live but external traffic is near-zero.** Deployed at [revealui.com](https://revealui.com); near-zero outside-the-team traffic to date.
- **Docs site is live but external traffic is near-zero.** Deployed at [docs.revealui.com](https://docs.revealui.com); same caveat.
- **No managed hosting service.** RevealUI Studio's own marketing site runs on Vercel; we do not (today) offer to host customer instances. Self-host (Vercel, Railway, Docker, Forge kit when GHCR images publish) is the path.
- **Forge Docker images not yet published to GHCR.** The `docker/` stack and stamp scripts are production-ready, but the images at `ghcr.io/revealuistudio/revealui-{api,admin}` have not yet been published. Until then, Forge customers build from source.
- **Stripe is in TEST MODE in production.** No real money has been processed. The live-mode flip is gated on the billing-readiness audit (GAP-124) closing.
- **REVEALUI_KEK rotation tooling is not yet built** (GAP-126 open). KEK rotation requires a coordinated maintenance window with manual data re-encryption today.
- **No status page publicly advertised.** Uptime monitoring is configured.
- **No public support channel.** There is no public support email, chat, or ticketing system yet.
- **No Terms of Service or Privacy Policy.** Legal documents are pending lawyer review.
- **No SOC2 or ISO 27001.** Security certifications are planned for Phase 6, not current.
- **MCP marketplace is preview, not live.** Publish/list/invoke/onboard endpoints are wired; payouts open with the billing-readiness audit.
- **No SSO / SCIM in code.** Roadmap items.
- **No dunning logic.** Best-practice guidance only.
- **No Prompts CMS collection.** admin ships Pages, Posts, Products, Contents, Videos, Tenants — no Prompts.

---

## Numbers

| Metric | Value | Verified |
|--------|-------|----------|
| Workspaces (apps + packages) | 30 | Yes |
| Apps | 5 (`admin`, `api`, `docs`, `marketing`, `revealcoin`) | Yes |
| OSS packages (MIT) | 22 | Yes |
| Pro packages (FSL-1.1-MIT) | 3 (`ai`, `harnesses`, `engines`) | Yes |
| UI components (`@revealui/presentation`) | 57 | Yes |
| Database tables | 85 | Yes (run `grep -h 'pgTable(' packages/db/src/schema/*.ts \| wc -l`) |
| MCP servers (`packages/mcp/src/servers/`) | 13 | Yes |
| Test cases | run `pnpm test` for current count | Reproducible |
| Test files | run `find . -name "*.test.ts*" -not -path "*/node_modules/*"` | Reproducible |
| API route files | 120+ | Approximate |
| Real production users | 0 | Yes |

---

## How to verify

RevealUI is open source (MIT for OSS packages, FSL-1.1-MIT → MIT-after-2-years for Pro packages). Every claim on this page can be verified:

```bash
git clone https://github.com/RevealUIStudio/revealui
cd revealui
pnpm install
pnpm gate                # Run the full CI gate locally
pnpm test                # Run the full test suite
pnpm typecheck:all       # Typecheck all 31 workspaces
pnpm validate:claims     # Run the marketing/docs claim-drift gate
```

If something on this page doesn't match what you see in the code, file an issue.
