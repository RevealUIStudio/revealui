# @revealui/db

Database schemas and Drizzle ORM integration for RevealUI.

> **Test Coverage:** ~60% (best coverage in project, but still needs improvement)

## Features

- **Drizzle ORM**: Type-safe database queries with Drizzle
- **Schema Management**: Database schema definitions for all RevealUI tables
- **Multiple Providers**: Works with Neon, Supabase, and Vercel Postgres
- **Type Generation**: Auto-generate TypeScript types from database schema
- **Migrations**: Database migration management with Drizzle Kit
- **Type-safe**: Full TypeScript support with inferred types

## Installation

```bash
pnpm add @revealui/db
```

## Usage

### Import Database Client

```typescript
import { createClient } from '@revealui/db/client'

const db = createClient({
  connectionString: process.env.POSTGRES_URL!
})
```

### Import Schemas

```typescript
// Import all schemas
import * as schema from '@revealui/db/schema'

// Import specific schemas
import { users } from '@revealui/db/schema/users'
import { posts } from '@revealui/db/schema/cms'
import { agentContexts } from '@revealui/db/schema/agents'
import { vectorMemory } from '@revealui/db/schema/vector'
```

### Query Database

```typescript
import { createClient } from '@revealui/db/client'
import { users } from '@revealui/db/schema/users'
import { eq } from 'drizzle-orm'

const db = createClient({ connectionString: process.env.POSTGRES_URL! })

// Query users
const allUsers = await db.select().from(users)

// Query with filter
const user = await db.select().from(users).where(eq(users.email, 'user@example.com'))

// Insert user
await db.insert(users).values({
  email: 'newuser@example.com',
  name: 'New User'
})
```

## Available Exports

- `@revealui/db` - Main export with database client
- `@revealui/db/client` - Database client factory
- `@revealui/db/schema` - All database schemas
- `@revealui/db/schema/agents` - Agent-related tables
- `@revealui/db/schema/cms` - CMS tables (posts, pages, media)
- `@revealui/db/schema/users` - User and authentication tables
- `@revealui/db/schema/vector` - Vector memory tables
- `@revealui/db/schema/crdt-operations` - CRDT operation log
- `@revealui/db/schema/node-ids` - Node ID mapping
- `@revealui/db/schema/rate-limits` - Rate limiting tables
- `@revealui/db/schema/sites` - Site configuration tables
- `@revealui/db/types` - TypeScript types for database entities

## Database Management

```bash
# Generate types from schema
pnpm --filter @revealui/db generate:types

# Generate migration files
pnpm --filter @revealui/db db:generate

# Run migrations
pnpm --filter @revealui/db db:migrate

# Push schema changes (development only)
pnpm --filter @revealui/db db:push

# Open Drizzle Studio (database GUI)
pnpm --filter @revealui/db db:studio
```

## Type Safety

All database operations are fully type-safe:

```typescript
import { createClient } from '@revealui/db/client'
import { users } from '@revealui/db/schema/users'

const db = createClient({ connectionString: process.env.POSTGRES_URL! })

// TypeScript knows the shape of user rows
const allUsers = await db.select().from(users)
// allUsers: { id: string, email: string, name: string | null, ... }[]

// Insert is type-checked
await db.insert(users).values({
  email: 'test@example.com',
  name: 'Test User'
  // TypeScript error if you add invalid fields
})
```

## When to Use This

- You need type-safe database queries against the RevealUI schema (users, posts, agents, vectors)
- You're running migrations or generating types from the Drizzle schema
- You want a pre-configured client for Neon, Supabase, or Vercel Postgres
- **Not** for validation logic — use `@revealui/contracts` for Zod schemas
- **Not** for direct SQL — use Drizzle's query builder or `db.execute()` for raw queries

## JOSHUA Alignment

- **Unified**: One schema definition (81 tables) drives types, queries, and migrations across all apps
- **Orthogonal**: Schema files are cleanly separated by domain (cms, users, agents, vector, crdt) with no cross-domain entanglement
- **Sovereign**: Your database, your schema, your migrations — no hosted schema service in the loop

## Related Documentation

- [Database Guide](../../docs/DATABASE.md) - Complete database setup and configuration
- [Database Management](../../docs/DATABASE_MANAGEMENT.md) - Operations and maintenance
- [Drizzle ORM Docs](https://orm.drizzle.team/) - Official Drizzle documentation

## License

MIT
