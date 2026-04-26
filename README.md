<div align="center">

# RevealUI

**Agentic business runtime.**

Users. Content. Products. Payments. Intelligence. Five primitives for humans and agents, one deployment, one runtime.

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
- **57 UI components:** built with Tailwind CSS v4, zero external UI dependencies
- **13 MCP servers:** agents discover and use your business data through the same API humans use
- **Type-safe throughout:** Zod schemas shared between client, server, database, and agent tools

No assembly required. Define your data once. Humans manage it through the dashboard, agents operate on it through MCP. Same permissions, same audit trail.

## The five primitives

| Primitive        | For you                                                          | For your agents                                              |
| ---------------- | ---------------------------------------------------------------- | ------------------------------------------------------------ |
| **Users**        | Session auth, RBAC + ABAC, rate limiting, GDPR compliance        | Same RBAC governs agent access. Every action auditable.      |
| **Content**      | Collections, rich text (Lexical), media, draft/live, REST API    | Collections auto-exposed as MCP tools. No integration step.  |
| **Products**     | Product catalog, pricing tiers, usage tracking                   | Feature gates control which agent capabilities unlock.       |
| **Payments**     | Stripe checkout, subscriptions, webhooks, billing portal         | x402 micropayments via RevealCoin. Agents transact natively. |
| **Intelligence** | AI agents, open-model inference, task history _(Pro)_            | A2A protocol, CRDT memory, 13 MCP servers.                   |

## The JOSHUA Stack

Six principles that give you a tested starting point for every architectural decision. Not the only way, a way that works. Evolve it as you grow:

| Principle | What it means |
| --- | --- |
| **Justifiable** | Every default earns its place. No magic, no hidden complexity, no decisions you can't explain to your team. |
| **Orthogonal** | Clean separation of concerns across 26 packages. Use what you need, replace what you don't. Zero circular dependencies. |
| **Sovereign** | Your infrastructure, your data, your rules. Deploy anywhere. Fork anything. No vendor holds your business hostage. |
| **Hermetic** | Auth doesn't leak into billing. Content doesn't tangle with payments. Sealed boundaries, clean contracts between every layer. |
| **Unified** | One Zod schema defines the truth. Types, validation, and API flow from database to server to UI with zero drift. |
| **Adaptive** | AI agents, MCP servers, and workflows are built into the foundation. Open-model inference, sovereign by design, evolving with your business. |

## Ecosystem

RevealUI is the runtime at the center of a four-project ecosystem:

| Project        | Purpose                                          | License           |
| -------------- | ------------------------------------------------ | ----------------- |
| **RevealUI**   | Agentic business runtime (this repo)             | MIT + Commercial  |
| **RevVault**   | Age-encrypted secret vault (Rust CLI + desktop)  | MIT + Pro         |
| **RevKit**     | Portable dev environment toolkit (WSL, Docker)   | MIT + Max         |
| **RevealCoin** | Solana token for x402 agent micropayments        | Forge             |

Each project stands alone. Together, they cover the full lifecycle of building, securing, coordinating, and monetizing software, for you and for your agents.

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
- **Open-model inference:** Ubuntu Inference Snaps (recommended), Ollama, and open source models via the RevealUI harness. `sudo snap install nemotron-3-nano` for instant local AI. No proprietary APIs, no vendor lock-in, zero API bills
- **Task history:** every agent action logged, auditable, and visible in the dashboard
- **Editor config sync:** generate and sync settings for Zed, VS Code, Cursor, and Antigravity

Pro packages are source-available under the [Functional Source License (FSL-1.1-MIT)](packages/ai/LICENSE). You can read, modify, and self-host. The license converts to MIT after 2 years. Install with `pnpm add @revealui/ai`.

## Tiers

