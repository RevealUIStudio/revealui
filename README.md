<div align="center">

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="packages/presentation/src/assets/brand/wordmark-dark.svg">
  <img src="packages/presentation/src/assets/brand/wordmark-light.svg" alt="RevealUI" width="340">
</picture>

**Agentic business runtime.**

People. Content. Offers. Payments. Agents. Five primitives for humans and agents, one deployment, one runtime.

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)
[![React 19](https://img.shields.io/badge/React-19-61dafb.svg)](https://react.dev)
[![TypeScript](https://img.shields.io/badge/TypeScript-6-blue.svg)](https://www.typescriptlang.org/)
[![Node.js 24](https://img.shields.io/badge/Node.js-24-339933.svg)](https://nodejs.org/)

[Documentation](https://docs.revealui.com) | [Quick Start](#quick-start) | [Pro](#pro-ai-for-your-business) | [Contributing](CONTRIBUTING.md)

</div>

---

RevealUI is an open-source runtime that ships the business logic layer every software product needs: auth, content, products, billing, and AI agents. Pre-wired and development-hardened. You start on day one with a running business. Your agents start on day one with a runtime they can operate on. Same permissions, same API, same data model.

## What you get on day one

```bash
npx create-revealui my-business
cd my-business
pnpm dev
```

Open [http://localhost:4000/admin](http://localhost:4000/admin).

You have:

- **User accounts:** sign up, sign in, password reset, sessions, RBAC, rate limiting, brute force protection
- **Content management:** define collections in TypeScript, get a full REST API, admin UI, and MCP tools instantly
- **Billing:** Stripe checkout, subscriptions, trials, webhooks, grace periods, and a billing portal
- **Admin dashboard:** manage users, content, billing, and settings out of the box
- **65 UI components:** built with Tailwind CSS v4, zero external UI dependencies
- **14 MCP servers:** agents discover and use your business data through the same API humans use
- **Type-safe throughout:** Zod schemas shared between client, server, database, and agent tools

No assembly required. Define your data once. Humans manage it through the dashboard, agents operate on it through MCP. Same permissions, same audit trail.

## The five primitives

| Primitive        | For you                                                          | For your agents                                              |
| ---------------- | ---------------------------------------------------------------- | ------------------------------------------------------------ |
| **People**       | Session auth, RBAC + ABAC, rate limiting, GDPR compliance        | Same RBAC governs agent access. Every action auditable.      |
| **Content**      | Collections, rich text (Lexical), media, draft/live, REST API    | Collections auto-exposed as MCP tools. No integration step.  |
| **Offers**       | Product catalog, pricing tiers, usage tracking                   | Feature gates control which agent capabilities unlock.       |
| **Payments**     | Stripe checkout, subscriptions, webhooks, billing portal         | Same Stripe primitives, available to agents.                 |
| **Agents**       | AI agents, open-model inference, task history _(Pro)_            | A2A protocol, CRDT memory, 14 MCP servers.                   |

## Open-model first

The Agents primitive ships with open-model defaults. No proprietary API keys required, no API bill that scales with usage.

- **Ollama** — local model runner; the standard developer-machine path.
- **Ubuntu Inference Snaps** — Apache-2.0-preferred model runtimes for production. `sudo snap install gemma3` (or `deepseek-r1`, `qwen-vl`, `nemotron-3-nano`, `nemotron-3-nano-omni`).
- **Pluggable provider adapters** — Claude, OpenAI, and others available as opt-in adapters. The fleet runtime never imports any provider SDK by default; you wire whichever model you want.

Verifiable: `git grep -l "@anthropic-ai/sdk" packages/` returns nothing inside `@revealui/*` packages. The runtime is provider-agnostic by contract.

## Design principles

Six principles that give you a tested starting point for every architectural decision. Not the only way, a way that works. Evolve it as you grow:

| Principle | What it means |
| --- | --- |
| **Justifiable** | Every default earns its place. No magic, no hidden complexity, no decisions you can't explain to your team. |
| **Orthogonal** | Clean separation of concerns across 29 packages. Use what you need, replace what you don't. Zero circular dependencies. |
| **Sovereign** | Your infrastructure, your data, your rules. Deploy anywhere. Fork anything. No vendor holds your business hostage. |
| **Hermetic** | Auth doesn't leak into billing. Content doesn't tangle with payments. Sealed boundaries, clean contracts between every layer. |
| **Unified** | One Zod schema defines the truth. Types, validation, and API flow from database to server to UI with zero drift. |
| **Adaptive** | AI agents, MCP servers, and workflows are built into the foundation. Open-model inference, sovereign by design, evolving with your business. |

## RevFleet

RevealUI is the runtime at the center of RevFleet — the RevealUI Studio product family. Companion products extend specific parts of the lifecycle:

| Product              | Purpose                                                  | License           |
| -------------------- | -------------------------------------------------------- | ----------------- |
| **RevealUI**         | Agentic business runtime (this repo)                     | MIT + Fair Source |
| **RevVault**         | Age-encrypted secret vault (Rust CLI + desktop)          | MIT + Pro         |
| **RevDev**           | AI engineering harness — multi-agent coordination        | MIT (early)       |
| **RevCon**           | Editor config sync (Zed, VS Code, Cursor, Antigravity)   | MIT               |
| **RevSkills**        | Claude Code skills library                               | MIT               |
| **RevealUI Fleet**   | White-label / enterprise deployment kit for RevealUI     | Enterprise tier   |

Each product stands alone. Together, they cover the full lifecycle of building, securing, coordinating, and monetizing software, for you and for your agents.

## Define your business data

Add a collection. Get an API, admin UI, MCP tool, and TypeScript types, automatically.

```typescript
import { defineCollection, defineField } from "@revealui/core";

const Products = defineCollection({
  slug: "products",
  fields: [
    defineField({ name: "name", type: "text", required: true }),
    defineField({ name: "price", type: "number" }),
    defineField({ name: "description", type: "richText" }),
    defineField({
      name: "status",
      type: "select",
      options: ["draft", "active"],
    }),
    defineField({ name: "owner", type: "relationship", relationTo: "users" }),
  ],
  access: {
    read: ({ req }) => !!req.user,
    create: ({ req }) => req.user?.role === "admin",
  },
});
```

`GET /api/products` is live. The admin UI is live. The MCP tool is discoverable. The TypeScript types are generated. Humans manage products through the dashboard. Agents query and create through the same API.

## Pro: AI for your business

The [Pro tier](https://revealui.com/pro) adds AI agents and automation that work on your behalf:

- **AI agent system** _(beta — works in staging, production usage is early)_: build and deploy purpose-built agents for your workflows
- **MCP framework:** hypervisor, adapter framework, and tool discovery for connecting agents to external services
- **Open-model inference:** Ubuntu Inference Snaps (canonical default — Studio lifecycle pending), Ollama, and open source models via the RevealUI harness. `sudo snap install gemma3` for instant local AI (or any of `deepseek-r1`, `qwen-vl`, `nemotron-3-nano`, `nemotron-3-nano-omni`). No proprietary APIs, no vendor lock-in, zero API bills
- **Task history:** every agent action logged, auditable, and visible in the dashboard
- **Editor config sync:** generate and sync settings for Zed, VS Code, Cursor, and Antigravity

Pro packages are source-available under the [Functional Source License (FSL-1.1-MIT)](packages/ai/LICENSE). You can read, modify, and self-host. The license converts to MIT after 2 years. Install with `pnpm add @revealui/ai`.

## Tiers

| Tier           | Price     | What you get                                                       |
| -------------- | --------- | ------------------------------------------------------------------ |
| **Free**       | $0        | Full OSS core: people, content, offers, payments, admin              |
| **Pro**        | $49/mo    | AI agents, MCP framework, open-model inference, advanced sync, RevVault desktop + rotation engine |
| **Max**        | $299/mo   | Full AI memory, audit log, higher limits         |
| **Enterprise** | $1,499/mo | RevealUI Fleet (branded white-label, managed setup via revforge), SSO (planned — [#449](https://github.com/RevealUIStudio/revealui/issues/449)), domain-locked                                       |

## Apps

| App          | Framework        | Purpose                                      |
| ------------ | ---------------- | -------------------------------------------- |
| `server`     | Hono             | REST API with OpenAPI + Swagger              |
| `admin`      | Next.js 16       | Admin dashboard + content management         |
| `docs`       | Vite + React     | Documentation site                           |
| `marketing`  | Vite + React     | Marketing site (revealui.com)                |

The RevealUI Studio agency site (revealuistudio.com) lives in [RevealUIStudio/agency](https://github.com/RevealUIStudio/agency) — separate repo, consumes `@revealui/{router,presentation,core,contracts}` via npm.

## Packages

### OSS Packages (MIT) — 22

| Package                                                 | Purpose                                           |
| ------------------------------------------------------- | ------------------------------------------------- |
| [`@revealui/core`](packages/core)                       | Runtime engine, REST API, auth, rich text, plugins |
| [`@revealui/contracts`](packages/contracts)             | Zod schemas + TypeScript types (single source)    |
| [`@revealui/db`](packages/db)                           | Drizzle ORM schema (97 tables), dual-DB client     |
| [`@revealui/auth`](packages/auth)                       | Session auth, password reset, rate limiting       |
| [`@revealui/presentation`](packages/presentation)       | 65 UI components (Tailwind v4, zero ext deps)     |
| [`@revealui/openapi`](packages/openapi)                 | OpenAPI route helpers and Swagger generation       |
| [`@revealui/router`](packages/router)                   | Lightweight file-based router with SSR            |
| [`@revealui/config`](packages/config)                   | Type-safe environment configuration               |
| [`@revealui/utils`](packages/utils)                     | Logger, DB helpers, validation                    |
| [`@revealui/cli`](packages/cli)                         | `create-revealui` scaffolding tool                |
| [`@revealui/setup`](packages/setup)                     | Environment setup utilities                       |
| [`@revealui/sync`](packages/sync)                       | ElectricSQL real-time sync _(experimental)_       |
| [`@revealui/cache`](packages/cache)                     | CDN config, edge cache, ISR presets               |
| [`@revealui/resilience`](packages/resilience)           | Circuit breaker, retry, bulkhead patterns         |
| [`@revealui/security`](packages/security)               | Headers, CORS, RBAC/ABAC, encryption, audit       |
| [`@revealui/dev`](packages/dev)                         | Shared configs (Biome, TypeScript, Tailwind)      |
| [`@revealui/test`](packages/test)                       | E2E specs, integration tests, fixtures, mocks     |
| [`@revealui/paywall`](packages/paywall)                 | Runtime license enforcement, feature gating, upgrade UI |
| [`@revealui/tokens`](packages/tokens)                   | Design tokens (CSS variables, typed TS export, brand canon) |
| [`@revealui/knowledge-graph`](packages/knowledge-graph) | Fleet knowledge graph: bi-temporal, content-addressed graph over Neon + pgvector, `revkg` CLI |
| [`create-revealui`](packages/create-revealui)           | `npm create revealui` initializer                 |
| [`revealui`](packages/revealui)                         | Meta-installer (proxies to `create-revealui`; unpublished) |

### Pro (Commercial)

| Package                                                 | Purpose                                           |
| ------------------------------------------------------- | ------------------------------------------------- |
| [`@revealui/ai`](packages/ai)                           | AI agents, CRDT memory, LLM providers             |
| [`@revealui/engines`](packages/engines)                 | Unified entry point for the five primitives (private) |
| [`@revealui/harnesses`](packages/harnesses)             | AI harness adapters and workboard coordination    |
| [`@revealui/mcp`](packages/mcp)                         | MCP hypervisor, adapter framework, tool discovery |
| [`@revealui/services`](packages/services)               | Stripe (billing + circuit breaker), transactional email (Gmail API) |

### Internal Package (no license, build tooling) — 1

| Package                                                 | Purpose                                           |
| ------------------------------------------------------- | ------------------------------------------------- |
| [`@revealui/scripts`](packages/scripts)                 | Shared monorepo script utilities — build tooling, not for external consumption |

## Tech stack

| Layer     | Technology                                  |
| --------- | ------------------------------------------- |
| Frontend  | React 19, Tailwind CSS v4                   |
| Backend   | Node.js 24, Hono, REST + OpenAPI            |
| Database  | NeonDB (Postgres), Drizzle ORM             |
| Auth      | Session-based, bcrypt, RBAC + ABAC          |
| Rich Text | Lexical editor                              |
| Sync      | ElectricSQL _(experimental)_                |
| Billing   | Stripe (checkout, subscriptions, webhooks)  |
| Desktop   | Tauri 2                                     |
| TUI       | Go, Bubble Tea                              |
| Testing   | Vitest, Playwright                          |
| Tooling   | pnpm, Turborepo, Biome, TypeScript 6       |
| Dev env   | Nix flakes + direnv                         |

## Prerequisites

- Node.js 24+
- pnpm 10+
- PostgreSQL database ([NeonDB](https://neon.tech) free tier works)
- Stripe account (for billing features)

## Quick start

### Option A: Local development (recommended)

```bash
git clone https://github.com/RevealUIStudio/revealui.git
cd revealui
pnpm install

# Set up environment
cp apps/admin/.env.example apps/admin/.env.local
# Edit .env.local: set POSTGRES_URL, REVEALUI_SECRET (min 32 chars),
# REVEALUI_PUBLIC_SERVER_URL=http://localhost:4000

# Initialize database
pnpm db:migrate
pnpm db:seed

# Start admin dashboard + API
pnpm dev:app    # Admin (port 4000) + API (port 3004)
```

Three dev modes:
- `pnpm dev:app`: Admin + API (recommended for most work)
- `pnpm dev:admin`: Admin only (if API already running)
- `pnpm dev`: All apps in parallel (heavy)

### Option B: Docker Compose

```bash
cp .env.production.example .env
# Edit .env with your values
docker compose up -d
```

Services: PostgreSQL (5432), API (3004), Admin (4000), Marketing (3000).

### Option C: Dev Containers

Open in VS Code or GitHub Codespaces. The `.devcontainer/` config handles everything.

| Platform    | Recommended setup                 |
| ----------- | --------------------------------- |
| Linux / WSL | Nix flakes + direnv (`flake.nix`) |
| macOS       | Nix flakes + direnv (`flake.nix`) |
| Windows     | WSL 2 (recommended) or Dev Containers (`.devcontainer/`) |

## Project structure

```
revealui/
├── apps/
│   ├── server/     # Hono REST API (port 3004)
│   ├── admin/      # Admin dashboard + content management (port 4000)
│   ├── docs/       # Documentation site (port 3002)
│   └── marketing/  # revealui.com marketing site (port 3000)
├── packages/       # 23 OSS + 5 Pro + 1 internal = 29 packages
├── docs/           # guides + reference
└── scripts/        # CI gates, release tooling, dev tools
```

## Documentation

- **[Build Your Business](docs/BUILD_YOUR_BUSINESS.md):** End-to-end tutorial: scaffold, collections, pricing, billing, deploy
- **[Quick Start](docs/QUICK_START.md):** From zero to running app
- **[Design Principles](docs/JOSHUA.md):** Six engineering principles  -  Justifiable, Orthogonal, Sovereign, Hermetic, Unified, Adaptive  -  and the evidence behind each
- **[Architecture](docs/ARCHITECTURE.md):** How the pieces fit together
- **[Harness Protocol](docs/HARNESS_PROTOCOL.md):** Agent-tool coordination layer shipped in `@revealui/harnesses`
- **[Pro](docs/PRO.md):** AI features, MCP, marketplace, and trust controls
- **[Database Guide](docs/DATABASE.md):** Schema, migrations, queries
- **[Auth Guide](docs/AUTH.md):** Authentication, sessions, RBAC
- **[Admin Guide](docs/ADMIN_GUIDE.md):** Collections, fields, access control
- **[Testing](docs/TESTING.md):** Vitest, Playwright, coverage
- **[Deployment](docs/guides/deployment.md):** Vercel, Fly, or self-host
- **[All docs](docs/INDEX.md):** Full documentation index

## Contributing

Read [CONTRIBUTING.md](CONTRIBUTING.md) first. Then:

```bash
pnpm test       # run tests
pnpm lint       # lint and format
pnpm typecheck  # type check
pnpm gate       # full CI gate (runs before push)
```

## Community

- [GitHub Discussions](https://github.com/RevealUIStudio/revealui/discussions)
- [GitHub Issues](https://github.com/RevealUIStudio/revealui/issues)

## Sponsors

RevealUI is MIT-licensed and free to use. Sponsorship funds development, documentation, and community support.

[![Sponsor on GitHub](https://img.shields.io/badge/Sponsor-GitHub-ea4aaa?logo=github-sponsors&logoColor=white)](https://github.com/sponsors/RevealUIStudio)

- **Individuals:** [github.com/sponsors/RevealUIStudio](https://github.com/sponsors/RevealUIStudio)
- **Businesses:** [revealui.com/sponsor](https://revealui.com/sponsor) for Gold and Platinum tiers (logo placement, office hours, roadmap input)

## License

This repository is dual-licensed:

- **OSS packages** (most of the repo, including every `@revealui/*` package without its own in-package `LICENSE` file): MIT — see [LICENSE](LICENSE).
- **Pro packages** (`@revealui/ai`, `@revealui/engines`, `@revealui/harnesses`, `@revealui/mcp`, `@revealui/services`): Functional Source License v1.1 with MIT Future License (FSL-1.1-MIT) — source-available for non-competing use, automatically converts to MIT on each package's Change Date (~2 years from first FSL publish). See [LICENSE.commercial](LICENSE.commercial) for the dual-license explainer and each Pro package's `LICENSE` file for canonical terms.

For commercial licensing alternatives or licensing questions: founder@revealui.com.

---

<div align="center">

Built by [RevealUI Studio](https://revealuistudio.com) — the agency. Operated by REVEALUI STUDIO L.L.C. (Tennessee).

</div>
