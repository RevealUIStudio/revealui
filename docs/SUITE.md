---
title: "RevealUI Studio Suite"
description: "What each product in the RevealUI Studio Suite does, how they relate, and what becomes possible when you compose them."
category: index
audience: developer
---

# The RevealUI Studio Suite

RevealUI is one product in a suite of eight that together form an agent-first SDLC platform. Each ships in its own repo with its own license; the rest of this docs site is the canonical home for **RevealUI** itself.

This page exists for one reason: a customer reading **RevealUI Pro** docs sees mentions of *Studio*, *RevVault*, *RevCon*, and *Forge* and reasonably wonders — *which of those am I buying, which are separate, and how do they fit together?* The table below answers that. The composition story below explains what becomes possible when you use them together.

---

## The eight products

| Product | Repo | What it is | License | Status |
|---|---|---|---|---|
| **RevealUI** | [revealui](https://github.com/RevealUIStudio/revealui) | The agent-first business runtime. Five primitives (users, content, products, payments, AI) for humans and agents. **The platform.** | MIT (OSS subset) + FSL-1.1-MIT (Pro packages, MIT after 2 years) | Pre-launch (0 paying customers) |
| **RevDev** | [revdev](https://github.com/RevealUIStudio/revdev) | Native developer tools. **Studio** (Tauri 2 desktop AI editor + agent dashboard) and **Console** (Go/Bubble Tea SSH TUI). Both UIs talk to a shared harness daemon (Node) that coordinates agents and routes tools to the RevealUI API. | (per-product LICENSE) | Active |
| **RevVault** | [revvault](https://github.com/RevealUIStudio/revvault) | Age-encrypted secret vault. CLI (`revvault get/set/list/search/export-env`) + Tauri 2 desktop app. 100% [passage](https://github.com/FiloSottile/passage)-compatible. **Source of truth for every secret in the suite** per the suite-wide secrets rule. | (per-product LICENSE) | Active |
| **RevCon** | [revcon](https://github.com/RevealUIStudio/revcon) | Centralized editor configs (Zed, VS Code, Cursor) + agent-rule sync (Claude Code, Cursor rules). Symlinked into target projects via `link.sh`/`unlink.sh` — edits propagate instantly, nothing committed downstream. **Not gated by the RevealUI Pro license.** | (per-product LICENSE) | Active |
| **RevealCoin** | [revealcoin](https://github.com/RevealUIStudio/revealcoin) | Hybrid utility/governance/reward token on Solana Token-2022. **`RVC`** = customer-facing on-chain ticker (6 decimals, 58.906B supply, freeze authority renounced). Live landing page at [revealcoin.revealui.com](https://revealcoin.revealui.com). | (per-product LICENSE) | Pre-launch (mainnet mint deployed; vesting + multi-sig + Raydium pool gate public distribution) |
| **Forge** | [forge](https://github.com/RevealUIStudio/forge) | Self-hosted enterprise deployment kit. Docker Compose stack + per-customer stamp scripts + domain lock + unlimited users. Same kit produces stamped instances (e.g. AlleviaForge for Allevia Technology). Canonical docs at [`/docs/FORGE`](./FORGE). | (per-product LICENSE) | Pre-launch (Docker images not yet on GHCR — stack runs from source today) |
| **RevSkills** | [revskills](https://github.com/RevealUIStudio/revskills) | Curated [Agent Skills](https://agentskills.io) (`SKILL.md` format) for modern web development. Compatible with Claude Code, Cursor, and any tool supporting the Agent Skills standard. Install via `npx skills add RevealUIStudio/revskills`. | (per-product LICENSE) | Active |
| **RevKit** | [revkit](https://github.com/RevealUIStudio/revkit) | Portable WSL development environment toolkit. Profile presets (`solo-dev`, `full-stack`, `ai-studio`, `team`), bootstrap scripts, shell config, boot optimization, RevStation PowerShell module. Plug a USB into a Windows host, boot WSL, get a RevealUI Studio-grade workstation. | (per-product LICENSE) | Active |

---

## What becomes possible together

Each pairing below is something that's hard or impossible without both products.

### RevealUI alone

The agentic business runtime in a single repo. Self-hostable, five primitives, MIT for the OSS subset and Fair Source for the Pro packages (`@revealui/ai`, `@revealui/harnesses`). Everything else in the suite composes against this.

### RevealUI + RevDev

**Managed agent operations.** Studio gives you a desktop UI for the agents running against your RevealUI install — agent task feed, hypervisor view, tool routing, manual approvals. Console gives you the same surface in an SSH TUI for production triage. The harness daemon coordinates PTY sessions and JSON-RPC tool calls so a Claude Code or Cursor agent can take actions through Studio that hit the RevealUI API. Closes the "what is my agent doing right now" gap.

### RevealUI + RevVault

**Secret-managed deployment.** Every credential the suite uses lives in age-encrypted RevVault, never in plaintext `.env` files outside an ephemeral tmpfs. `revvault export-env` materializes secrets at session start; rotation goes through one runbook per credential type. Trust story compresses to one sentence: *"Secrets live in RevVault, encrypted by an age identity that doesn't leave the developer's machine."*

### RevealUI + RevCon

**Team consistency.** Editor settings, Claude Code rules, Cursor rules, agent skill files — all symlinked from one source-of-truth repo. New contributor runs `pnpm dlx revcon sync` (or `./link.sh --target . --profile revealui`) and they have the team's editing posture, agent rules, and convention files. No drift, no per-repo copies.

### RevealUI + Forge

**White-label resale.** Stamp the Forge kit per customer (e.g. AlleviaForge for Allevia Technology), drop in their domain + branding, run on their infrastructure with full domain lock and unlimited users. Enterprise tier without managed-hosting overhead.

### RevealUI + RevealCoin

**Agent-priced commerce (planned).** MCP servers price each call in `RVC` via x402; agents pay other agents in tokens; an 80/20 platform/developer revenue split is the planned launch policy. Live payouts open with the billing-readiness audit. The marketplace endpoints, Stripe Connect onboarding, and x402 facilitator are wired in `apps/server/src/routes/marketplace.ts`; production payouts pending pre-launch gates.

### RevealUI + RevSkills

**Curated agent capability.** Agent skills are versioned, reviewed, and distributed through one repo. Agents inherit behaviour and conventions, not just tools. Plug in to Claude Code / Cursor without writing your own skill files.

### RevealUI + RevKit

**Portable workstation.** Boot a Windows host, plug a USB, run the RevKit bootstrap, and you have the studio's full WSL environment — Nix, direnv, fnm, pnpm, profile-tier defaults, shell aliases, PowerShell module, optional Forge drive mount. Replaces "set up your laptop for four hours" with "run the bootstrap script."

### All eight together

The **RevealUI Studio Suite** — a coherent agent-first SDLC platform. **Build** (RevealUI), **operate** (RevDev), **secure** (RevVault), **align** (RevCon), **monetize** (RevealCoin), **ship** (Forge), **curate** (RevSkills), **portable** (RevKit). Each one is independently useful; the leverage compounds when you compose them.

---

## Boundary statements (worth memorising)

These are the boundaries the rest of the docs site routinely crosses. If a doc inside `/docs/*` says one of these wrong, treat it as drift:

- **Studio lives in RevDev**, not in RevealUI. Mentions of *"the Studio desktop app"* in a RevealUI Pro context are about a product sold separately; your Pro license unlocks Studio's commercial features, but Studio itself ships from the RevDev repo.
- **Editor sync lives in RevCon**, not in RevealUI. There is no `@revealui/editors` package inside the RevealUI monorepo; `revcon` is the home and is not gated by the Pro license.
- **`RVC` is the customer-facing ticker** for RevealCoin. `$RVUI` is the *internal* codename used in code constants, env-var prefixes, and route paths (e.g., `/api/billing/rvui-payment`). Public-facing copy uses `RVC`; internal route slugs may stay `rvui-payment`.
- **Forge is both a tier name AND a separate product.** The "Forge tier" of RevealUI Pro and the **Forge** self-host kit are related but distinct: the kit is what an Enterprise-tier customer deploys; the tier is the licensing posture. The canonical Forge guide is [`/docs/FORGE`](./FORGE).
- **RevVault is the source of truth for every secret in the suite.** Per the suite-wide secrets rule: there is no escape hatch. CI mirrors are downstream of RevVault, not authoritative.

---

## Per-product pages

Each suite product has a one-page entry under [`/docs/suite/`](./suite/). They cross-link to the canonical README in each product's repo.

- [RevDev](./suite/revdev) — Studio + Console + harness daemon
- [RevVault](./suite/revvault) — age-encrypted secret store + rotation
- [RevCon](./suite/revcon) — editor + agent-rule sync
- [RevealCoin](./suite/revealcoin) — RVC token, Token-2022, Solana mainnet
- [Forge](./FORGE) — self-host kit (canonical)
- [RevSkills](./suite/revskills) — Agent Skills curation
- [RevKit](./suite/revkit) — portable WSL workstation kit
