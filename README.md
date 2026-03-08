<div align="center">

# RevealUI

**Build your business, not your boilerplate.**

Users. Content. Payments. AI. Everything a software business needs — pre-wired, open source, and ready to deploy.

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)
[![React 19](https://img.shields.io/badge/React-19-61dafb.svg)](https://react.dev)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.9-blue.svg)](https://www.typescriptlang.org/)
[![Node.js 24](https://img.shields.io/badge/Node.js-24-339933.svg)](https://nodejs.org/)

[Documentation](https://docs.revealui.com) | [Quick Start](#quick-start) | [Pro](#pro-add-ai-to-your-business) | [Contributing](CONTRIBUTING.md)

</div>

---

Most developers spend weeks assembling the same things before they can build their actual product: user accounts, content management, billing, an admin dashboard. RevealUI ships all of it, pre-wired and production-tested, so you start on day one with a real running business — not a blank slate.

## What you get on day one

```bash
npx create-revealui my-business
cd my-business
pnpm dev
```

Open [http://localhost:4000/admin](http://localhost:4000/admin).

You have:

- **User accounts** — sign up, sign in, password reset, sessions, role-based access control, rate limiting
- **Content management** — define collections in TypeScript, get a full REST API and admin UI instantly
- **Billing** — Stripe checkout, subscriptions, webhooks, license keys, and a billing portal
- **Admin dashboard** — manage users, content, and settings out of the box
- **50+ UI components** — built with Tailwind CSS v4, zero external UI dependencies
- **Type-safe throughout** — Zod schemas shared between client, server, and database

No assembly required. No consulting 12 different documentation sites. No decisions about which auth library to use.

## The five things every software business needs

| Primitive | What RevealUI ships |
|-----------|-------------------|
| **Users** | Session auth, bcrypt, RBAC, rate limiting, brute force protection |
| **Content** | Collections, rich text (Lexical), relationships, media, draft/live, REST API |
| **Products** | Product catalog, pricing tiers, license keys, inventory |
| **Payments** | Stripe checkout, subscriptions, webhooks, billing portal |
| **Intelligence** | AI agents, MCP server integrations, BYOK support *(Pro)* |

## Define your business data

Add a collection. Get an API, admin UI, and TypeScript types — automatically.

```typescript
import { defineCollection, defineField } from '@revealui/core'

const Products = defineCollection({
  slug: 'products',
  fields: [
    defineField({ name: 'name', type: 'text', required: true }),
    defineField({ name: 'price', type: 'number' }),
    defineField({ name: 'description', type: 'richText' }),
    defineField({ name: 'status', type: 'select', options: ['draft', 'active'] }),
    defineField({ name: 'owner', type: 'relationship', relationTo: 'users' }),
  ],
  access: {
    read: ({ req }) => !!req.user,
    create: ({ req }) => req.user?.role === 'admin',
  },
})
```

`GET /api/products` is live. The admin UI is live. The TypeScript types are generated.

## Pro: Add AI to your business

The [Pro tier](https://revealui.com/pro) adds AI agents and automation that work on your behalf:

- **AI agent system** — build and deploy purpose-built agents for your workflows
- **The Creator** — the meta-agent that generates other agents from a description
- **MCP servers** — connect your agents to Stripe, Supabase, Vercel, Neon, and more
- **BYOK** — bring your own API keys (Anthropic, Groq, Gemini) — your keys, your costs
- **Task history** — every agent action logged, auditable, and visible in the dashboard

Pro is commercially licensed. OSS packages remain MIT.

## Packages

RevealUI is a modular monorepo. The OSS core is on npm:

| Package | Purpose |
|---------|---------|
| [`@revealui/core`](packages/core) | Collections, fields, access control, rich text, plugins |
| [`@revealui/contracts`](packages/contracts) | Zod schemas and TypeScript types (shared across the stack) |
| [`@revealui/db`](packages/db) | Drizzle ORM schema, migrations, dual-database client |
| [`@revealui/auth`](packages/auth) | Session auth, password reset, rate limiting |
| [`@revealui/presentation`](packages/presentation) | 50+ UI components (Tailwind v4, zero external UI deps) |
| [`@revealui/router`](packages/router) | Lightweight file-based router with SSR |
| [`@revealui/config`](packages/config) | Type-safe environment configuration |
| [`@revealui/utils`](packages/utils) | Logger, database helpers, validation |
| [`@revealui/cli`](packages/cli) | `create-revealui` scaffolding tool |

### Experimental Packages

| Package | Status |
|---------|--------|
| [`@revealui/sync`](packages/sync) | ⚗️ Experimental — ElectricSQL real-time sync (passthrough only; not production-ready) |

### Pro Packages

Pro packages (`@revealui/ai`, `@revealui/mcp`, `@revealui/editors`, `@revealui/services`, `@revealui/harnesses`) are **not included in this repository**. They are distributed separately via GitHub Packages and require a Pro or higher license key.

To install Pro packages, [purchase a license](https://revealui.com/pro) and follow the [Pro setup guide](https://docs.revealui.com/pro/setup).

## Tech stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 19, Tailwind CSS v4 |
| Backend | Node.js 24, Hono, REST API |
| Database | NeonDB (Postgres), Drizzle ORM |
| Auth | Session-based, bcrypt, rate limiting |
| Rich Text | Lexical editor |
| Billing | Stripe |
| Testing | Vitest, Playwright |
| Tooling | pnpm, Turborepo, Biome, TypeScript 5.9 |

## Prerequisites

- Node.js 24+
- pnpm 10+
- PostgreSQL database ([NeonDB](https://neon.tech) free tier works)
- Stripe account (for billing features)

## Development setup

For contributing to RevealUI itself:

```bash
git clone https://github.com/RevealUIStudio/revealui.git
cd revealui
pnpm install
cp .env.template .env.development.local
# Fill in your database credentials
pnpm dev
```

| Platform | Recommended setup |
|----------|------------------|
| Linux / WSL | Nix flakes + direnv (`flake.nix`) |
| macOS | Nix flakes + direnv (`flake.nix`) |
| Windows | Dev Containers (`.devcontainer/`) |

## Project structure

```
revealui/
├── apps/
│   ├── api/        # Hono REST API
│   ├── cms/        # Admin dashboard + headless CMS (Next.js)
│   ├── docs/       # Documentation site
│   ├── marketing/  # Marketing site
│   └── studio/     # Desktop companion app (Tauri 2)
├── packages/       # OSS packages (see table above)
├── docs/           # 23 guides
└── scripts/        # CI gates, release tooling
```

## Documentation

- **[Build Your Business](docs/BUILD_YOUR_BUSINESS.md)** — End-to-end tutorial: scaffold → collections → billing → deploy
- **[Quick Start](docs/QUICK_START.md)** — From zero to running app
- **[Architecture](docs/ARCHITECTURE.md)** — How the pieces fit together
- **[Database Guide](docs/DATABASE.md)** — Schema, migrations, queries
- **[Deployment](docs/CI_CD_GUIDE.md)** — Vercel, Railway, or self-host
- **[All docs](docs/INDEX.md)** — Full index

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
- [Discord](https://discord.gg/revealui)
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
