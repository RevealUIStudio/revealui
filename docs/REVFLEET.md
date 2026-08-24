---
visibility: public
status: verified
title: "RevFleet — Architecture & Integration Guide"
description: "Naming layers and RevFleet products: what each piece is, who it's for, and how they integrate."
category: index
audience: developer
---

> RevFleet is the umbrella for all RevealUI Studio software. This guide covers the naming layers and the products: what each piece is, who it's for, and how they integrate.

---

## Naming layers

| Tier | Term | What it is | Who it's for |
|---|---|---|---|
| 1 | RevealUI Studio | The org / GitHub `RevealUIStudio` | Org level |
| 2 | **RevFleet** | The umbrella for all RevealUI Studio software | Internal coordination |
| 3 | **RevForge** | Operator-only stamping tool (private; not a public GitHub repo). Produces branded RevealUI Fleet kits per customer. | RevealUI Studio operators |
| 4 | **RevealUI Fleet** | Customer-facing self-hosted runtime kit — white-label, multi-tenant, domain-locked, produced by RevForge. | Enterprise customers self-hosting |
| 5 | **Enterprise** | SaaS billing tier label ($1,499/mo). License + studio support on admin.revealui.com; the customer self-hosts. Not a Studio-operated customer VM. Managed instances are RevealUI Cloud (waitlist). | Customers on the Enterprise license tier |
| 6 | (customer stamps) | Customer-stamped Fleet instances per the Tier 4 model. | Enterprise customers |

**Naming drift to avoid:** "Suite", "RevealUI Studio Fleet", bare "Fleet" → use **RevFleet**. Bare "Forge" is ambiguous — use RevForge (the tool), RevealUI Fleet (the kit), or Enterprise (the tier) per context.

---

## Products in detail

Most RevFleet products have public repos. RevForge does not — the stamper is private / operator-only. The customer-facing Fleet runtime lives in this monorepo (`docker-compose.forge.yml` plus GHCR `ghcr.io/revealuistudio/revealui-{api,admin,migrate}`). The table below orients new contributors and customer engineers; per-product pages live under [`/docs/fleet/`](./fleet/).

