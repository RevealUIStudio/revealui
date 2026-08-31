---
visibility: public
status: verified
title: "What is RevealUI?"
description: "Canonical positioning paragraph, tier names, and feature matrix"
category: index
audience: developer
---

This page is the canonical external wording for RevealUI. Other surfaces should link here or embed the paragraph below verbatim. Do not invent a second definition.

**Last updated:** 2026-08-31

---

## What is RevealUI?

RevealUI is an open-source agentic business runtime. It ships five primitives — people, content, offers, payments, and agents — pre-wired in one deployable system so humans and agents share the same permissions, API, and data model. OSS packages are MIT. Pro packages are Fair Source (FSL-1.1-MIT) and convert to MIT two years after each release. RevealUI is the runtime at the center of RevFleet.

That paragraph is the product definition. Supporting facts:

- You start from `npx create-revealui` or this monorepo, not from a hosted black box.
- The five primitives are the product surface. They are not a slogan layered on an empty framework.
- There are no paying external customers yet. Stripe live mode is on. That is a billing-rail fact, not a sales claim.
- Studio does not operate a dedicated customer VM on `revealui.com` infrastructure. Customers self-host.

---

## Tier names

Public and code names are the same four strings. Do not use retired aliases (`Forge` as a billing tier, `Suite` as the family name) on customer surfaces.

| Public name | Code string | What it is |
|-------------|-------------|------------|
| **Free (OSS)** | `free` | MIT core. Local AI inference. Community support. |
| **Pro** | `pro` | Account-level commercial layer: AI agents, AI memory, signed audit receipts with downloadable Merkle roots, MCP, Stripe, RevVault desktop + rotation. |
| **Max** | `max` | Pro plus unattended inference, RevKit environment provisioning, higher limits. |
| **Enterprise** | `enterprise` | License + studio support. Customer self-hosts. Domain lock. SSO is an operator preview ([#449](https://github.com/RevealUIStudio/revealui/issues/449)), not a customer-walked feature. |

Internal-only aliases: `enterprise` in feature flags and license JWTs is the same public Enterprise tier. RevealFleet (`/docs/REVFLEET`) is the family name, not a fifth billing tier.

Limits and prices are pinned in `packages/contracts/src/pricing.ts` and restated on [revealui.com/pricing](https://revealui.com/pricing). Maintainer scorecards live off the public site.

| Tier | Price | Sites | Users | Agent tasks/mo | API req/min |
|------|-------|-------|-------|----------------|-------------|
| Free | $0 | 1 | 3 | Local AI | 200 |
| Pro | $49/mo | 5 | 25 | 10,000 | 300 |
| Max | $99/mo | 15 | 100 | 50,000 | 600 |
| Enterprise | inquire / Contact sales | unlimited | unlimited | unlimited | 1,000 |

---

## Feature matrix

Source of truth for gates: `packages/core/src/features.ts` (`featureTierMap`). `whiteLabel` is forced off until it ships ([#515](https://github.com/RevealUIStudio/revealui/issues/515)). SSO is Enterprise-gated in code and still an operator preview.

| Feature | Free | Pro | Max | Enterprise |
|---------|------|-----|-----|------------|
| Local AI (Inference Snaps / Ollama) | Yes | Yes | Yes | Yes |
| AI agents | | Yes | Yes | Yes |
| MCP framework | | Yes | Yes | Yes |
| Stripe payments | | Yes | Yes | Yes |
| Advanced real-time sync | | Yes | Yes | Yes |
| Monitoring dashboard | | Yes | Yes | Yes |
| Custom domain mapping | | Yes | Yes | Yes |
| Analytics | | Yes | Yes | Yes |
| RevVault desktop | | Yes | Yes | Yes |
| RevVault rotation engine | | Yes | Yes | Yes |
| AI memory | | Yes | Yes | Yes |
| Open-model inference config | | | Yes | Yes |
| Audit receipts (signed log + Merkle roots) | | Yes | Yes | Yes |
| RevKit env provisioning | | | Yes | Yes |
| Multi-site content | | | | Yes |
| White-label branding | | | | Planned ([#515](https://github.com/RevealUIStudio/revealui/issues/515)) |
| Enterprise SSO | | | | Operator preview ([#449](https://github.com/RevealUIStudio/revealui/issues/449)) |

Support response is not a feature flag. The published commitment is the same for every paid tier: 24 hours during U.S. business hours, 4 hours for a critical issue. See [SLA](./SLA.md). Some older pricing strings still say "48h" for Pro or "Slack (4h)" for Enterprise. Those strings are stale relative to the published SLA.

---

## RevealFleet

RevealFleet (`/docs/REVFLEET`) is the family name for RevealUI Studio software. It is **not** a catalog SKU. **RevealUI** is the lead product and the buyable runtime.

The public catalog is Free, Pro ($49/mo), Max ($299/mo), Enterprise (inquire / Contact sales), and Pro Perpetual ($1,499). RevVault (separate product) is encrypted secret management inside Pro, not a separate paid SKU.

Get started on [Quick Start](./QUICK_START.md). Maturity labels for this runtime live in [ROADMAP.md](./ROADMAP.md).

---

## Claim-drift coverage

`pnpm validate:claims` uses the `product-runtime` profile in `packages/claim-gates/src/profiles.ts`. `scanDirs` already includes `docs/`, `apps/marketing/app`, `README.md`, `CLAUDE.md`, `CONTRIBUTING.md`, and the hand-authored `apps/docs/public/docs-pro/` tree. Messaging drift on those surfaces is a CI failure, not a manual audit.

---

## Related

- [Quick Start](./QUICK_START.md)
- [Pro](./PRO.md)
- [Enterprise](./ENTERPRISE.md)
- [RevealFleet](./REVFLEET.md)
- [What Works Today](./WHAT_WORKS_TODAY.md)
- [SLA](./SLA.md)
