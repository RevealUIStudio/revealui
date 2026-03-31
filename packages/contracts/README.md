# @revealui/contracts

Unified contracts package for RevealUI - schemas, validation, and type safety across the stack.

## Overview

This package provides a unified contract system that combines:
- **Runtime validation** using Zod schemas
- **TypeScript types** derived from schemas
- **Dual representation** (human/agent) for entities
- **Database contract bridges** for type-safe DB operations
- **Action validation** against entity constraints

## Package Exports

```typescript
// Everything
import { ... } from '@revealui/contracts'

// Foundation (Contract<T> system)
import { Contract, createContract } from '@revealui/contracts/foundation'

// Representation (dual entity system)
import { DualEntitySchema, createEmbedding } from '@revealui/contracts/representation'

// Entities (User, Site, Page)
import { UserContract, PageContract, SiteContract } from '@revealui/contracts/entities'

// Content (blocks)
import { BlockSchema, createTextBlock } from '@revealui/contracts/content'

// CMS (configuration contracts)
import { ConfigContract, CollectionContract } from '@revealui/contracts/cms'

// Agents (memory, context, conversations)
import { AgentMemorySchema, AgentContextSchema } from '@revealui/contracts/agents'

// Database (DB ↔ Contract bridges)
import { dbRowToContract, contractToDbInsert } from '@revealui/contracts/database'

// Actions (action validation)
import { validateAction, checkConstraints } from '@revealui/contracts/actions'
```

## Quick Start

### Validation

```typescript
import { PageSchema } from '@revealui/contracts'

// Validate incoming data
const page = PageSchema.parse(rawData)  // Throws on error

// Or use safe parse
const result = PageSchema.safeParse(rawData)
if (result.success) {
  // result.data is typed as Page
}
```

### Creating Entities

```typescript
import { createPage, createTextBlock } from '@revealui/contracts'

const page = createPage('page-123', {
  siteId: 'site-456',
  title: 'Hello World',
  slug: 'hello-world'
})

const block = createTextBlock('block-1', '# Hello\n\nWelcome!')
```

### Database Integration

```typescript
import { UserSchema } from '@revealui/contracts/entities'
import { dbRowToContract } from '@revealui/contracts/database'

// Load from DB with validation
const dbRow = await db.query.users.findFirst()
const validatedUser = dbRowToContract(UserSchema, dbRow)
```

### Action Validation

```typescript
import { validateAction } from '@revealui/contracts/actions'

const result = validateAction({
  entity: page,
  action: 'update',
  agent: agentDefinition,
  changes: { title: 'New Title' },
  permissions: userPermissions
})

if (!result.success) {
  throw new Error(result.errors.map(e => e.message).join(', '))
}
```

### CMS Configuration

```typescript
import { ConfigContract, validateConfigStructure } from '@revealui/contracts/cms'

const result = validateConfigStructure(userConfig)
if (result.success) {
  // result.data is fully typed and validated
}
```

## Architecture

This package follows a unified contract system:

1. **Foundation** - Core `Contract<T>` interface
2. **Representation** - Dual representation (human/agent)
3. **Entities** - Domain entities (User, Site, Page)
4. **Content** - Content blocks
5. **CMS** - CMS configuration contracts
6. **Agents** - Agent memory/context contracts
7. **Database** - DB ↔ Contract bridges
8. **Actions** - Action validation layer

## Migration from @revealui/schema (Complete ✅)

The migration from `@revealui/schema` to `@revealui/contracts` is **complete**. All internal packages now use `@revealui/contracts`.

If you're updating external code that still uses `@revealui/schema`, update imports:

```typescript
// Before (schema package - DELETED)
import { PageSchema } from '@revealui/schema'
import { ConfigContract } from '@revealui/schema/core/contracts'

// After (contracts package)
import { PageSchema } from '@revealui/contracts'
import { ConfigContract } from '@revealui/contracts/cms'
```

## Development

```bash
# Type check
pnpm typecheck

# Run tests
pnpm test

# Build
pnpm build
```

## When to Use This

- You need shared Zod schemas and TypeScript types used across API, CMS, and client
- You're validating data at boundaries (API input, database rows, form submissions)
- You want dual representation (human/agent) for CMS entities
- **Not** for database queries — use `@revealui/db` with Drizzle ORM
- **Not** for runtime config validation — use `@revealui/config`

## JOSHUA Alignment

- **Unified**: One schema drives TypeScript types, runtime validation, API docs, and database bridges across every surface
- **Hermetic**: Validation at the boundary ensures no unvalidated data crosses layer lines
- **Orthogonal**: Foundation, entities, content, agents, and actions are cleanly separated subpath exports with no circular dependencies

## License

MIT