| Product | Repo | What it is | License |
|---|---|---|---|
| **RevealUI** | [revealui](https://github.com/RevealUIStudio/revealui) | The agentic business runtime. Five primitives — people, content, offers, payments, agents — pre-wired and ready to compose against. | MIT (OSS) + FSL-1.1-MIT (Pro packages) |
| **RevForge** | private / operator-only (no public GitHub; `https://github.com/RevealUIStudio/revforge` 404s) | Operator-side stamping tool. Generates a branded RevealUI Fleet kit per customer — domain lock, unlimited users, Docker Compose stack. | operator-only |
| **RevDev** | [revdev](https://github.com/RevealUIStudio/revdev) | Native developer tools: Studio (Tauri 2 desktop AI editor + agent dashboard) and Console (Go SSH TUI). Both talk to a shared harness daemon that coordinates agents and routes tools to the RevealUI API. | per-product LICENSE |
| **RevVault** | [revvault](https://github.com/RevealUIStudio/revvault) | Age-encrypted secret vault. CLI + Tauri 2 desktop app. 100% passage-compatible. Source of truth for every secret in RevFleet per the fleet-wide secrets rule. | per-product LICENSE |
| **RevCon** | [revcon](https://github.com/RevealUIStudio/revcon) | Centralized editor configs (Zed, VS Code, Cursor) + agent-rule sync. Symlinked into target projects via `link.sh`; edits propagate instantly. Not gated by the RevealUI Pro license. | per-product LICENSE |
| **RevSkills** | [revskills](https://github.com/RevealUIStudio/revskills) | Curated Agent Skills (`SKILL.md` format) for modern web development. Compatible with Claude, Grok, Cursor, OpenCode, VS Code, and any tool supporting the Agent Skills standard. | per-product LICENSE |
| **RevKit** | [revkit](https://github.com/RevealUIStudio/revkit) | Dev-environment bootstrap and launchers (`bootstrap.sh`, `rfg`, `rfc`). Operator machine kit, not customer runtime. | per-product LICENSE |

### RevealUI (the runtime)

RevealUI is the agentic business runtime. Five primitives — people, content, offers, payments, agents — are pre-wired in the monorepo. OSS packages ship MIT; Pro packages (`@revealui/ai`, `@revealui/engines`, `@revealui/harnesses`, `@revealui/mcp`, `@revealui/services`) are Fair Source FSL-1.1-MIT (source-visible, non-compete, auto-converts to MIT after 2 years).

Status: pre-launch (0 paying customers). Enterprise tier at $1,499/mo is a license plus studio support; you self-host. RevealUI Fleet is the self-host kit via RevForge. Managed customer instances are RevealUI Cloud (waitlist).

### RevForge (the stamping tool)

RevForge is what a RevealUI Studio operator runs to produce a customer Fleet kit. It is not a public product repo. Do not link `RevealUIStudio/revforge` — that URL 404s (verified 2026-08-19). Operators use a private stamper checkout; customers deploy the in-tree Compose file and GHCR images.

The stamper generates per-customer branding, domain lock, and a studio-issued license JWT. Customers never receive `REVEALUI_LICENSE_PRIVATE_KEY` (the studio mint key).

Status: in flight / private preview. Runtime images are on GHCR and pull anonymously. A stamped kit still needs a license JWT. Claim hold `COPY-DEP-FLEET-DOCKER-IMAGES` is still `waiting` — do not call this a launched customer pull-and-run kit.

### RevealUI Fleet (the self-hosted kit)

A Fleet kit is what an enterprise customer deploys on their own infrastructure. Today that kit is `docker-compose.forge.yml` in this repo plus the GHCR images above, locked to the customer's domain. A studio operator may still stamp branding and the license JWT with the private RevForge tool.

The full Fleet deployment guide is at [`docs/FLEET.md`](./FLEET.md).

### RevDev (developer tools)

Studio and Console share a harness daemon. Studio gives you a desktop UI for the agents running against your RevealUI install. Console gives you the same surface in an SSH TUI for production triage. A RevealUI Pro license unlocks Studio's commercial features; the daemon and Studio shell work against any RevealUI install.

### RevVault (secrets)

The fleet-wide secrets rule is: every secret lives in RevVault, encrypted by an age identity that doesn't leave the developer's machine. `revvault export-env` materializes secrets at session start; rotation has a per-credential-type runbook.

### RevCon (editor + agent-rule sync)

RevCon is not gated by Pro. Any contributor can run `./link.sh --target ~/revfleet/revealui --profile revealui` and get the team's editing posture, agent rules, and convention files. No `@revealui/editors` package exists in the monorepo. The canonical product is RevCon.

### RevSkills (Agent Skills)

RevSkills is the `SKILL.md` library. Compatible with Claude, Grok, Cursor, OpenCode, VS Code, and any harness that implements the Agent Skills standard.

### RevKit (dev-environment bootstrap)

RevKit is the operator machine kit: `bootstrap.sh`, `rfg` (Grok + RevealUI MCP), and `rfc` (Claude). It is not a customer runtime.

---

## Methodology

See `docs/methodology.md` for the canonical M2-M12 statement — audit-first SDLC, no-regex, pre-1.0 versioning, open-model AI runtime, revvault-first secrets, coordination primitives, charge-readiness, stack conventions.

---

## Licensing

- **MIT**: `@revealui/core`, `@revealui/auth`, `@revealui/db`, `@revealui/contracts`, `@revealui/presentation`, `@revealui/router`, `@revealui/config`, `@revealui/utils`, `@revealui/cli`, `@revealui/setup`, `@revealui/sync`, `@revealui/cache`, `@revealui/resilience`, `@revealui/security`, `@revealui/openapi`, `@revealui/paywall`, and all other OSS packages
- **FSL-1.1-MIT**: `@revealui/ai`, `@revealui/engines`, `@revealui/harnesses`, `@revealui/mcp`, `@revealui/services` — source-visible, non-compete, converts to MIT after 2 years per release (`@revealui/engines` is `"private": true` and not published on npm)

---

## Cross-references

- Deployment guide: [`docs/FLEET.md`](./FLEET.md) — RevealUI Fleet self-hosted runtime kit
- Methodology: `docs/methodology.md`
- Internal glossary: private coordination hub
- ADR for rename: internal ADR 2026-05-03 (private coordination hub)
- Per-product pages: [`docs/fleet/`](./fleet/)
