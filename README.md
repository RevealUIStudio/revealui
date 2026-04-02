<div align="center">

# RevealUI

**Agentic business runtime.**

Users. Content. Products. Payments. Intelligence. Five primitives, one deployment — build your business, not your boilerplate.

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)
[![React 19](https://img.shields.io/badge/React-19-61dafb.svg)](https://react.dev)
[![TypeScript](https://img.shields.io/badge/TypeScript-6-blue.svg)](https://www.typescriptlang.org/)
[![Node.js 24](https://img.shields.io/badge/Node.js-24-339933.svg)](https://nodejs.org/)

[Documentation](https://docs.revealui.com) | [Quick Start](#quick-start) | [Pro](#pro-ai-for-your-business) | [Contributing](CONTRIBUTING.md)

</div>

---

RevealUI is an open-source runtime that ships the business logic layer every software product needs — auth, content, products, billing, and AI agents — pre-wired and production-tested. Instead of assembling a dozen services, you start on day one with a running business and agents that natively operate on your data.

## What you get on day one

```bash
npx create-revealui my-business
cd my-business
pnpm dev
```

Open [http://localhost:4000/admin](http://localhost:4000/admin).

You have:

- **User accounts** — sign up, sign in, password reset, sessions, RBAC, rate limiting, brute force protection
- **Content management** — define collections in TypeScript, get a full REST API and admin UI instantly
- **Billing** — Stripe checkout, subscriptions, trials, webhooks, grace periods, and a billing portal
- **Admin dashboard** — manage users, content, billing, and settings out of the box
- **52 UI components** — built with Tailwind CSS v4, zero external UI dependencies
- **Type-safe throughout** — Zod schemas shared between client, server, and database

No assembly required. No consulting 12 different documentation sites. No decisions about which auth library to use.

## The five primitives

| Primitive        | What RevealUI ships                                                                |
| ---------------- | ---------------------------------------------------------------------------------- |
| **Users**        | Session auth, bcrypt, RBAC + ABAC policy engine, rate limiting, GDPR compliance    |
| **Content**      | Collections, rich text (Lexical), relationships, media, draft/live, REST + OpenAPI |
| **Products**     | Product catalog, pricing tiers, metered services, usage tracking                   |
| **Payments**     | Stripe checkout, subscriptions, trials, webhooks, grace periods, usage meters      |
| **Intelligence** | AI agents, MCP servers, BYOK multi-provider, task history _(Pro)_                  |

## The JOSHUA Stack

Six principles that give you a tested starting point for every architectural decision. Not the only way — a way that works. Evolve it as you grow:

| Principle | What it means |
| --- | --- |
| **Justifiable** | Every default earns its place. No magic, no hidden complexity, no decisions you can't explain to your team. |
| **Orthogonal** | Clean separation of concerns across 23 packages. Use what you need, replace what you don't. Zero circular dependencies. |
| **Sovereign** | Your infrastructure, your data, your rules. Deploy anywhere. Fork anything. No vendor holds your business hostage. |
| **Hermetic** | Auth doesn't leak into billing. Content doesn't tangle with payments. Sealed boundaries, clean contracts between every layer. |
| **Unified** | One Zod schema defines the truth. Types, validation, and API flow from database to server to UI with zero drift. |
| **Adaptive** | AI agents, MCP servers, and workflows are built into the foundation. Swap providers, add capabilities, evolve with your business. |

## Ecosystem

RevealUI is the runtime at the center of a four-project ecosystem:

| Project        | Purpose                                          | License           |
| -------------- | ------------------------------------------------ | ----------------- |
| **RevealUI**   | Agentic business runtime (this repo)             | MIT + Commercial  |
| **RevVault**   | Age-encrypted secret vault (Rust CLI + desktop)  | MIT + Pro         |
| **RevKit**     | Portable dev environment toolkit (WSL, Docker)   | MIT + Max         |
| **RevealCoin** | Solana token for x402 agent micropayments        | Forge             |

Each project stands alone. Together, they cover the full lifecycle of building, securing, coordinating, and monetizing agentic software.

## Define your business data

Add a collection. Get an API, admin UI, and TypeScript types — automatically.

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

`GET /api/products` is live. The admin UI is live. The TypeScript types are generated.

## Pro: AI for your business

The [Pro tier](https://revealui.com/pro) adds AI agents and automation that work on your behalf:

- **AI agent system** — build and deploy purpose-built agents for your workflows
- **MCP framework** — hypervisor, adapter framework, and tool discovery for connecting agents to external services
- **BYOK** — bring your own API keys (Anthropic, Groq, Gemini) — your keys, your costs
- **Task history** — every agent action logged, auditable, and visible in the dashboard
- **Editor config sync** — generate and sync settings for Zed, VS Code, Cursor, and Antigravity

Pro packages are source-available on npm under a [commercial license](LICENSE.commercial). Install with `pnpm add @revealui/ai` — no special registry needed.

## Tiers

| Tier           | Price     | What you get                                                       |
| -------------- | --------- | ------------------------------------------------------------------ |
| **Free**       | $0        | Full OSS core — users, content, products, payments, admin          |
| **Pro**        | $49/mo    | AI agents, MCP framework, BYOK, advanced sync, RevVault desktop + rotation engine |
| **Max**        | $149/mo   | Multi-provider AI, audit log, higher limits, RevKit environment provisioning      |
| **Forge**      | $299/mo   | Multi-tenant, SSO (planned), domain-locked, RevealCoin x402 agent payments       |

## Apps

| App          | Framework        | Purpose                                      |
| ------------ | ---------------- | -------------------------------------------- |
| `api`        | Hono             | REST API with OpenAPI + Swagger              |
| `cms`        | Next.js 16       | Admin dashboard + content management         |
| `docs`       | Vite + React     | Documentation site                           |
| `marketing`  | Next.js          | Marketing site + waitlist                    |
| `studio`     | Tauri 2 + React  | Desktop companion (vault, agent coordination, system tray) |
| `terminal`   | Go (Bubble Tea)  | TUI client (API integration, QR checkout)    |
| `revealcoin` | Next.js          | RevealCoin token explorer (experimental)     |

## Packages

### OSS (MIT)

| Package                                                 | Purpose                                           |
| ------------------------------------------------------- | ------------------------------------------------- |
| [`@revealui/core`](packages/core)                       | Runtime engine, REST API, auth, rich text, plugins |
| [`@revealui/contracts`](packages/contracts)             | Zod schemas + TypeScript types (single source)    |
| [`@revealui/db`](packages/db)                           | Drizzle ORM schema (76 tables), dual-DB client    |
| [`@revealui/auth`](packages/auth)                       | Session auth, password reset, rate limiting       |
| [`@revealui/presentation`](packages/presentation)       | 52 UI components (Tailwind v4, zero ext deps)     |
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
| [`create-revealui`](packages/create-revealui)           | `npm create revealui` initializer                 |

### Pro (Commercial)

| Package                                                 | Purpose                                           |
| ------------------------------------------------------- | ------------------------------------------------- |
| [`@revealui/ai`](packages/ai)                           | AI agents, CRDT memory, LLM providers             |
| [`@revealui/mcp`](packages/mcp)                         | MCP hypervisor, adapter framework, tool discovery  |
| [`@revealui/editors`](packages/editors)                 | Editor config sync (Zed, VS Code, Cursor)          |
| [`@revealui/services`](packages/services)               | Stripe + Supabase integrations                    |
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

For contributing to RevealUI itself:

```bash
git clone https://github.com/RevealUIStudio/revealui.git
cd revealui
pnpm install
pnpm dev
```

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
│   ├── cms/        # Admin dashboard + headless CMS (port 4000)
│   ├── docs/       # Documentation site (port 3002)
│   ├── marketing/  # Marketing site (port 3000)
│   ├── revealcoin/ # RevealCoin token explorer (experimental)
│   ├── studio/     # Desktop companion app (Tauri 2)
│   └── terminal/   # TUI client (Go)
├── packages/       # 18 OSS + 5 Pro packages
├── docs/           # 25 guides
└── scripts/        # CI gates, release tooling, dev tools
```

## Documentation

- **[Build Your Business](docs/BUILD_YOUR_BUSINESS.md)** — End-to-end tutorial: scaffold, collections, pricing, billing, deploy
- **[Quick Start](docs/QUICK_START.md)** — From zero to running app
- **[The JOSHUA Stack](docs/JOSHUA.md)** — Six engineering principles and the evidence behind them
- **[Architecture](docs/ARCHITECTURE.md)** — How the pieces fit together
- **[The VAUGHN Protocol](docs/VAUGHN.md)** — Multi-agent coordination across heterogeneous AI tools
- **[Pro](docs/PRO.md)** — AI features, MCP, marketplace, and trust controls
- **[Database Guide](docs/DATABASE.md)** — Schema, migrations, queries
- **[Auth Guide](docs/AUTH.md)** — Authentication, sessions, RBAC
- **[CMS Guide](docs/CMS_GUIDE.md)** — Collections, fields, access control
- **[Testing](docs/TESTING.md)** — Vitest, Playwright, coverage
- **[Deployment](docs/CI_CD_GUIDE.md)** — Vercel, Railway, or self-host
- **[All docs](docs/INDEX.md)** — Full index (25 guides)

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

- **Individuals** — [github.com/sponsors/RevealUIStudio](https://github.com/sponsors/RevealUIStudio)
- **Businesses** — [revealui.com/sponsor](https://revealui.com/sponsor) for Gold and Platinum tiers (logo placement, office hours, roadmap input)

## License

MIT — see [LICENSE](LICENSE).

Pro packages are commercially licensed — see [LICENSE.commercial](LICENSE.commercial).

---

<div align="center">

Built by [RevealUI Studio](https://revealui.com)

</div>
