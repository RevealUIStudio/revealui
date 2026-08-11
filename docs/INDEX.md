---
visibility: public
status: verified
title: "RevealUI Documentation"
description: "Entry point and navigation hub for all RevealUI documentation"
category: index
audience: developer
---

Agentic business runtime. Five primitives for humans and agents: people, content, offers, payments, and agents.

Six **[design principles](./JOSHUA.md)** govern every architectural decision: Justifiable, Orthogonal, Sovereign, Hermetic, Unified, Adaptive.

## Getting Started

- [Quick Start](./QUICK_START.md): get a local dev stack running
- [Build Your Business](./BUILD_YOUR_BUSINESS.md): End-to-end tutorial: scaffold to deploy
- [Examples](./EXAMPLES.md): Blog, subscription starter, storefront
- Glossary: Canonical vocabulary across RevFleet — agent, runtime, tier, harness, license, MCP, Rev, Revfleet, x402. Single source of truth for cross-cutting terminology.

## Core Guides

- [Design Principles](./JOSHUA.md): Six engineering principles: Justifiable, Orthogonal, Sovereign, Hermetic, Unified, Adaptive
- [Architecture](./ARCHITECTURE.md): System design, frontend choices (Vite vs Next.js), NeonDB data layer, multi-tenant patterns
- [Technology Stack](./guides/technology-stack.md): Canonical library + framework reference with rationale for each choice
- [Admin Guide](./ADMIN_GUIDE.md): Collections, content management, admin dashboard
- [Auth & Security](./AUTH.md): Authentication, sessions, RBAC, security policy
- [Database](./DATABASE.md): Management scripts, optimization, Drizzle ORM
- [Deployment](./guides/deployment.md): Deploy to Vercel + Fly, Docker Compose, customer Railway marketplace template, environment setup
- [Environment Variables](./ENVIRONMENT-VARIABLES-GUIDE.md): Configuration reference

## Pricing & Commerce

- [Build Your Business](./BUILD_YOUR_BUSINESS.md): Product packaging, pricing direction, billing setup, and deployment path
- [Marketplace](./MARKETPLACE.md): Agent-commerce monetization direction and marketplace economics
- [HTTP 402 Payments](./blog/02-http-402-payments.md): Paid API and machine-to-machine payment model
- [Pro](./PRO.md): Commercial packaging for AI, MCP, trust, and governance features

## Development

- [Testing](./TESTING.md): Unit, integration, E2E, component testing
- [Troubleshooting](./TROUBLESHOOTING.md): Common issues and solutions

## Reference

- [Package Reference](./REFERENCE.md): Core, contracts, DB, config, presentation, utils, router, CLI
- [Core Stability](./CORE_STABILITY.md): API stability tiers, production verification status, version policy
- [Component Catalog](./COMPONENT_CATALOG.md): 65 native UI components in `@revealui/presentation` (plus admin and rich-text UI in `@revealui/core`)
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

- [MCP Marketplace](./MARKETPLACE.md): Publish MCP servers with agent-commerce pricing and revenue-share options
- [Enterprise](./FLEET.md): Self-hosted enterprise deployment (Docker Compose, domain lock, unlimited users)

## RevFleet

RevealUI is one product in a fleet of seven that compose into an agent-first SDLC platform. See [RevFleet overview](./REVFLEET.md) for the full table and composition story.

- [RevDev](./fleet/revdev.md) — Studio (Tauri 2 desktop) + Console (Go SSH TUI) + harness daemon
- [RevVault](./fleet/revvault.md) — age-encrypted secret vault, source of truth for every RevFleet secret
- [RevCon](./fleet/revcon.md) — editor + agent-rule sync via symlinks (`link.sh`)
- [RevealUI Fleet](./FLEET.md) — self-hosted enterprise deployment kit
- [RevSkills](./fleet/revskills.md) — curated Agent Skills for Claude Code / Cursor

## Security & trust

- [Audit receipts](./security/AUDIT_RECEIPTS.md): signed log vs Max Merkle roots, offline CLI, honesty by tier

## Legal

- [Third Party Licenses](./THIRD_PARTY_LICENSES.md)
