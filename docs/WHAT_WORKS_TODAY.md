# What Works Today

> Last verified: 2026-04-16

This page is an honest account of what RevealUI can and can't do right now.
If you're evaluating RevealUI for a project, read this before the marketing page.

---

## What works (high confidence)

These features are built, tested, and we'd bet money on them.

### Admin engine
Full content management engine with collections, access control, hooks, field types,
and a REST API. 287 source files in the core package. This is the heart of RevealUI
and the most mature part of the codebase.

### UI component library
65 native React components built on Tailwind CSS v4. No external UI dependencies
(no Radix, no Headless UI, no shadcn) — just React hooks, clsx, and CVA.
Buttons, forms, modals, tables, toasts, navigation, data display, and layout primitives.

### Database schema
81 PostgreSQL tables with Drizzle ORM. 61 CHECK constraints enforced at the database
level. Dual-database architecture: NeonDB (REST, primary) + Supabase (vectors, auth).
Migration system is working and has been applied to production-grade schemas.

### Rich text editing
Lexical-based rich text editor with custom nodes, serialization, and a plugin system.
Integrated into the admin content management flow.

### Real-time sync
ElectricSQL integration for real-time data synchronization. Proxy, auth, and shapes
verified working in production (Railway to NeonDB). This is the only feature that has
seen real production traffic.

### CLI scaffolding
`create-revealui` published to npm (@0.3.4). Bootstraps a new RevealUI project with
working config, database setup, and development server.

### CI and code quality
3-phase CI gate (lint, typecheck, test, build). 26,000+ test cases across 1,451 test
files. CodeQL and Gitleaks in CI. Biome for linting and formatting (no ESLint/Prettier).
Pre-push gate on protected branches.

---

## What works (medium confidence)

These features are built and tested but have not been verified with real users or
real production traffic. The code exists and passes tests, but edge cases may surface
under real-world conditions.

### Authentication
Session-based auth with bcrypt (12 rounds), brute-force protection, and rate limiting.
Password reset flow exists. OAuth scaffolded but not verified with real providers.
**Not yet tested with real users.**

### Stripe payments
Webhook handlers for `checkout.session.completed`, license key generation, revocation
tracking, and a DB-backed circuit breaker. Stripe is in test mode — live mode has not
been activated or verified. **The billing lifecycle (signup to cancel to refund) has not
been tested end-to-end.**

### REST API
Hono-based API with OpenAPI spec generation, Swagger docs, authentication middleware,
rate limiting, CSRF protection, and 120+ route files. Serves the admin dashboard.
**Has not handled production traffic from external users.**

### AI agent system
LLM provider abstraction, CRDT-based memory, tool registry, streaming runtime, and
orchestration layer. Supports Ollama (local) and cloud providers.
**Untested in production. The agent system works in development but has not been
stress-tested with real workloads or real users.**

### Security
RBAC + ABAC policy engine (58 enforcement tests), AES-256-GCM encryption,
Content Security Policy headers, CORS, HSTS, rate limiting, webhook rate limiting,
and GDPR compliance utilities (consent, deletion, export, anonymization).
**Security has been audited 7 times internally but has not undergone a professional
penetration test.**

### License enforcement
JWT-based licensing with tier checks (free/pro/max/enterprise), feature gating,
grace periods (3-day subscription, 30-day perpetual, 7-day infrastructure), and
revocation via DB status checks. Perpetual and subscription models supported.
**License generation and enforcement work in tests. Not yet tested with real
paying customers.**

---

## What doesn't work yet

Honest list of things that are not done, not deployed, or not verified.

- **Zero real users.** No one outside the development team has used RevealUI in
  production. The admin account exists for testing only.
- **No deployed marketing site.** The marketing app exists in the repo but is not
  deployed to a public URL.
- **No deployed documentation site.** Same — the docs app exists but is not live.
- **No email delivery.** Email sending is configured for Gmail API but has not been
  tested with real recipients.
- **No waitlist.** The waitlist form exists in the marketing app but is not connected
  to a real database in production.
- **Stripe is in test mode.** No real money has been processed. The live-mode billing
  lifecycle is the next infrastructure milestone.
- **No status page promises.** Uptime monitoring is configured but the status page
  has not been publicly advertised.
- **No support channel.** There is no public support email, chat, or ticketing system
  for customers yet.
- **No Terms of Service or Privacy Policy.** Legal documents are pending lawyer review.
- **No SOC2 or ISO 27001.** Security certifications are planned for Phase 6, not
  current.

---

## Numbers

| Metric | Value | Verified |
|--------|-------|----------|
| Workspaces (apps + packages) | 31 | Yes |
| Source files (core engine) | 287 | Yes |
| UI components | 65 | Yes |
| Database tables | 81 | Yes |
| Database CHECK constraints | 61 | Yes |
| Test cases | 26,000+ | Yes |
| Test files | 1,451 | Yes |
| API route files | 120+ | Yes |
| CodeQL alerts | 0 | Yes (as of 2026-04-12) |
| Dependabot alerts | 0 | Yes (as of 2026-04-12) |
| Commits | 2,410+ | Yes |
| Real production users | 0 | Yes |

---

## How to verify

RevealUI is open source (MIT core). Every claim on this page can be verified:

```bash
git clone https://github.com/RevealUIStudio/revealui
cd revealui
pnpm install
pnpm gate        # Run the full CI gate locally
pnpm test        # Run all 26,000+ tests
pnpm typecheck:all  # Typecheck all 31 workspaces
```

If something on this page doesn't match what you see in the code, file an issue.
