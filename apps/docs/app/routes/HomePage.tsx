import { renderMarkdown } from '../utils/markdown'

export function HomePage() {
  const content = `# RevealUI Documentation

Open-source business infrastructure for software companies. Users, content, products, payments, and AI — pre-wired and ready to deploy.

## Quick Start

\`\`\`bash
npx create-revealui@latest my-app
cd my-app
cp .env.example .env
pnpm db:migrate
pnpm dev
\`\`\`

Open [http://localhost:4000/admin](http://localhost:4000/admin) to see the CMS dashboard.

See the [Quick Start guide](/guides/quick-start) for the full walkthrough, or browse the [Examples](/guides/examples) for complete project starters.

## Documentation Sections

### Getting Started
- [Quick Start](/guides/quick-start) - Get running in 5 minutes
- [Examples](/guides/examples) - Blog, SaaS starter, e-commerce storefront

### Core Concepts
- [CMS Guide](/docs/CMS_GUIDE) - Collections, fields, access control, rich text
- [Authentication](/docs/AUTH) - Session-based auth, sign in/up, rate limiting
- [Database](/docs/DATABASE) - Drizzle ORM, migrations, type-safe queries
- [Component Catalog](/docs/COMPONENT_CATALOG) - 50+ production-ready UI components

### Package Reference
- [Core](/reference/core) - CMS engine, collections, auth, REST handlers
- [Auth](/reference/auth) - Session auth, sign in/up, rate limiting
- [Database](/reference/db) - Drizzle schema, client factory, migrations
- [Presentation](/reference/presentation) - 50+ UI components API
- [Config](/reference/config) - Type-safe env config
- [CLI](/reference/cli) - \`create-revealui\` scaffolding tool
- [Full reference →](/reference)

### REST API
- [REST API Reference](/api) - OpenAPI-documented endpoints for all services

### Deployment
- [Deployment Guide](/deployment/DEPLOYMENT) - Deploy to Vercel, Railway, or self-host
- [Environment Variables](/docs/ENVIRONMENT_VARIABLES_GUIDE) - All env var reference

### Pro (AI, MCP, BYOK)
- [Pro documentation](/pro) - AI agents, MCP servers, BYOK, The Creator

## Contributing

Found an issue or want to improve the docs? See our [Contributing Guide](https://github.com/RevealUIStudio/revealui/blob/main/CONTRIBUTING.md).
`

  return <div>{renderMarkdown(content)}</div>
}
