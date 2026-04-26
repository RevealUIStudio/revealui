---
title: "Roadmap"
description: "Product roadmap with planned features, timelines, and priorities"
category: planning
audience: developer
---

# RevealUI Roadmap

> Agentic business runtime. Build your business, not your boilerplate.

This roadmap reflects our current priorities and planned direction. It is updated regularly and may shift based on community feedback and business needs.

**Last updated:** 2026-04-10

---

## Suite Product Maturity

Honest labels for every product in the RevealUI ecosystem. Updated 2026-04-10.

| Product | Maturity | Notes |
|---------|----------|-------|
| **RevealUI** (monorepo) | Beta | Deployed, 26 npm packages, extensive test suite. No paying users yet. |
| **Forge** (self-hosted) | Beta | Docker stack complete, license enforcement built. No external customers. |
| **RevVault** (secrets) | Beta | Rust CLI + desktop app, age-encrypted vault. Not published to crates.io. |
| **Studio** (desktop) | Alpha | Tauri 2 + React 19, agent coordination UI. No published binaries. |
| **Terminal** (TUI) | Alpha | Go SSH server + Bubble Tea. Functional, not deployed. |
| **RevCon** (configs) | Alpha | Editor config sync tooling. Functional, undocumented. |
| **RevealCoin** (token) | Alpha | Solana devnet proof-of-concept. Not on mainnet. |
| **RevSkills** (skills) | Alpha | 6 Claude Code skills on GitHub. No tests. |
| **RevDev** (dev tools) | Planned — [#451](https://github.com/RevealUIStudio/revealui/issues/451) | Harness infrastructure exists. Not a standalone product yet. |
| **RevMarket** (marketplace) | Planned — [#451](https://github.com/RevealUIStudio/revealui/issues/451) | Database schema defined. No API routes or UI. |
| **RevKit** (templates) | Planned — [#451](https://github.com/RevealUIStudio/revealui/issues/451) | Design documented. Stub implementation. |

**Labels:** Production = real users + stable API. Beta = feature-complete, deployed, pre-users.
Alpha = functional, not deployed/published. Planned = design or schema only.

---

## Completed

### Core Platform (v0.2  -  v0.3)

- **Auth system**  -  Session-based auth with bcrypt, RBAC/ABAC, rate limiting, brute-force protection, TOTP 2FA _(infrastructure built, not yet wired into sign-in flow)_, WebAuthn passkeys, magic link recovery, OAuth (GitHub, Google, Vercel) _(note: sessions are not currently bound to IP/UA)_
- **Content engine**  -  Schema-first collections, Lexical rich text, media handling, draft/live lifecycle, REST API with OpenAPI spec
- **Billing stack**  -  Stripe checkout, subscriptions, webhooks, license keys, billing portal, tier enforcement (free/pro/max/forge)
- **UI components**  -  57 native React 19 components (Tailwind v4, zero external UI deps)
- **Real-time sync**  -  ElectricSQL integration for editor/client/agent sync _(experimental  -  basic shape subscriptions, no offline-first)_
- **Database**  -  85 tables via Drizzle ORM, dual-DB architecture (NeonDB + Supabase)
- **CLI**  -  `npx create-revealui my-app` scaffolds a full project from npm
- **AI agents**  -  A2A protocol, CRDT memory, open-model inference, streaming, tool execution
- **MCP servers**  -  13 first-party servers under `packages/mcp/src/servers/` (Stripe, Neon, Supabase, Vercel, Playwright, Code Validator, Next.js DevTools, RevealUI Content / Email / Memory / Stripe, Vultr Test, plus the adapter base class)
- **Desktop app (RevDev)**  -  Tauri 2 + React 19 native AI experience (agent hub, local inference, vault, tunnel) — ships in the separate [RevDev](https://github.com/RevealUIStudio/revdev) repo, not in the RevealUI monorepo
- **Security**  -  CSP, CORS, HSTS, AES-256-GCM encryption, timing-safe TOTP, GDPR framework, 187 security tests
- **CI/CD**  -  3-phase gate (lint + typecheck + test + build), CodeQL, Gitleaks, OIDC npm publishing
- **Accessibility**  -  WCAG 2.1 AA compliance on marketing site and admin login/admin pages

### Launch (v0.3.3  -  current)

- **Public repo** on GitHub with MIT license (OSS packages)
- **26 packages** published to npm
- **4 template repos** (basic-blog, e-commerce, portfolio, starter)
- **Production deploys**  -  admin, API, Marketing, Docs on Vercel
- **Stripe test mode** verified end-to-end (checkout, webhooks, license generation)

---

## Ecosystem

RevealUI is the runtime at the center of a four-project ecosystem. Each project stands alone. Together, they form a complete stack for building, securing, coordinating, and monetizing agentic software.

| Project | Purpose | License |
|---------|---------|---------|
| **RevealUI** | Agentic business runtime (this repo) | MIT (core) + Commercial (Pro) |
| **[RevVault](https://github.com/RevealUIStudio/revvault)** | Age-encrypted secret vault  -  Rust CLI, rotation engine, Tauri desktop app | MIT (CLI) + Pro (desktop, rotation) |
| **[RevKit](https://github.com/RevealUIStudio/revkit)** | Portable dev environment toolkit  -  WSL provisioning, agent coordination protocol | MIT (agent coordination) + Max (provisioning) |
| **RevealCoin** | Solana token for x402 agent micropayments  -  agents pay per task via HTTP 402 | Forge |

**Dependency direction:** RevVault depends on nothing. RevKit integrates RevVault via its secret bridge. RevealUI consumes environment variables however they arrive. RevealCoin powers the agent payment layer.

---

## In Progress

### Post-Launch Polish (v0.4)

| Task | Status | Description |
|------|--------|-------------|
| CORS hardening | Done | Manual CORS middleware replacing Hono's `cors()` for Vercel compatibility |
| Accessibility audit | Done | WCAG 2.1 AA color contrast fixes across marketing site |
| E2E test stability | Done | Playwright CI browser config, navigation race fixes |
| Stripe live mode | Pending | Switch from test to live keys after full UX verification |
| Skipped test audit | Done | 4 fixable skips unskipped (performance tests), 35 conditional infra skips verified correct |
| Claim verification | Done | Audit all marketing and docs text against codebase reality |
| Public roadmap | Done | This document |

---

## Planned

### Near-Term (Q2 2026)

#### admin Dashboard Agent Chat
Give users the ability to interact with an AI agent directly from the admin dashboard. Ask it to create content, query data, manage collections, and automate workflows  -  all through natural language.

- Streaming responses with markdown rendering
- admin-aware tools (create/update/delete posts, query collections, manage users)
- Conversation history and persistence
- Confirmation prompts for destructive actions

#### Documentation Improvements
- Deploy docs site to `docs.revealui.com`
- Expand quick-start guide with video walkthroughs
- API reference for all packages
- Collection cookbook with common patterns

#### Ecosystem Integration — [#528](https://github.com/RevealUIStudio/revealui/issues/528)
- RevVault desktop app integration in Studio _(already built: `VaultPanel.tsx` connects via Tauri to RevVault)_
- RevVault rotation engine as a Pro feature  -  automated credential lifecycle management. _Currently: 5 interactive rotation shell scripts ship at `~/suite/.jv/scripts/rotation/` (neon, revealui-secret, stripe-webhook, probe-current-values, probe-mcp-api-key); Rust workspace at `~/suite/revvault/` ready to absorb them as a first-class subsystem._
- RevKit agent coordination protocol extraction as `@revealui/workboard`  -  MIT standalone package. _Currently: implementation lives inside `@revealui/harnesses` (FSL-1.1-MIT Pro) at `packages/harnesses/src/workboard/`; extraction brings it in line with the PRO.md declaration that RevKit agent coordination is MIT-free._
- Unified ecosystem messaging across marketing, docs, and pricing surfaces _(drift-control work, not a new feature)_

#### Developer Experience — [#535](https://github.com/RevealUIStudio/revealui/issues/535)
- `create-revealui` template improvements (more starters, better defaults). _Currently: `@revealui/cli` ships 4 templates (`basic-blog`, `e-commerce`, `portfolio`, `starter`) at `packages/cli/templates/`; bullet covers template audit + one new opinionated-SaaS starter + smoother prompts + post-init onboarding._
- Hot module reload improvements for admin development. _Currently: admin runs Next.js 16 with Turbopack configured; bullet covers baseline measurement + collection-definition HMR + RichText plugin HMR + dev-startup optimization._
- Better error messages and debugging output. _Currently: `packages/core/src/error-handling/` ships boundaries + reporter + fallbacks + Sentry wired per §CR-8 Phase 1; bullet covers user-facing error audit + opaque → actionable rewrites + structured `DEBUG=revealui:*` namespaces + API error-envelope consistency._
- Plugin system documentation. _Currently: Plugin API lives at `packages/core/src/types/plugins.ts` with 3 first-party plugins (`form-builder`, `nested-docs`, `redirects`) but no dedicated `docs/PLUGINS.md`; bullet closes that documentation gap._

### Mid-Term (Q3 2026)

#### Agent Marketplace — [#526](https://github.com/RevealUIStudio/revealui/issues/526)
A registry where developers can publish and discover MCP servers and AI agent capabilities. Revenue share model (80% developer / 20% platform). _Currently: MCP Server Marketplace (Phase 5.5) and RevMarket autonomous-agent layer (Phase 5.16) are both substantially built — schemas, API routes, admin UI, Stripe Connect payouts, x402 payment middleware, developer docs — but x402 is disabled by default and live charging is gated on §CR-8 A-grade achievement and Stripe live-mode switch._

#### Multi-User Collaboration — [#514](https://github.com/RevealUIStudio/revealui/issues/514)
Real-time multi-user editing powered by ElectricSQL. Currently basic shape subscriptions and Yjs CRDT foundation exist (experimental). Full conflict resolution, presence indicators, and collaborative workflows are planned.

#### Forge Features — [#515](https://github.com/RevealUIStudio/revealui/issues/515)
- SSO/SAML authentication — tracked separately in [#449](https://github.com/RevealUIStudio/revealui/issues/449)
- Advanced audit logging
- Custom RBAC policy editor
- Multi-region deployment support
- SLA guarantees

#### Self-Hosted (Forge Edition) — [#515](https://github.com/RevealUIStudio/revealui/issues/515)
Docker images for fully self-hosted deployment. Domain-locked licensing, air-gap capable. _Currently: Docker Compose stack and K8s manifests exist as infrastructure skeletons. SSO, white-label theming, and deployment guide are not yet implemented._

### Long-Term (Q4 2026+)

#### Visual Builder
A no-code visual builder for creating RevealUI sites. Drag-and-drop page building, component customization, and one-click deployment.

#### SOC2 Type II Compliance — [#516](https://github.com/RevealUIStudio/revealui/issues/516)
Forge security certification for teams that require it.

#### RevealCoin + x402 Agent Payments
Native cryptocurrency micropayments powered by RevealCoin on the Solana blockchain. Agents discover, authenticate, and pay per task via the HTTP 402 payment protocol  -  no accounts, no subscriptions.

---

## Pricing Tracks

RevealUI offers four ways to pay:

| Track | Model | Description |
|-------|-------|-------------|
| **A  -  Subscriptions** | Monthly | Free / Pro $49/mo / Max $149/mo / Forge $299/mo |
| **B  -  Agent Credits** | Pay-per-use | $0.001/task, first 1,000 tasks/month free (local inference) |
| **C  -  Perpetual** | One-time | $299 / $799 / $1,999 (1 year support included, renewable) |
| **D  -  Professional Services** | Per-engagement | Architecture review, migration assist, launch package, consulting hours |

Ecosystem features by tier: RevVault desktop app + rotation engine (Pro), RevKit environment provisioning (Max), RevealCoin x402 agent payments (Forge).

See [revealui.com/pricing](https://revealui.com/pricing) for details.

---

## How to Influence This Roadmap

- **GitHub Issues**  -  [Request features or report bugs](https://github.com/RevealUIStudio/revealui/issues)
- **Discussions**  -  [Join the conversation](https://github.com/RevealUIStudio/revealui/discussions)
- **Community**  -  [revnation.discourse.group](https://revnation.discourse.group)
- **Email**  -  support@revealui.com

We prioritize based on: customer impact, charge readiness, and community demand.
