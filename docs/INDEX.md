---
visibility: public
status: verified
title: "RevealUI Documentation"
description: "Entry point and navigation hub for all RevealUI documentation"
category: index
audience: developer
---

Agentic business runtime. Five primitives for humans and agents: people, content, offers, payments, and agents.

Canonical definition: **[What is RevealUI?](./WHAT_IS.md)**. Six **[design principles](./JOSHUA.md)** govern every architectural decision: Justifiable, Orthogonal, Sovereign, Hermetic, Unified, Adaptive.

## Getting Started

- [What is RevealUI?](./WHAT_IS.md): canonical paragraph, tier names, feature matrix, RevFleet list
- [Quick Start](./QUICK_START.md): get a local dev stack running
- [Build Your Business](./BUILD_YOUR_BUSINESS.md): End-to-end tutorial: scaffold to deploy
- [Examples](./EXAMPLES.md): Blog, subscription starter, storefront

## Core Guides

- [Design Principles](./JOSHUA.md): Six engineering principles: Justifiable, Orthogonal, Sovereign, Hermetic, Unified, Adaptive
- [Architecture](./ARCHITECTURE.md): System design, frontend choices (Vite vs Next.js), NeonDB data layer, multi-tenant patterns
- [Technology Stack](./guides/technology-stack.md): Canonical library + framework reference with rationale for each choice
- [Admin Guide](./ADMIN_GUIDE.md): Collections, content management, admin dashboard
- [Auth & Security](./AUTH.md): Authentication, sessions, RBAC, security policy
- [Database](./DATABASE.md): Management scripts, optimization, Drizzle ORM
- [Deployment](./guides/deployment.md): Deploy to Vercel + Fly, buyer Vercel one-click starter, Docker Compose, leftover customer Railway marketplace template, environment setup
- [Plugins](./PLUGINS.md): Config-transform plugins (form builder, nested docs, redirects) and how to author one
- [Admin development](./guides/admin-dev.md): HMR expectations when editing admin, collections, and Lexical plugins
- [Errors and debugging](./guides/errors-and-debugging.md): API error envelope, request ids, how to file a bug
- [Environment Variables](./ENVIRONMENT-VARIABLES-GUIDE.md): Configuration reference

## Pricing & Commerce

- [Build Your Business](./BUILD_YOUR_BUSINESS.md): Product packaging, pricing direction, billing setup, and deployment path
- [Marketplace](./MARKETPLACE.md): First-party MCP catalog ships; third-party publish and payouts are Planned ([#526](https://github.com/RevealUIStudio/revealui/issues/526))
- [HTTP 402 Payments](./blog/02-http-402-payments.md): Paid API and machine-to-machine payment model
- [Pro](./PRO.md): Commercial packaging for AI, MCP, trust, and governance features

## Development

- [Testing](./TESTING.md): Unit, integration, E2E, component testing
- [Troubleshooting](./TROUBLESHOOTING.md): Common issues and solutions
- [Admin development](./guides/admin-dev.md): Turbopack HMR notes for this monorepo
- [Errors and debugging](./guides/errors-and-debugging.md): Error envelope and bug-report shape

## Reference

- [Package Reference](./REFERENCE.md): Core, contracts, DB, config, presentation, utils, router, CLI
- [Core Stability](./CORE_STABILITY.md): API stability tiers, production verification status, version policy
- [Component Catalog](./COMPONENT_CATALOG.md): 66 native UI components in `@revealui/presentation` (plus admin and rich-text UI in `@revealui/core`)
- [AI](./AI.md): AI package overview, prompt/response/semantic caching
- [Pro](./PRO.md): Pro packages (`@revealui/ai`, `@revealui/engines`, `@revealui/harnesses`, `@revealui/mcp`, `@revealui/services`), MCP integration, open-model inference, x402, marketplace
- [RevFleet](./REVFLEET.md): Companion products (RevDev, RevVault, RevCon, RevForge, RevSkills) — what each does and how they compose

## Agent Coordination

- [Harness Protocol](./HARNESS_PROTOCOL.md): Agent normalization, capability model, lifecycle events, and the adapter/coordinator surface shipped in `@revealui/harnesses`
- [Connect OpenCode](./guides/connect-opencode.md): OpenCode CLI via governed MCP
- [Connect Cursor](./guides/connect-cursor.md): Cursor hooks + governed MCP
- [Connect VS Code](./guides/connect-vscode.md): Copilot agent-plugin bundle
- [Connect ACP (Zed / JetBrains)](./guides/connect-acp.md): RevealUI ACP agent on stdio
- [Blog: Three AI Agents, One Codebase](./blog/03-multi-agent-coordination.md): The problem that led to the Holster

## Pro & Enterprise

- [MCP Marketplace](./MARKETPLACE.md): Planned third-party catalog. No 80/20 revenue share until that rail exists
- [Enterprise](./ENTERPRISE.md): License plus studio support (inquire / Contact sales). Not a hosted VM
- [RevealUI Fleet](./FLEET.md): Self-hosted deployment kit (Docker Compose, domain lock)
- [Collaborative editing](./guides/collaborative-editing.md): Yjs + Lexical cursors for self-hosted operators. Comments and suggestions are not shipped
- [SLA](./SLA.md): Published support and license-infra uptime commitments

## RevFleet

RevealUI is one product in RevFleet. See [RevFleet overview](./REVFLEET.md) and [What is RevealUI?](./WHAT_IS.md) for the named list and maturity labels.

- [RevDev](./fleet/revdev.md) — Studio (Tauri 2 desktop) + Console (Go SSH TUI) + harness daemon
- [RevVault](./fleet/revvault.md) — age-encrypted secret vault, source of truth for every RevFleet secret
- [RevCon](./fleet/revcon.md) — editor + agent-rule sync via symlinks (`link.sh`)
- [RevealUI Fleet](./FLEET.md) — self-hosted enterprise deployment kit
- [RevSkills](./fleet/revskills.md) — curated Agent Skills for Claude, Grok, Cursor, OpenCode, and VS Code
- RevForge — operator-only stamper (private; not a public repo). See [REVFLEET.md](./REVFLEET.md)
- RevMarket — Planned ([#526](https://github.com/RevealUIStudio/revealui/issues/526)) third-party MCP catalog. First-party servers ship in this runtime

## Security & trust

- [Audit receipts](./security/AUDIT_RECEIPTS.md): signed log vs Max Merkle roots, offline CLI, honesty by tier

## Legal

- [SLA](./SLA.md): Support response and license-infra uptime
- [Third Party Licenses](./THIRD_PARTY_LICENSES.md)
