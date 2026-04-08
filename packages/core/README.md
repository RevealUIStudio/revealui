# @revealui/core

The core runtime engine for RevealUI — collections, admin UI, rich text, security, observability, and plugins.

## Features

- **Collections & CRUD** — Define content types with field hooks, access control, and validation
- **Admin Dashboard** — Ready-to-use React admin UI (collection browser, document editor, global forms)
- **Rich Text** — Lexical-based editor with 20+ features (bold, headings, lists, links, images, blocks)
- **Security** — CORS, CSP, HSTS, RBAC/ABAC policy engine, encryption (AES-256-GCM), audit logging
- **GDPR Compliance** — Consent management, data export, deletion, anonymization, breach reporting
- **Observability** — Structured logging, process health monitoring, alert system, graceful shutdown
- **Plugins** — Extensible plugin system (form builder, nested docs, redirects)
- **Feature Gating** — Tier-based licensing (free, pro, max, enterprise/Forge) with JWT license keys
- **Database** — PostgreSQL adapters (NeonDB + PGlite for testing), connection pooling, SSL/TLS
- **Storage** — Pluggable storage interface (Vercel Blob adapter included)

## Installation

```bash
pnpm add @revealui/core
```

## Usage

### Configuration

```typescript
import { buildConfig } from '@revealui/core/config'

const config = buildConfig({
  collections: [Posts, Categories, Users],
  globals: [Settings, Navigation],
  plugins: [formBuilder(), nestedDocs()],
})
```

### Collections

```typescript
import type { RevealUICollection } from '@revealui/core'

const Posts: RevealUICollection = {
  slug: 'posts',
  fields: [
    { name: 'title', type: 'text', required: true },
    { name: 'content', type: 'richText' },
    { name: 'status', type: 'select', options: ['draft', 'published'] },
  ],
  hooks: {
    beforeChange: [({ data }) => ({ ...data, updatedAt: new Date() })],
  },
  access: {
    read: () => true,
    create: ({ req }) => !!req.user,
  },
}
```

### Server-Side API

```typescript
import { revealui } from '@revealui/core/server'

// Create, read, update, delete
const post = await revealui.create({ collection: 'posts', data: { title: 'Hello' } })
const posts = await revealui.find({ collection: 'posts', where: { status: { equals: 'published' } } })
```

### Admin UI (React)

```typescript
import { AdminDashboard } from '@revealui/core/admin'

// Full admin interface with collection browser, document editor, global forms
function App() {
  return <AdminDashboard />
}
```

### Rich Text

```typescript
import { RichTextEditor, BoldFeature, HeadingFeature, ListFeature } from '@revealui/core/richtext/client'

<RichTextEditor
  features={[BoldFeature(), HeadingFeature(), ListFeature()]}
  onChange={(json) => console.log(json)}
/>
```

### Feature Gating

```typescript
import { isLicensed, isFeatureEnabled } from '@revealui/core/features'

if (isLicensed('pro')) {
  // Pro-tier feature
}

if (isFeatureEnabled('ai')) {
  // AI features enabled
}
```

## Exports

| Subpath | Purpose |
|---------|---------|
| `@revealui/core` | Main entry (RevealUI instance) |
| `@revealui/core/server` | Server-side CRUD API |
| `@revealui/core/client` | Client-side React hooks and utilities |
| `@revealui/core/config` | Configuration builder |
| `@revealui/core/admin` | Admin dashboard components |
| `@revealui/core/richtext` | Rich text server utilities |
| `@revealui/core/richtext/client` | Lexical editor React components |
| `@revealui/core/richtext/html` | HTML serialization |
| `@revealui/core/richtext/rsc` | React Server Component support |
| `@revealui/core/security` | Security infrastructure |
| `@revealui/core/auth` | Auth utilities |
| `@revealui/core/database` | Database adapters |
| `@revealui/core/storage` | Storage adapters |
| `@revealui/core/plugins` | Plugin system |
| `@revealui/core/features` | Feature flags |
| `@revealui/core/license` | License validation |
| `@revealui/core/monitoring` | Health monitoring |
| `@revealui/core/observability/logger` | Structured logging |
| `@revealui/core/types` | TypeScript type definitions |
| `@revealui/core/nextjs` | Next.js integration middleware |
| `@revealui/core/utils/*` | Utilities (cache, deep-clone, errors) |

## Development

```bash
# Build
pnpm build

# Type check
pnpm typecheck

# Run tests
pnpm test

# Watch mode
pnpm dev
```

## When to Use This

- You're building a content-driven app and need collections, admin UI, and CRUD out of the box
- You need RBAC/ABAC access control, GDPR compliance, or feature gating by license tier
- You want a rich text editor (Lexical) integrated with your CMS
- **Not** for standalone UI components — use `@revealui/presentation`
- **Not** for raw database queries — use `@revealui/db` directly

## JOSHUA Alignment

- **Sovereign**: Self-hosted runtime engine — no SaaS dependency for content management, auth, or storage
- **Unified**: One `buildConfig()` call wires collections, globals, plugins, security, and feature gates into a single configuration
- **Adaptive**: Plugin system and tier-based feature gating let the platform evolve without breaking existing deployments

## Related

- [Contracts Package](../contracts/README.md) — Zod schemas and TypeScript types
- [DB Package](../db/README.md) — Drizzle ORM schema
- [Auth Package](../auth/README.md) — Authentication system
- [Architecture Guide](../../docs/ARCHITECTURE.md)

## License

MIT
