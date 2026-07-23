---
title: "@revealui/core"
description: "[![npm version](https://img.shields.io/npm/v/@revealui/core)](https://www.npmjs.com/package/@revealui/core)"
visibility: public
status: verified
audience: user
---

# @revealui/core

[![npm version](https://img.shields.io/npm/v/@revealui/core)](https://www.npmjs.com/package/@revealui/core)
[![npm downloads](https://img.shields.io/npm/dw/@revealui/core)](https://www.npmjs.com/package/@revealui/core)
[![license](https://img.shields.io/npm/l/@revealui/core)](https://github.com/RevealUIStudio/revealui/blob/main/LICENSE)

The core runtime engine for [RevealUI](https://revealui.com)  -  collections, admin UI, rich text, security, observability, and plugins.

Part of the [RevealUI monorepo](https://github.com/RevealUIStudio/revealui)  -  open-source agentic business runtime.

## Features

- **Collections & CRUD**  -  Define content types with field hooks, access control, and validation
- **Admin Dashboard**  -  Ready-to-use React admin UI (collection browser, document editor, global forms)
- **Rich Text Fields**  -  Lexical-powered content fields in the admin editor (bold, headings, lists, links, images, blocks)
- **Security**  -  CORS, CSP, HSTS, RBAC/ABAC policy engine, encryption (AES-256-GCM), audit logging
- **GDPR Compliance**  -  Consent management, data export, deletion, anonymization, breach reporting
- **Observability**  -  Structured logging, process health monitoring, alert system, graceful shutdown
- **Plugins**  -  Extensible plugin system (form builder, nested docs, redirects)
- **Feature Gating**  -  Tier-based licensing (free, pro, max, enterprise) with JWT license keys
- **Database**  -  PostgreSQL adapters (NeonDB + PGlite for testing), connection pooling, SSL/TLS
- **Storage**  -  Pluggable storage interface (Cloudflare R2 sole non-mock backend; mock adapter for tests)

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
import { getRevealUI } from '@revealui/core'

// Create, read, update, delete
const revealui = await getRevealUI({ config })
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

### Rich Text Fields

Rich text editing is available as a field type in the admin dashboard.
Define a `richText` field in your collection schema  -  the admin UI renders
a Lexical editor automatically. Not a standalone component.

```typescript
// In your collection definition:
defineField({ name: 'body', type: 'richText' })
```

### Feature Gating

```typescript
import { isLicensed } from '@revealui/core/license'
import { isFeatureEnabled } from '@revealui/core/features'

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
| `@revealui/core` | Main entry |
| `@revealui/core/server` | Server-side CRUD API |
| `@revealui/core/client` | Client-side React hooks and utilities |
| `@revealui/core/client/ui` | Client UI components |
| `@revealui/core/client/admin` | Client admin components |
| `@revealui/core/client/richtext` | Client rich text editor |
| `@revealui/core/config` | Configuration builder (`buildConfig`) |
| `@revealui/core/admin` | Admin dashboard components |
| `@revealui/core/admin/utils/serializeConfig` | Config serialization util |
| `@revealui/core/admin/utils/apiClient` | Admin API client |
| `@revealui/core/admin/i18n/en` | English i18n strings |
| `@revealui/core/richtext` | Rich text server utilities |
| `@revealui/core/richtext/client` | Lexical editor React components |
| `@revealui/core/richtext/react` | Rich text React exports |
| `@revealui/core/richtext/html` | HTML serialization |
| `@revealui/core/richtext/rsc` | React Server Component support |
| `@revealui/core/richtext/lexical` | Raw Lexical exports |
| `@revealui/core/security` | Security infrastructure |
| `@revealui/core/auth` | Auth utilities |
| `@revealui/core/database` | Database adapters |
| `@revealui/core/database/ssl-config` | SSL/TLS config |
| `@revealui/core/database/type-adapter` | Type adapter utilities |
| `@revealui/core/storage` | Storage adapters (R2 + mock for tests) |
| `@revealui/core/plugins` | Plugin system |
| `@revealui/core/features` | Feature flags |
| `@revealui/core/license` | License validation |
| `@revealui/core/license-encryption` | License encryption |
| `@revealui/core/revforge-license` | RevForge license validation |
| `@revealui/core/monitoring` | Health monitoring |
| `@revealui/core/monitoring/process-registry` | Process registry |
| `@revealui/core/monitoring/query-monitor` | Query monitor |
| `@revealui/core/observability` | Observability root |
| `@revealui/core/observability/logger` | Structured logging |
| `@revealui/core/observability/metrics` | Metrics |
| `@revealui/core/observability/alerts` | Alerts |
| `@revealui/core/error-handling` | Error boundaries, retry, circuit breaker, fallback UI |
| `@revealui/core/error-handling/error-reporter` | Error reporting |
| `@revealui/core/cache/query-cache` | Query cache |
| `@revealui/core/jobs` | Background jobs |
| `@revealui/core/translations` | i18n translations |
| `@revealui/core/ui` | UI component exports |
| `@revealui/core/types` | TypeScript type definitions |
| `@revealui/core/types/core` | Core types |
| `@revealui/core/types/schema` | Schema types |
| `@revealui/core/types/generated` | Generated types |
| `@revealui/core/types/admin` | Admin types |
| `@revealui/core/types/frontend` | Frontend types |
| `@revealui/core/generated` | Generated code |
| `@revealui/core/nextjs` | Next.js integration middleware |
| `@revealui/core/nextjs/withRevealUI` | Next.js config wrapper |
| `@revealui/core/api/rest` | REST API handler |
| `@revealui/core/api/compression` | Response compression |
| `@revealui/core/api/payload-optimization` | Payload optimization |
| `@revealui/core/api/rate-limit` | API rate limiting |
| `@revealui/core/api/response-cache` | Response cache |
| `@revealui/core/optimization/code-splitting` | Code splitting helpers |
| `@revealui/core/utils/logger` | Logger utility |
| `@revealui/core/utils/logger/client` | Client-side logger |
| `@revealui/core/utils/logger/server` | Server-side logger |
| `@revealui/core/utils/cache` | Cache utility |
| `@revealui/core/utils/deep-clone` | Deep clone utility |
| `@revealui/core/utils/errors` | Error utilities |
| `@revealui/core/utils/error-responses` | Error response helpers |
| `@revealui/core/utils/request-context` | Request context |

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
- **Not** for standalone UI components  -  use `@revealui/presentation`
- **Not** for raw database queries  -  use `@revealui/db` directly

## Design Principles

- **Sovereign**: Self-hosted runtime engine  -  no vendor dependency for content management, auth, or storage
- **Unified**: One `buildConfig()` call wires collections, globals, plugins, security, and feature gates into a single configuration
- **Adaptive**: Plugin system and tier-based feature gating let the platform evolve without breaking existing deployments

## Related

- [Contracts Package](../contracts/README.md)  -  Zod schemas and TypeScript types
- [DB Package](../db/README.md)  -  Drizzle ORM schema
- [Auth Package](../auth/README.md)  -  Authentication system
- [Architecture Guide](../../docs/ARCHITECTURE.md)

## License

MIT
