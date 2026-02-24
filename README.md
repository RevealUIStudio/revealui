<div align="center">

# RevealUI

**The full-stack React framework with everything built in.**

Build production-ready apps with a native headless CMS, authentication, database, UI components, and real-time sync — all from a single `npx` command.

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)
[![React 19](https://img.shields.io/badge/React-19-61dafb.svg)](https://react.dev)
[![Next.js 16](https://img.shields.io/badge/Next.js-16-black.svg)](https://nextjs.org)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.9-blue.svg)](https://www.typescriptlang.org/)
[![Node.js 24](https://img.shields.io/badge/Node.js-24-339933.svg)](https://nodejs.org/)

[Documentation](https://docs.revealui.com) | [Quick Start](#quick-start) | [Discord](https://discord.gg/revealui) | [Contributing](CONTRIBUTING.md)

</div>

---

## Quick Start

```bash
git clone https://github.com/RevealUIStudio/revealui.git my-app
cd my-app
pnpm install
cp .env.template .env.development.local
pnpm dev
```

Open [http://localhost:4000/admin](http://localhost:4000/admin) to see the CMS dashboard.

## What's Included

RevealUI gives you a complete application stack out of the box:

- **Headless CMS** — Collections, fields, rich text (Lexical), media management, draft/live preview
- **Authentication** — Session-based auth with sign in/up, password reset, role-based access control, rate limiting
- **Database** — Drizzle ORM with NeonDB (Postgres), migrations, type-safe queries
- **UI Components** — 50+ production-ready components built with Tailwind CSS v4
- **Real-time Sync** — ElectricSQL + Yjs sync for collaborative editing (provisioning required)
- **Type Safety** — Zod schemas + TypeScript contracts across the entire stack
- **API Layer** — REST API with automatic CRUD for all collections

## Packages

RevealUI is a modular monorepo. Use what you need:

| Package | Description |
|---------|-------------|
| [`@revealui/core`](packages/core) | CMS framework, collections, fields, access control, rich text |
| [`@revealui/contracts`](packages/contracts) | Zod schemas, type contracts, block types |
| [`@revealui/db`](packages/db) | Drizzle ORM schema, migrations, client factory |
| [`@revealui/auth`](packages/auth) | Session-based auth, sign in/up, rate limiting |
| [`@revealui/presentation`](packages/presentation) | UI component library (50+ components) |
| [`@revealui/router`](packages/router) | Lightweight file-based router |
| [`@revealui/config`](packages/config) | Configuration management |
| [`@revealui/utils`](packages/utils) | Logger, database helpers, validation |
| [`@revealui/cli`](packages/cli) | Project scaffolding tool (not yet published to npm) |
| [`@revealui/setup`](packages/setup) | Environment setup utilities |
| [`@revealui/sync`](packages/sync) | ElectricSQL real-time sync |

## Example: Define a Collection

```typescript
import { defineCollection, defineField } from '@revealui/core'

const Posts = defineCollection({
  slug: 'posts',
  fields: [
    defineField({ name: 'title', type: 'text', required: true }),
    defineField({ name: 'content', type: 'richText' }),
    defineField({ name: 'author', type: 'relationship', relationTo: 'users' }),
    defineField({ name: 'status', type: 'select', options: ['draft', 'published'] }),
  ],
  access: {
    read: () => true,
    create: ({ req }) => !!req.user,
  },
})
```

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 19, Next.js 16, Tailwind CSS v4 |
| Backend | Node.js 24, Hono, REST API |
| Database | NeonDB (Postgres), Drizzle ORM |
| Auth | Session-based, bcrypt, rate limiting |
| Rich Text | Lexical editor |
| Storage | Vercel Blob |
| Sync | ElectricSQL |
| Testing | Vitest, Playwright |
| Tooling | pnpm, Turborepo, Biome, TypeScript 5.9 |

## Development Setup

```bash
# Clone the repo
git clone https://github.com/RevealUIStudio/revealui.git
cd revealui

# Install dependencies
pnpm install

# Set up environment
cp .env.template .env.development.local
# Edit .env.development.local with your database credentials

# Start development
pnpm dev
```

### Prerequisites

- Node.js 24.13.0+
- pnpm 9.14.2+
- PostgreSQL database (we recommend [NeonDB](https://neon.tech) — free tier available)

### Environment Options

| Platform | Recommended Setup |
|----------|------------------|
| Linux / WSL | Nix flakes + direnv (see `flake.nix`) |
| Windows / Mac | Dev Containers (see `.devcontainer/`) |
| Any | Manual setup (see [Quick Start Guide](docs/QUICK_START.md)) |

## Project Structure

```
revealui/
├── apps/
│   ├── api/           # API service
│   ├── cms/           # Next.js CMS application
│   ├── dashboard/     # Monitoring dashboard
│   ├── docs/          # Documentation site
│   ├── landing/       # Marketing site
│   └── web/           # Web application
├── packages/          # Shared packages (see table above)
├── docs/              # Documentation (100+ guides)
├── e2e/               # End-to-end tests
├── examples/          # Example projects
└── scripts/           # Build and maintenance scripts
```

## Documentation

- **[Quick Start Guide](docs/QUICK_START.md)** — Get running in 5 minutes
- **[Architecture](docs/ARCHITECTURE.md)** — System design and patterns
- **[API Reference](docs/API_REFERENCE.md)** — REST API documentation
- **[Database Guide](docs/DATABASE.md)** — Schema, migrations, queries
- **[Deployment](docs/CI_CD_GUIDE.md)** — Deploy to Vercel, Railway, or self-host
- **[Testing](docs/testing/TESTING-STRATEGY.md)** — Testing guidelines and strategy
- **[All Documentation](docs/README.md)** — Full documentation index

## Contributing

We welcome contributions! Please read our [Contributing Guide](CONTRIBUTING.md) before submitting a PR.

```bash
# Run tests
pnpm test

# Lint and format
pnpm lint

# Type check
pnpm typecheck
```

See [CONTRIBUTING.md](CONTRIBUTING.md) for detailed guidelines on code style, commit conventions, and the PR process.

## Community

- [GitHub Discussions](https://github.com/RevealUIStudio/revealui/discussions) — Ask questions and share ideas
- [Discord](https://discord.gg/revealui) — Chat with the community
- [GitHub Issues](https://github.com/RevealUIStudio/revealui/issues) — Report bugs and request features
- [Twitter/X](https://twitter.com/RevealUI) — Follow for updates

## Sponsors

RevealUI is free and open source. If it helps you build amazing projects, consider [sponsoring the project](https://github.com/sponsors/RevealUIStudio).

## License

[MIT](LICENSE)

---

<div align="center">

Built by [RevealUI Studio](https://revealui.com)

</div>
