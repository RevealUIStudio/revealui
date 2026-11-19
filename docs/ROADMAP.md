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

## RevealFleet product maturity

Labels match the `/products` page.

| Product | Maturity | Notes |
|---------|----------|-------|
| **RevealUI** (monorepo) | Beta | Deployed (admin, API, marketing, docs). 33 packages. No external paying customers yet. |
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
- **UI.** 68 native React components in `@revealui/presentation` (Tailwind v4, no Radix/Headless UI/shadcn)
- **Database.** 104 Postgres tables via Drizzle on Neon. ElectricSQL is an optional sync layer (off by default)
- **CLI.** `npx create-revealui@latest my-app` plus public GitHub templates (starter, basic-blog, portfolio, e-commerce)
- **Agents.** A2A, CRDT memory, open-model default, streaming, tool execution. Hosted runs use the account's saved provider key (BYOK) or a local model. RevealUI does not host a shared frontier key as the product default. An entitled Pro account walked save-key plus Send Task plus Watch live on production (2026-08-18). That is one operator walk, not a paying-customer load test.
- **MCP.** 14 first-party servers under `packages/mcp/src/servers/` (includes the adapter module)
- **Audit receipts.** Signed audit log. Pro can download Merkle roots
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
| Product-led channels | In flight | Apify [governed-agent-run](https://apify.com/revealuistudio/governed-agent-run) is live (pay-per-event; receipt verification is $0.00001, not free). Owner publish + first stranger purchase remain |
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
| **A. Subscriptions** | Monthly | Free $0 / Pro $49/mo / Max $99/mo / Enterprise inquire |
| **B. Agent credits** | Pay-per-use | $0.001/task (local inference) |
| **C. Perpetual** | One-time | Pro Perpetual $1,499 public; Agency and Enterprise perpetual are not public catalog SKUs |
| **D. Professional services** | Per-engagement | Consultation $300 / Pilot $3,997 (includes 1 Adapter) / Launch $14,500 (up to 3 Adapters) (revealuistudio.com) |

See [revealui.com/pricing](https://revealui.com/pricing) for the live catalog.

---

## How to influence this roadmap

- **GitHub Issues.** [Request features or report bugs](https://github.com/RevealUIStudio/revealui/issues)
- **Discussions.** [Join the conversation](https://github.com/RevealUIStudio/revealui/discussions)
- **Email.** support@revealui.com

We prioritize based on customer impact, charge readiness, and community demand.

### HARNESS-CODEX-RUNTIME — Codex execution and lifecycle integration

Native instruction and skill delivery is implemented through the project manager.
The execution adapter extends the existing harness framework and auto-detection
with bounded app-server dispatch, streamed final output, cancellation/cleanup,
project-scoped resume, canonical MCP attachment, and request-scoped host approval
review. Its owner remains `@revealui/harnesses`. Configured authenticated memory
uses the existing signed session boundary and installed knowledge-graph MCP
launcher, with native tool calls requiring no model turn. Local and hosted
reads enforce scope; scoped keys protect mutable node metadata. Historical
unscoped memory is quarantined pending `KG-LEGACY-MEMORY-SCOPE-MIGRATION` in the
knowledge-graph migration owner. Repository-filter support remains tracked in
the shared search owner. Lifecycle hooks and a packaged approval UI remain
follow-up work. Do not create a second identity or store; verify each integration
before enabling its capability.

Migration locations, owners, canonical sources, destinations, and removal evidence
are recorded in [codex-native-delivery.json](audits/codex-native-delivery.json).

### HARNESS-INTEGRATION-GATE-DEBT — Complete broad validation

The bounded quick gate completed in 612.3 seconds. Native manager delivery,
content snapshots, and content freshness passed; Biome lint failed on existing
source findings. Fix the owning files listed in the migration audit and rerun
`pnpm gate:quick`; do not suppress or bypass checks. Dependency owners must
also address the security audit findings reported as a warning.

### HARNESS-CLI-STARTUP — Bound cold CLI hook startup

Resolved in the CLI owner: command routing now precedes imports of ACP,
inference, content generation, session, and other command implementations.
The hook path keeps its existing end-to-end assertions and 20-second subprocess
budget. Cold full-suite validation passed after this change; keep the existing
CLI hook suite as the regression gate. Evidence and prior failure behavior are
recorded in the native delivery audit.
