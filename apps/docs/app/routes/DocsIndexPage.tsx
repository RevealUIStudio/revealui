import { renderMarkdown } from '../utils/markdown';

export function DocsIndexPage() {
  const content = `# RevealUI Documentation

Agentic business runtime. Users, content, products, payments, and AI  -  pre-wired, open source, and ready to deploy.

## Quick Start

\`\`\`bash
npx create-revealui@latest my-app
cd my-app
cp .env.template .env
pnpm db:migrate
pnpm dev
\`\`\`

Open [http://localhost:4000/admin](http://localhost:4000/admin) to see the admin dashboard.

See the [Quick Start guide](/quick-start) for the full walkthrough, or browse the [Examples](/examples) for complete project starters.

---

## Documentation Sections

### Getting Started
- [Quick Start](/quick-start)  -  Get a local dev stack running
- [Build Your Business](/build-your-business)  -  End-to-end tutorial: scaffold to deploy
- [Examples](/examples)  -  Blog, subscription starter, e-commerce storefront

### Core Guides
- [Admin Guide](/admin-guide)  -  Collections, fields, access control, rich text
- [Authentication](/auth)  -  Session-based auth, sign in/up, rate limiting
- [Database](/database)  -  Drizzle ORM, migrations, type-safe queries
- [CI/CD & Deployment](/ci-cd-guide)  -  Deploy to Vercel, Railway, or self-host
- [Environment Variables](/environment-variables-guide)  -  All env var reference
- [Testing](/testing)  -  Unit, integration, and E2E testing patterns

### Architecture
- [System Architecture](/architecture)  -  Monorepo structure, dual-DB design, patterns
- [Performance](/performance)  -  Optimization, caching, CDN strategies
- [Standards](/standards)  -  Code style, conventions, contribution guidelines

### Reference
- [Package Reference](/reference)  -  All packages: core, auth, db, contracts, presentation, router, CLI
- [REST API](/api/rest-api)  -  OpenAPI reference for all endpoints
- [Component Catalog](/component-catalog)  -  57 pre-wired UI components
- [AI](/ai)  -  AI agents, prompt/response/semantic caching
- [Marketplace](/marketplace)  -  Extensibility and integrations

### Pro & Enterprise
- [Pro documentation](/pro)  -  MCP servers, open-model inference, editor integrations
- [Forge (Enterprise)](/forge)  -  Unlimited sites, users, and AI tasks
- [Local-First Setup](/local-first)  -  Inference Snaps + RevVault + Nix: run the full stack on your own hardware

### Blog
- [Why We Built RevealUI](/blog/01-why-we-built-revealui)  -  The problem we're solving
- [HTTP 402 Payments](/blog/02-http-402-payments)  -  Native payment-required protocol
- [Multi-Agent Coordination](/blog/03-multi-agent-coordination)  -  AI agents working together
- [The Air-Gap Capable Stack](/blog/04-local-first-ai-stack)  -  Local AI, encrypted secrets, reproducible environments
- [The Five Primitives](/blog/05-five-primitives)  -  Users, content, products, payments, AI
- [Open Source & Pro](/blog/06-open-source-and-pro)  -  Our monetization philosophy
- [Agent-First Future](/blog/07-agent-first-future)  -  Building for the agent economy
- [Getting Started in About 30 Minutes](/blog/08-getting-started)  -  From zero to deployed

---

## Contributing

Found an issue or want to improve the docs? See our [Contributing Guide](https://github.com/RevealUIStudio/revealui/blob/main/CONTRIBUTING.md).
`;

  return <div>{renderMarkdown(content)}</div>;
}
