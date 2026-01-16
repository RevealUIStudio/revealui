# Database Types Reference

Complete reference for the NeonDB Database type structure and utilities.

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

## Table Types

### Row Type

The `Row` type represents data returned from SELECT queries:

```typescript
import type { Database } from '@revealui/db/types'

type User = Database['public']['Tables']['users']['Row']
// User has all columns from users table with their actual types
```

### Insert Type

The `Insert` type represents data for INSERT operations:

```typescript
import type { Database } from '@revealui/db/types'

type NewUser = Database['public']['Tables']['users']['Insert']
// NewUser has all columns, with optional fields for defaults/auto-generated
```

### Update Type

The `Update` type represents data for UPDATE operations:

```typescript
import type { Database } from '@revealui/db/types'

type UserUpdate = Database['public']['Tables']['users']['Update']
// UserUpdate has all columns as optional (Partial<Insert>)
```

### Relationships

The `Relationships` array contains foreign key relationships:

```typescript
import type { Database } from '@revealui/db/types'

type UserRelationships = Database['public']['Tables']['users']['Relationships']
// Array of relationship definitions with foreignKeyName, columns, etc.
```

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

## Usage Examples

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

## Enums

When enums are defined in the database schema, they're included in the `Enums` type:

```typescript
import type { Database } from '@revealui/db/types'

// Access enum values
type StatusEnum = Database['public']['Enums']['status_enum']
// StatusEnum is a union of string literals
```

## Type Safety Best Practices

### 1. Use Type Utilities

Prefer type utilities over manual extraction:

```typescript
// ✅ Good
import type { TableRow } from '@revealui/db/types'
type User = TableRow<'users'>

// ❌ Less readable
type User = Database['public']['Tables']['users']['Row']
```

### 2. Validate at Boundaries

Use contracts to validate database data:

```typescript
import { dbRowToContract } from '@revealui/schema/core/contracts'
import { UserSchema } from '@revealui/schema'

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

## Comparison with Supabase

The Database type structure is identical to Supabase's:

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

## Related Documentation

- [Type Generation Guide](./TYPE_GENERATION_GUIDE.md) - Generate types from schema
- [Contract Integration Guide](./CONTRACT_INTEGRATION_GUIDE.md) - Contract layer integration
- [Fresh Database Setup](./FRESH-DATABASE-SETUP.md) - Database setup guide
- [Database Migration Plan](./DATABASE-MIGRATION-PLAN.md) - Migration strategy
- [Drizzle Guide](../../development/DRIZZLE-GUIDE.md) - Drizzle ORM usage
- [Unified Backend Architecture](../../architecture/UNIFIED_BACKEND_ARCHITECTURE.md) - System architecture
- [Master Index](../../INDEX.md) - Complete documentation index
- [Task-Based Guide](../../TASKS.md) - Find docs by task
