# Database Type Generation Guide

This guide explains how to generate and use TypeScript types for NeonDB, providing feature parity with Supabase's type generation system.

## Overview

RevealUI generates TypeScript types from Drizzle ORM schemas, creating a centralized `Database` type that matches Supabase's structure. This provides:

- **Full type safety** for all database operations
- **Autocomplete** for table names, columns, and relationships
- **Type inference** for Row, Insert, and Update operations
- **Feature parity** with Supabase's Database type

## Generating Types

### Basic Generation

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

### When to Regenerate

Regenerate types when:

- ✅ Adding new tables to Drizzle schemas
- ✅ Modifying table structures (columns, types)
- ✅ Adding or changing relationships
- ✅ Before deploying to production
- ✅ After database migrations

**Note**: Types are automatically copied to `packages/core/src/core/generated/types/neon.ts` when using `pnpm generate:neon-types`.

## Using Generated Types

### Importing the Database Type

```typescript
import type { Database } from '@revealui/db/types'

// Or from the core package (merged from @revealui/generated)
import type { Database } from '@revealui/core/generated/types/neon'
```

### Extracting Table Types

```typescript
import type { Database } from '@revealui/db/types'

// Extract Row type (for SELECT operations)
type User = Database['public']['Tables']['users']['Row']

// Extract Insert type (for INSERT operations)
type NewUser = Database['public']['Tables']['users']['Insert']

// Extract Update type (for UPDATE operations)
type UserUpdate = Database['public']['Tables']['users']['Update']
```

### Using Type Utilities

```typescript
import type { TableRow, TableInsert, TableUpdate } from '@revealui/db/types'

// Extract types using utilities
type User = TableRow<'users'>
type NewUser = TableInsert<'users'>
type UserUpdate = TableUpdate<'users'>
```

### With Drizzle Client

```typescript
import { getClient } from '@revealui/db/client'
import type { Database } from '@revealui/db/types'
import { users } from '@revealui/db/core'

const db = getClient()

// Full type safety with autocomplete
const allUsers: Database['public']['Tables']['users']['Row'][] = 
  await db.query.users.findMany()

// Type-safe inserts
const newUser: Database['public']['Tables']['users']['Insert'] = {
  id: 'user-123',
  email: 'user@example.com',
  name: 'Test User',
}
await db.insert(users).values(newUser)
```

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

## Advanced Usage

### Custom Type Mappings

You can create custom type mappings for specific use cases:

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

## Comparison with Supabase

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

## Best Practices

1. **Regenerate regularly**: Run type generation after schema changes
2. **Commit generated files**: Include `database.ts` in version control
3. **Use type utilities**: Prefer `TableRow<T>` over manual extraction
4. **Validate at boundaries**: Use contracts to validate database data
5. **Type-safe queries**: Use Drizzle's native API for full type safety

## Related Documentation

- [Database Types Reference](./DATABASE_TYPES_REFERENCE.md) - Type definitions
- [Contract Integration Guide](./CONTRACT_INTEGRATION_GUIDE.md) - Contract layer integration
- [Fresh Database Setup](./FRESH_DATABASE_SETUP.md) - Database setup guide
- [Drizzle Guide](../../development/DRIZZLE_GUIDE.md) - Drizzle ORM usage
- [Database Migration Plan](./DATABASE_MIGRATION_PLAN.md) - Migration strategy
- [Unified Backend Architecture](../../architecture/UNIFIED_BACKEND_ARCHITECTURE.md) - System architecture
- [Master Index](../../INDEX.md) - Complete documentation index
- [Task-Based Guide](../../INDEX.md) - Find docs by task

### External Resources

- [Drizzle ORM Documentation](https://orm.drizzle.team) - Official Drizzle documentation
