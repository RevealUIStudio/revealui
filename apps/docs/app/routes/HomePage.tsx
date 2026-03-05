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

See the [Quick Start guide](/docs/QUICK_START) for the full walkthrough, or browse the [Examples](/docs/examples) for complete project starters.

## Documentation Sections

### Getting Started
- [Quick Start](/docs/QUICK_START) - Get running in 5 minutes
- [Build Your Business](/docs/BUILD_YOUR_BUSINESS) - End-to-end tutorial: scaffold to deploy
- [Examples](/docs/examples) - Blog, SaaS starter, e-commerce storefront

### Core Guides
- [CMS Guide](/docs/CMS_GUIDE) - Collections, fields, access control, rich text
- [Authentication](/docs/AUTH) - Session-based auth, sign in/up, rate limiting
- [Database](/docs/DATABASE) - Drizzle ORM, migrations, type-safe queries
- [CI/CD & Deployment](/docs/CI_CD_GUIDE) - Deploy to Vercel, Railway, or self-host
- [Environment Variables](/docs/ENVIRONMENT_VARIABLES_GUIDE) - All env var reference

### Reference
- [Package Reference](/docs/REFERENCE) - All packages: core, auth, db, contracts, presentation, utils, router, CLI
- [Component Catalog](/docs/COMPONENT_CATALOG) - 50+ production-ready UI components
- [AI](/docs/AI) - AI agents, prompt/response/semantic caching

### Pro (AI, MCP, BYOK)
- [Pro documentation](/docs/PRO) - MCP servers, BYOK, editor integrations, The Creator

## Contributing

Found an issue or want to improve the docs? See our [Contributing Guide](https://github.com/RevealUIStudio/revealui/blob/main/CONTRIBUTING.md).
`

  return <div>{renderMarkdown(content)}</div>
}
