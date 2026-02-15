import { renderMarkdown } from '../utils/markdown'

export function HomePage() {
  const content = `# RevealUI Documentation

Welcome to the RevealUI framework documentation. RevealUI is a full-stack React framework with a native headless CMS, authentication, database, UI components, and real-time sync.

## Quick Start

\`\`\`bash
npx create-revealui@latest my-app
cd my-app
pnpm dev
\`\`\`

Open [http://localhost:4000/admin](http://localhost:4000/admin) to see the CMS dashboard.

## Documentation Sections

### Getting Started
- [Quick Start](/docs/QUICK_START) - Get running in 5 minutes
- [Tutorial](/docs/TUTORIAL) - Hands-on tutorial
- [Development Guide](/docs/DEVELOPMENT_GUIDE) - Development workflow

### Core Concepts
- [CMS Guide](/docs/CMS_GUIDE) - Collections, fields, access control, rich text
- [Authentication](/docs/AUTH) - Session-based auth, sign in/up, rate limiting
- [Database](/docs/DATABASE) - Drizzle ORM, migrations, type-safe queries
- [Component Catalog](/docs/COMPONENT_CATALOG) - 50+ production-ready UI components

### API & Reference
- [API Reference](/api) - REST API documentation for all packages
- [Architecture](/docs/ARCHITECTURE) - System design and patterns

### Operations
- [Deployment](/deployment) - Deploy to Vercel, Railway, or self-host
- [CI/CD Guide](/docs/CI_CD_GUIDE) - GitHub Actions workflows
- [Testing](/docs/TESTING) - Testing strategy and guides
- [Security](/docs/SECURITY) - Security policy and audit

### Advanced
- [Development](/development) - Performance optimization, caching, bundle analysis
- [AI](/ai) - Prompt caching, response caching, semantic caching

## Packages

| Package | Description |
|---------|-------------|
| \`@revealui/core\` | CMS framework, collections, fields, access control, rich text |
| \`@revealui/contracts\` | Zod schemas, type contracts, block types |
| \`@revealui/db\` | Drizzle ORM schema, migrations, client factory |
| \`@revealui/auth\` | Session-based auth, sign in/up, rate limiting |
| \`@revealui/presentation\` | UI component library (50+ components) |
| \`@revealui/router\` | Lightweight file-based router |
| \`@revealui/config\` | Configuration management |
| \`@revealui/utils\` | Logger, database helpers, validation |
| \`@revealui/cli\` | \`create-revealui\` scaffolding tool |
| \`@revealui/sync\` | ElectricSQL real-time sync |

## Contributing

Found an issue or want to improve the docs? See our [Contributing Guide](https://github.com/RevealUIStudio/revealui/blob/main/CONTRIBUTING.md).
`

  return <div>{renderMarkdown(content)}</div>
}
