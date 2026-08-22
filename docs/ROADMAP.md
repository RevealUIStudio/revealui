---
visibility: public
status: verified
title: "RevealUI Roadmap"
description: "Product roadmap with shipped surfaces, current work, and planned direction"
category: planning
audience: developer
---

> Agentic business runtime. Build your business, not your boilerplate.

This roadmap is an honesty document. It names what ships today, what is in flight, and what is planned. It is not a sales forecast.

**Last updated:** 2026-08-20

This file is the customer-facing board. Capability status and counts: [What Works Today](./WHAT_WORKS_TODAY.md).

---

## RevFleet product maturity

Labels match the `/products` page.

| Product | Maturity | Notes |
|---------|----------|-------|
| **RevealUI** (monorepo) | Beta | Deployed (admin, API, marketing, docs). 32 packages. No external paying customers yet. |
| **RevealUI Fleet** (self-hosted kit) | Alpha | Compose + license enforcement exist. GHCR images build and push. The launched pull-and-run customer kit is not a finished product. |
| **RevVault** | Beta | Rust CLI + desktop app. Age-encrypted vault. Not published to crates.io. |
| **RevDev** | Alpha | Studio (Tauri) + Console (Go TUI) + local daemon. Ships in [RevDev](https://github.com/RevealUIStudio/revdev). Public binaries are not a GA release. |
| **RevCon** | Active (MIT) | Editor config sync. Released library, no SLA. |
| **RevSkills** | Active (MIT) | Agent skills library on GitHub. |
| **RevForge** | Alpha | Operator stamping tool. Private preview. |
| **RevMarket** | Planned | First-party MCP catalog ships with the runtime. Third-party marketplace and live agent charging are not open. |

**Labels:** Production = real external users + a stable contract. Beta = production-ready code, deployed and dogfooded, pre-revenue. Alpha = works and ships, may break. Active (MIT) = released library, no SLA. Planned = not shipped to users.

---

## Shipped

### Runtime

- **Auth.** Session auth (bcrypt, RBAC/ABAC, rate limiting, brute-force protection), TOTP MFA wired into the admin sign-in challenge, WebAuthn passkeys, magic-link recovery, OAuth (GitHub, Google, Vercel)
- **Content engine.** Schema-first collections, Lexical rich text, media, draft/live lifecycle, REST API with OpenAPI
- **Billing.** Stripe checkout, subscriptions, webhooks, license keys, billing portal, free/pro/max/enterprise gates. **Stripe live mode is ON** (flipped 2026-06-26). That is a billing-rail fact, not a claim that strangers are buying.
- **Perpetual licenses.** Track C checkout is available
- **UI.** 66 native React components in `@revealui/presentation` (Tailwind v4, no Radix/Headless UI/shadcn)
- **Database.** 104 Postgres tables via Drizzle on Neon. ElectricSQL is an optional sync layer (off by default)
- **CLI.** `npx create-revealui@latest my-app` plus 5 templates (basic-blog, e-commerce, portfolio, starter, starter-native)
- **Agents.** A2A, CRDT memory, open-model default, streaming, tool execution. Hosted runs use the account's saved provider key (BYOK) or a local model. RevealUI does not host a shared frontier key as the product default. An entitled Pro account walked save-key plus Send Task plus Watch live on production (2026-08-18). That is one operator walk, not a paying-customer load test.
- **MCP.** 13 first-party servers under `packages/mcp/src/servers/` (includes the adapter module)
- **Audit receipts.** Signed audit log. Max can download Merkle roots
- **Docs + marketing.** docs.revealui.com and revealui.com, including `/support`, `/status`, `/claims`, and `/roadmap`

### Launch surfaces

- Public GitHub repo (MIT for OSS packages, FSL-1.1-MIT for Pro)
- Production deploys: admin, API, marketing, docs
- GHCR images `ghcr.io/revealuistudio/revealui-{api,admin,migrate}` build and push from CI. A stamped kit still needs a license JWT and operator env

---

## Now

Work that is real and unfinished. No gap IDs on this public page.

| Item | Status | Honest residual |
|------|--------|-----------------|
| Enterprise SSO / SAML | In flight | Operator preview on test (OIDC + SAML SP-initiated). Not customer-walked. [#449](https://github.com/RevealUIStudio/revealui/issues/449) still open. SCIM is not built. Guide: [FORGE_SSO_SETUP.md](./FORGE_SSO_SETUP.md) |
| Fleet pull-and-run kit | In flight | Images exist. The launched customer kit (docs + license-gated pull, no source build) does not |
| Product-led channels | In flight | Starter Kit request path (public Buy paused), Apify actor, and a customer self-host template (sales channel only; Railway is not Studio production, which stays on Vercel + Neon + Fly). Owner publish + first stranger purchase remain |
| Onboarding (first 24h / first 7d) | In flight | Journey copy and checklists ship. Per-tier walkthrough sign-off does not |
| Multi-editor connect | Shipped in code | Cursor, VS Code plugin surface, and ACP connect guides exist. VS Code Marketplace listing is owner ops |
| Claim honesty | Continuous | `pnpm validate:claims` gates marketing copy. This file and What Works Today must stay in lockstep |

---

## Next

- **MCP Marketplace.** Third-party publish, discovery, and payouts. Do not read first-party MCP servers as a live marketplace. No 80/20 revenue-share claim until that rail exists
- **x402 agent payments.** Designed and code-complete behind `X402_ENABLED=false`. Off until an operator turns the rail on
- **Visual Editing.** Click the real page in admin ([#1816](https://github.com/RevealUIStudio/revealui/issues/1816)). Not a no-code drag-and-drop builder
- **Onboarding polish.** First-day and first-week journeys for free / Pro / Max
- **RevDev daily driver.** Permission modes, public binaries, and code signing

---

## Later

- **SCIM**, custom RBAC editor, multi-region
- **Managed RevealUI Cloud.** Per-operator provisioning, operator UI, and a productized support contract. Unbuilt. The agency engagement is the path that ships a hosted instance today
- **SOC2 Type II** ([#516](https://github.com/RevealUIStudio/revealui/issues/516))
- **Air-gapped container path** for fully disconnected environments
- **Real-time multi-user collaboration** beyond current ElectricSQL shapes and Yjs text

---

## Pricing tracks

| Track | Model | Description |
|-------|-------|-------------|
| **A. Subscriptions** | Monthly | Free / Pro $49/mo / Max $299/mo / Enterprise $1,499/mo |
| **B. Agent credits** | Pay-per-use | $0.001/task, first 1,000 tasks/month free (local inference) |
| **C. Perpetual** | One-time | $1,499 / $8,499 / $42,999 (1 year support included, renewable) |
| **D. Professional services** | Per-engagement | Architecture review, migration assist, launch package, consulting hours |

See [revealui.com/pricing](https://revealui.com/pricing) for the live catalog.

---

## How to influence this roadmap

- **GitHub Issues.** [Request features or report bugs](https://github.com/RevealUIStudio/revealui/issues)
- **Discussions.** [Join the conversation](https://github.com/RevealUIStudio/revealui/discussions)
- **Email.** support@revealui.com

We prioritize based on customer impact, charge readiness, and community demand.
