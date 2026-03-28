import { renderMarkdown } from '../utils/markdown';

export function HomePage() {
  const content = `# RevealUI Documentation

Business Operating System Software (B.O.S.S.). Users, content, products, payments, and AI — pre-wired, open source, and ready to deploy.

## Quick Start

\`\`\`bash
npx create-revealui@latest my-app
cd my-app
cp .env.template .env
pnpm db:migrate
pnpm dev
\`\`\`

Open [http://localhost:4000/admin](http://localhost:4000/admin) to see the admin dashboard.

See the [Quick Start guide](/docs/QUICK_START) for the full walkthrough, or browse the [Examples](/docs/EXAMPLES) for complete project starters.

---

## Documentation Sections

### Getting Started
- [Quick Start](/docs/QUICK_START) — Get running in 5 minutes
- [Build Your Business](/docs/BUILD_YOUR_BUSINESS) — End-to-end tutorial: scaffold to deploy
- [Examples](/docs/EXAMPLES) — Blog, SaaS starter, e-commerce storefront

### Core Guides
- [CMS Guide](/docs/CMS_GUIDE) — Collections, fields, access control, rich text
- [Authentication](/docs/AUTH) — Session-based auth, sign in/up, rate limiting
- [Database](/docs/DATABASE) — Drizzle ORM, migrations, type-safe queries
- [CI/CD & Deployment](/docs/CI_CD_GUIDE) — Deploy to Vercel, Railway, or self-host
- [Environment Variables](/docs/ENVIRONMENT_VARIABLES_GUIDE) — All env var reference
- [Testing](/docs/TESTING) — Unit, integration, and E2E testing patterns

### Architecture
- [System Architecture](/docs/ARCHITECTURE) — Monorepo structure, dual-DB design, patterns
- [Performance](/docs/PERFORMANCE) — Optimization, caching, CDN strategies
- [Standards](/docs/STANDARDS) — Code style, conventions, contribution guidelines

### Reference
- [Package Reference](/docs/REFERENCE) — All packages: core, auth, db, contracts, presentation, router, CLI
- [Component Catalog](/docs/COMPONENT_CATALOG) — 50+ production-ready UI components
- [AI](/docs/AI) — AI agents, prompt/response/semantic caching

### Pro (AI, MCP, BYOK)
- [Pro documentation](/docs/PRO) — MCP servers, BYOK, editor integrations
- [Local-First Setup](/docs/LOCAL_FIRST) — BitNet + RevVault + Nix: run the full stack on your own hardware

### Blog
- [Why We Built RevealUI](/docs/blog/01-why-we-built-revealui) — The problem we're solving
- [HTTP 402 Payments](/docs/blog/02-http-402-payments) — Native payment-required protocol
- [Multi-Agent Coordination](/docs/blog/03-multi-agent-coordination) — AI agents working together
- [The Air-Gap Capable Stack](/docs/blog/04-local-first-ai-stack) — Local AI, encrypted secrets, reproducible environments

---

## Contributing

Found an issue or want to improve the docs? See our [Contributing Guide](https://github.com/RevealUIStudio/revealui/blob/main/CONTRIBUTING.md).
`;

  return <div>{renderMarkdown(content)}</div>;
}
