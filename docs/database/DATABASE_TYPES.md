# RevealUI Database Types - Complete Guide

**Last Updated:** 2025-01-30
**Package:** `@revealui/db`

---

## Table of Contents

1. [Overview](#overview)
2. [Type Generation](#type-generation)
3. [Database Type Structure](#database-type-structure)
4. [Type Utilities](#type-utilities)
5. [Usage Examples](#usage-examples)
6. [Best Practices](#best-practices)
7. [Troubleshooting](#troubleshooting)

---

## Overview

RevealUI generates TypeScript types from Drizzle ORM schemas, creating a centralized `Database` type that matches Supabase's structure. This provides:

- **Full type safety** for all database operations
- **Autocomplete** for table names, columns, and relationships
- **Type inference** for Row, Insert, and Update operations
- **Feature parity** with Supabase's Database type

---

## Type Generation

### Generating Types

Generate types from Drizzle schemas:

```bash
# Generate types in @revealui/db package
pnpm --filter @revealui/db generate:types

# Or use the root script (generates and copies to generated package)
pnpm generate:neon-types
```

### What Gets Generated

The generator creates `packages/db/src/types/database.ts` with:

1. **Individual table types**: `UsersRow`, `UsersInsert`, `UsersUpdate`, etc.
2. **Centralized Database type**: Matching Supabase structure
3. **Type utilities**: `TableRow`, `TableInsert`, `TableUpdate`, etc.
4. **Relationships**: Foreign key relationships for each table
5. **Enums**: Database enum types (when defined)

**Note**: Types are automatically copied to `packages/core/src/core/generated/types/neon.ts` when using `pnpm generate:neon-types`.

### When to Regenerate

Regenerate types when:

- ✅ Adding new tables to Drizzle schemas
- ✅ Modifying table structures (columns, types)
- ✅ Adding or changing relationships
- ✅ Before deploying to production
- ✅ After database migrations

---

## Database Type Structure

The `Database` type matches Supabase's structure for feature parity:

```typescript
type Database = {
  public: {
    Tables: {
      [tableName]: {
        Row: InferredSelectType
        Insert: InferredInsertType
        Update: Partial<InferredInsertType>
        Relationships: RelationType[]
      }
    }
    Enums: {
      [enumName]: string
    }
  }
}
```

### Table Types

#### Row Type

The `Row` type represents data returned from SELECT queries:

```typescript
import type { Database } from '@revealui/db/types'

type User = Database['public']['Tables']['users']['Row']
// User has all columns from users table with their actual types
```

#### Insert Type

The `Insert` type represents data for INSERT operations:

```typescript
import type { Database } from '@revealui/db/types'

type NewUser = Database['public']['Tables']['users']['Insert']
// NewUser has all columns, with optional fields for defaults/auto-generated
```

#### Update Type

The `Update` type represents data for UPDATE operations:

```typescript
import type { Database } from '@revealui/db/types'

type UserUpdate = Database['public']['Tables']['users']['Update']
// UserUpdate has all columns as optional (Partial<Insert>)
```

#### Relationships

The `Relationships` array contains foreign key relationships:

```typescript
import type { Database } from '@revealui/db/types'

type UserRelationships = Database['public']['Tables']['users']['Relationships']
// Array of relationship definitions with foreignKeyName, columns, etc.
```

---

## Type Utilities

### TableRow

Extract Row type for a table:

```typescript
import type { TableRow } from '@revealui/db/types'

type User = TableRow<'users'>
// Equivalent to: Database['public']['Tables']['users']['Row']
```

### TableInsert

Extract Insert type for a table:

```typescript
import type { TableInsert } from '@revealui/db/types'

type NewUser = TableInsert<'users'>
// Equivalent to: Database['public']['Tables']['users']['Insert']
```

### TableUpdate

Extract Update type for a table:

```typescript
import type { TableUpdate } from '@revealui/db/types'

type UserUpdate = TableUpdate<'users'>
// Equivalent to: Database['public']['Tables']['users']['Update']
```

### TableRelationships

Extract Relationships for a table:

```typescript
import type { TableRelationships } from '@revealui/db/types'

type UserRelationships = TableRelationships<'users'>
// Equivalent to: Database['public']['Tables']['users']['Relationships']
```

---

## Usage Examples

### Importing the Database Type

```typescript
import type { Database } from '@revealui/db/types'

// Or from the core package (merged from @revealui/generated)
import type { Database } from '@revealui/core/generated/types/neon'
```

### Query Operations

```typescript
import { getClient } from '@revealui/db/client'
import type { Database } from '@revealui/db/types'
import { users } from '@revealui/db/core'

const db = getClient()

// Find many - returns Row[]
const allUsers: Database['public']['Tables']['users']['Row'][] =
  await db.query.users.findMany()

// Find first - returns Row | undefined
const user: Database['public']['Tables']['users']['Row'] | undefined =
  await db.query.users.findFirst()
```

### Insert Operations

```typescript
import { getClient } from '@revealui/db/client'
import type { Database } from '@revealui/db/types'
import { users } from '@revealui/db/core'

const db = getClient()

// Type-safe insert
const newUser: Database['public']['Tables']['users']['Insert'] = {
  id: 'user-123',
  email: 'user@example.com',
  name: 'Test User',
  // Optional fields can be omitted (they have defaults)
}

const [inserted] = await db.insert(users).values(newUser).returning()
// inserted is typed as Row
```

### Update Operations

```typescript
import { getClient } from '@revealui/db/client'
import type { Database } from '@revealui/db/types'
import { users } from '@revealui/db/core'
import { eq } from 'drizzle-orm'

const db = getClient()

// Type-safe update
const updateData: Database['public']['Tables']['users']['Update'] = {
  name: 'Updated Name',
  // Only include fields to update
}

const [updated] = await db
  .update(users)
  .set(updateData)
  .where(eq(users.id, 'user-123'))
  .returning()
// updated is typed as Row
```

### Working with Relationships

```typescript
import type { Database } from '@revealui/db/types'

// Get relationships for a table
type UserRelationships = Database['public']['Tables']['users']['Relationships']

// Access relationship information
const userRelationships: UserRelationships = [
  {
    foreignKeyName: 'sessions_user_id_users_id_fk',
    columns: ['user_id'],
    referencedRelation: 'sessions',
    referencedColumns: ['id'],
  },
  // ... more relationships
]
```

### Working with Enums

When enums are defined in the database schema, they're included in the `Enums` type:

```typescript
import type { Database } from '@revealui/db/types'

// Access enum values
type StatusEnum = Database['public']['Enums']['status_enum']
// StatusEnum is a union of string literals
```

### Custom Type Mappings

Create custom type mappings for specific use cases:

```typescript
import type { Database } from '@revealui/db/types'

// Create a type for user with related data
type UserWithSessions = Database['public']['Tables']['users']['Row'] & {
  sessions: Database['public']['Tables']['sessions']['Row'][]
}
```

### Type Guards

Use type guards for runtime validation:

```typescript
import type { Database } from '@revealui/db/types'
import { UserSchema } from '@revealui/contracts'

function isValidUser(data: unknown): data is Database['public']['Tables']['users']['Row'] {
  return UserSchema.safeParse(data).success
}
```

---

## Best Practices

### 1. Use Type Utilities

Prefer type utilities over manual extraction:

```typescript
// ✅ Good - concise and readable
import type { TableRow } from '@revealui/db/types'
type User = TableRow<'users'>

// ❌ Less readable - but functionally equivalent
type User = Database['public']['Tables']['users']['Row']
```

### 2. Validate at Boundaries

Use contracts to validate database data:

```typescript
import { dbRowToContract } from '@revealui/contracts/database'
import { UserSchema } from '@revealui/contracts'

const dbUser = await db.query.users.findFirst()
const validatedUser = dbRowToContract(UserSchema, dbUser)
```

### 3. Type-Safe Inserts

Always type your insert data:

```typescript
// ✅ Good - type-safe
const newUser: Database['public']['Tables']['users']['Insert'] = {
  id: 'user-123',
  name: 'User',
}

// ❌ Bad - no type safety
const newUser = {
  id: 'user-123',
  name: 'User',
}
```

### 4. Use Drizzle's Native API

Drizzle provides excellent type safety out of the box:

```typescript
// ✅ Good - Drizzle's native API is fully type-safe
const users = await db.query.users.findMany()

// ❌ Avoid - loses type safety
const users = await db.execute(sql`SELECT * FROM users`)
```

### 5. Regenerate Regularly

- **After schema changes**: Run `pnpm generate:neon-types`
- **Before deployment**: Ensure types match production schema
- **Commit generated files**: Include `database.ts` in version control

---

## Troubleshooting

### Types Not Updating

**Problem**: Changes to schemas not reflected in generated types.

**Solution**:
1. Ensure you've saved all schema files
2. Run `pnpm --filter @revealui/db generate:types`
3. Check that `packages/db/src/types/database.ts` was updated
4. Restart TypeScript server in your IDE

### Missing Tables

**Problem**: Some tables not appearing in Database type.

**Solution**:
1. Verify table is exported from `packages/db/src/core/index.ts`
2. Check table name matches database table name (snake_case)
3. Regenerate types: `pnpm generate:neon-types`

### Type Errors After Regeneration

**Problem**: TypeScript errors after regenerating types.

**Solution**:
1. Restart TypeScript server
2. Clear build cache: `pnpm clean`
3. Rebuild: `pnpm build:packages`
4. Check for breaking changes in schema

### Import Errors

**Problem**: Cannot import Database type.

**Solution**:
1. Ensure `@revealui/db` package is built: `pnpm --filter @revealui/db build`
2. Check import path: `@revealui/db/types` or `@revealui/core/generated/types/neon`
3. Verify types are exported in `packages/db/src/types/index.ts`

---

## Comparison with Supabase

The Database type structure is identical to Supabase's:

| Feature | Supabase | NeonDB (RevealUI) |
|---------|----------|------------------|
| Type Generation | `supabase gen types` | `pnpm generate:neon-types` |
| Database Type | `Database` from types.ts | `Database` from `@revealui/db/types` |
| Table Access | `Database['public']['Tables']['users']` | `Database['public']['Tables']['users']` |
| Row Type | `Database['public']['Tables']['users']['Row']` | `Database['public']['Tables']['users']['Row']` |
| Insert Type | `Database['public']['Tables']['users']['Insert']` | `Database['public']['Tables']['users']['Insert']` |
| Update Type | `Database['public']['Tables']['users']['Update']` | `Database['public']['Tables']['users']['Update']` |
| Relationships | Included | Included |
| Enums | Included | Included (when defined) |

**Migration Example:**

```typescript
// Supabase
import type { Database } from './supabase-types'
type User = Database['public']['Tables']['users']['Row']

// NeonDB (RevealUI) - Same structure!
import type { Database } from '@revealui/db/types'
type User = Database['public']['Tables']['users']['Row']
```

This ensures:
- ✅ Same developer experience
- ✅ Same type safety level
- ✅ Easy migration between providers
- ✅ Consistent patterns across codebase

---

## Related Documentation

- [DATABASE_SETUP.md](./DATABASE_SETUP.md) - Database setup guide
- [CONTRACT_INTEGRATION_GUIDE.md](./CONTRACT_INTEGRATION_GUIDE.md) - Contract layer integration
- [DATABASE_MIGRATION_PLAN.md](./DATABASE_MIGRATION_PLAN.md) - Migration strategy
- [DATABASE_PROVIDER_SWITCHING.md](./DATABASE_PROVIDER_SWITCHING.md) - Switch between providers
- [Drizzle Guide](../development/DRIZZLE_GUIDE.md) - Drizzle ORM usage (if exists)
- [Unified Backend Architecture](../architecture/UNIFIED_BACKEND_ARCHITECTURE.md) - System architecture

### External Resources

- [Drizzle ORM Documentation](https://orm.drizzle.team) - Official Drizzle documentation
- [Supabase Type Generation](https://supabase.com/docs/guides/api/generating-types) - Supabase comparison reference

---

**Last Updated:** 2025-01-30
**Status:** Production-ready