| Tier           | Price     | What you get                                                       |
| -------------- | --------- | ------------------------------------------------------------------ |
| **Free**       | $0        | Full OSS core: users, content, products, payments, admin             |
| **Pro**        | $49/mo    | Studio desktop app, AI agents, MCP framework, open-model inference, advanced sync, RevVault desktop + rotation engine |
| **Max**        | $149/mo   | Full AI memory, audit log, higher limits, RevKit environment provisioning         |
| **Forge**      | $299/mo   | Multi-tenant, SSO (planned — [#449](https://github.com/RevealUIStudio/revealui/issues/449)), domain-locked, RevealCoin x402 agent payments       |

## Apps

| App          | Framework        | Purpose                                      |
| ------------ | ---------------- | -------------------------------------------- |
| `api`        | Hono             | REST API with OpenAPI + Swagger              |
| `admin`      | Next.js 16       | Admin dashboard + content management         |
| `docs`       | Vite + React     | Documentation site                           |
| `marketing`  | Next.js          | Marketing site + waitlist                    |
| `studio`     | Tauri 2 + React  | Native AI experience: agent coordination hub, local inference management, visual agent dashboard |
| `terminal`   | Go (Bubble Tea)  | TUI client (API integration, QR checkout)    |
| `revealcoin` | Next.js          | RevealCoin token explorer (experimental)     |

## Packages

### OSS (MIT)

| Package                                                 | Purpose                                           |
| ------------------------------------------------------- | ------------------------------------------------- |
| [`@revealui/core`](packages/core)                       | Runtime engine, REST API, auth, rich text, plugins |
| [`@revealui/contracts`](packages/contracts)             | Zod schemas + TypeScript types (single source)    |
| [`@revealui/db`](packages/db)                           | Drizzle ORM schema (81 tables), dual-DB client     |
| [`@revealui/auth`](packages/auth)                       | Session auth, password reset, rate limiting       |
| [`@revealui/presentation`](packages/presentation)       | 57 UI components (Tailwind v4, zero ext deps)     |
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
| [`@revealui/mcp`](packages/mcp)                         | MCP hypervisor, adapter framework, tool discovery |
| [`@revealui/services`](packages/services)               | Stripe + Supabase integrations                    |
| [`@revealui/test`](packages/test)                       | E2E specs, integration tests, fixtures, mocks     |
| [`create-revealui`](packages/create-revealui)           | `npm create revealui` initializer                 |

### Pro (Commercial)

| Package                                                 | Purpose                                           |
| ------------------------------------------------------- | ------------------------------------------------- |
| [`@revealui/ai`](packages/ai)                           | AI agents, CRDT memory, LLM providers             |
| [`@revealui/harnesses`](packages/harnesses)             | AI harness adapters and workboard coordination    |

## Tech stack

| Layer     | Technology                                  |
| --------- | ------------------------------------------- |
| Frontend  | React 19, Tailwind CSS v4                   |
| Backend   | Node.js 24, Hono, REST + OpenAPI            |
| Database  | NeonDB (Postgres) + Supabase, Drizzle ORM  |
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
│   ├── api/        # Hono REST API (port 3004)
│   ├── admin/      # Admin dashboard + content management (port 4000)
│   ├── docs/       # Documentation site (port 3002)
│   ├── marketing/  # Marketing site (port 3000)
│   ├── revealcoin/ # RevealCoin token explorer (experimental)
│   ├── studio/     # Native AI experience (Tauri 2)
│   └── terminal/   # TUI client (Go)
├── packages/       # 18 OSS + 5 Pro packages
├── docs/           # 25 guides
└── scripts/        # CI gates, release tooling, dev tools
```

## Documentation

- **[Build Your Business](docs/BUILD_YOUR_BUSINESS.md):** End-to-end tutorial: scaffold, collections, pricing, billing, deploy
- **[Quick Start](docs/QUICK_START.md):** From zero to running app
- **[The JOSHUA Stack](docs/JOSHUA.md):** Six engineering principles and the evidence behind them
- **[Architecture](docs/ARCHITECTURE.md):** How the pieces fit together
- **[The VAUGHN Protocol](docs/VAUGHN.md):** Multi-agent coordination across heterogeneous AI tools
- **[Pro](docs/PRO.md):** AI features, MCP, marketplace, and trust controls
- **[Database Guide](docs/DATABASE.md):** Schema, migrations, queries
- **[Auth Guide](docs/AUTH.md):** Authentication, sessions, RBAC
- **[Admin Guide](docs/ADMIN_GUIDE.md):** Collections, fields, access control
- **[Testing](docs/TESTING.md):** Vitest, Playwright, coverage
- **[Deployment](docs/CI_CD_GUIDE.md):** Vercel, Railway, or self-host
- **[All docs](docs/INDEX.md):** Full index (25 guides)

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
- [Discourse Community](https://revnation.discourse.group)
- [GitHub Issues](https://github.com/RevealUIStudio/revealui/issues)

## Sponsors

RevealUI is MIT-licensed and free to use. Sponsorship funds development, documentation, and community support.

[![Sponsor on GitHub](https://img.shields.io/badge/Sponsor-GitHub-ea4aaa?logo=github-sponsors&logoColor=white)](https://github.com/sponsors/RevealUIStudio)

- **Individuals:** [github.com/sponsors/RevealUIStudio](https://github.com/sponsors/RevealUIStudio)
- **Businesses:** [revealui.com/sponsor](https://revealui.com/sponsor) for Gold and Platinum tiers (logo placement, office hours, roadmap input)

## License

This repository is dual-licensed:

- **OSS packages** (most of the repo, including every `@revealui/*` package without its own in-package `LICENSE` file): MIT — see [LICENSE](LICENSE).
- **Pro packages** (`@revealui/ai`, `@revealui/harnesses`): Functional Source License v1.1 with MIT Future License (FSL-1.1-MIT) — source-available for non-competing use, automatically converts to MIT on each package's Change Date (~2 years from first FSL publish). See [LICENSE.commercial](LICENSE.commercial) for the dual-license explainer and each Pro package's `LICENSE` file for canonical terms.

For commercial licensing alternatives or licensing questions: founder@revealui.com.

---

<div align="center">

Built by [RevealUI Studio](https://revealui.com)

</div>
