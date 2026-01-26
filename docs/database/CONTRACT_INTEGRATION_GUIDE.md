# Contract Integration Guide

Guide to integrating Database types with the Contracts system for end-to-end type safety.

## Overview

The Contracts system bridges Database types (from `@revealui/db`) with Zod schemas (from `@revealui/schema`), ensuring type safety across all layers:

```
Database (Postgres)
    ↓
Drizzle Schemas (@revealui/db)
    ↓
Database Types (Database['public']['Tables'])
    ↓
Contracts (@revealui/schema/core/contracts)
    ↓
RevealUI Types (@revealui/core)
```

## Database Contract Bridge

### Converting Database Rows to Contracts

Use `dbRowToContract` to validate database data against contracts:

```typescript
import { dbRowToContract } from '@revealui/contracts/database'
import { UserSchema } from '@revealui/contracts'
import type { Database } from '@revealui/db/types'

const db = getClient()
const dbUser = await db.query.users.findFirst()

if (dbUser) {
  // Validate and convert to contract type
  const validatedUser = dbRowToContract(UserSchema, dbUser)
  // validatedUser is now validated and typed according to UserSchema
}
```

### Safe Conversion (No Throw)

Use `safeDbRowToContract` for error handling:

```typescript
import { safeDbRowToContract } from '@revealui/schema/core/contracts'
import { UserSchema } from '@revealui/schema'

const result = safeDbRowToContract(UserSchema, dbUser)
if (result.success) {
  // result.data is fully typed and validated
  console.log(result.data.email)
} else {
  // Handle validation errors
  console.error(result.errors.issues)
}
```

### Converting Contracts to Database Inserts

Use `contractToDbInsert` to convert validated data for insertion:

```typescript
import { contractToDbInsert } from '@revealui/contracts/database'
import { createUser } from '@revealui/contracts'
import type { Database } from '@revealui/db/types'

// Create user using contract factory
const newUser = createUser('user-123', {
  email: 'user@example.com',
  name: 'Test User',
})

// Convert to database insert type
const dbInsert: Database['public']['Tables']['users']['Insert'] = 
  contractToDbInsert(newUser)

// Insert into database
await db.insert(users).values(dbInsert)
```

## Type Bridge Utilities

### Creating Mappers

Create reusable mappers for type conversion:

```typescript
import { createDbRowMapper, createContractToDbMapper } from '@revealui/schema/core/contracts'
import { UserSchema } from '@revealui/schema'

// Map database rows to contracts
const userMapper = createDbRowMapper(UserSchema)

const dbUsers = await db.query.users.findMany()
const validatedUsers = dbUsers.map(userMapper)

// Map contracts to database inserts
const insertMapper = createContractToDbMapper<User, Database['public']['Tables']['users']['Insert']>()

const newUser = createUser('user-123', { email: 'user@example.com', name: 'User' })
const dbInsert = insertMapper(newUser)
```

### Batch Conversion

Convert multiple rows at once:

```typescript
import { batchDbRowsToContract, batchContractToDbInsert } from '@revealui/schema/core/contracts'

// Batch convert database rows
const dbUsers = await db.query.users.findMany()
const validatedUsers = batchDbRowsToContract(UserSchema, dbUsers)

// Batch convert contracts to inserts
const newUsers = [createUser('1', {...}), createUser('2', {...})]
const dbInserts = batchContractToDbInsert(newUsers)
await db.insert(users).values(dbInserts)
```

### Type Guards

Use type guards for runtime type checking:

```typescript
import { isDbRowMatchingContract, isDbRowAndContract } from '@revealui/contracts/database'

const dbUser = await db.query.users.findFirst()

if (isDbRowMatchingContract(UserSchema, dbUser)) {
  // dbUser is now typed as User (from contract)
  console.log(dbUser.email)
}
```

## Table Contract Registry

Register contracts for automatic validation:

```typescript
import { databaseContractRegistry } from '@revealui/schema/core/contracts'
import { UserSchema, SiteSchema } from '@revealui/schema'

// Register contracts for tables
databaseContractRegistry.register('users', UserSchema)
databaseContractRegistry.register('sites', SiteSchema)

// Validate rows automatically
const dbUser = await db.query.users.findFirst()
const result = databaseContractRegistry.validateRow('users', dbUser)
if (result?.success) {
  // result.data is validated and typed
}
```

### Creating Type-Safe Registries

Use `createTableContractRegistry` for type-safe table-to-contract mapping:

```typescript
import { createTableContractRegistry } from '@revealui/contracts/database'
import type { Database } from '@revealui/db/types'
import { UserSchema, SiteSchema } from '@revealui/contracts'

const registry = createTableContractRegistry<Database>({
  users: UserSchema as any, // Type assertion needed due to contract variance
  sites: SiteSchema as any,
})

// Type-safe validation
const dbUser = await db.query.users.findFirst()
if (dbUser) {
  const result = registry.validate('users', dbUser)
  if (result?.success) {
    // Fully typed and validated
  }
}
```

## Type Conversion Patterns

### Pattern 1: Query → Validate → Use

```typescript
import { safeDbRowToContract } from '@revealui/schema/core/contracts'
import { UserSchema } from '@revealui/schema'

const dbUser = await db.query.users.findFirst()
if (!dbUser) return

const result = safeDbRowToContract(UserSchema, dbUser)
if (result.success) {
  // Use validated user
  processUser(result.data)
} else {
  // Handle validation errors
  logValidationErrors(result.errors)
}
```

### Pattern 2: Contract → Insert

```typescript
import { contractToDbInsert } from '@revealui/contracts/database'
import { createUser } from '@revealui/contracts'
import type { Database } from '@revealui/db/types'

const newUser = createUser('user-123', {
  email: 'user@example.com',
  name: 'Test User',
})

const dbInsert: Database['public']['Tables']['users']['Insert'] = 
  contractToDbInsert(newUser)

await db.insert(users).values(dbInsert)
```

### Pattern 3: Batch Processing

```typescript
import { batchDbRowsToContract } from '@revealui/schema/core/contracts'

// Fetch and validate in batch
const dbUsers = await db.query.users.findMany()
const validatedUsers = batchDbRowsToContract(UserSchema, dbUsers)

// Process validated users
validatedUsers.forEach((user) => {
  // user is fully typed and validated
  processUser(user)
})
```

## Best Practices

### 1. Validate at Boundaries

Always validate database data when crossing layer boundaries:

```typescript
// ✅ Good - validate at API boundary
export async function getUser(id: string) {
  const dbUser = await db.query.users.findFirst({ where: eq(users.id, id) })
  if (!dbUser) return null
  
  const result = safeDbRowToContract(UserSchema, dbUser)
  if (!result.success) {
    throw new Error('Invalid user data')
  }
  
  return result.data // Fully validated
}
```

### 2. Use Contracts for Inserts

Create data using contract factories, then convert:

```typescript
// ✅ Good - use contract factory
const newUser = createUser('user-123', {
  email: 'user@example.com',
  name: 'User',
})
const dbInsert = contractToDbInsert(newUser)
await db.insert(users).values(dbInsert)

// ❌ Avoid - bypassing contracts
await db.insert(users).values({
  id: 'user-123',
  email: 'user@example.com',
  name: 'User',
})
```

### 3. Register Contracts Early

Register contracts at application startup:

```typescript
// In your app initialization
import { databaseContractRegistry } from '@revealui/schema/core/contracts'
import { UserSchema, SiteSchema, PageSchema } from '@revealui/schema'

databaseContractRegistry.register('users', UserSchema)
databaseContractRegistry.register('sites', SiteSchema)
databaseContractRegistry.register('pages', PageSchema)
```

### 4. Type Safety First

Leverage TypeScript's type system:

```typescript
// ✅ Good - full type safety
type User = Database['public']['Tables']['users']['Row']
const user: User = await db.query.users.findFirst()

// ✅ Better - validated type
const validatedUser = dbRowToContract(UserSchema, user)
// validatedUser is both typed AND validated
```

## Error Handling

### Validation Errors

Contracts provide detailed validation errors:

```typescript
import { safeDbRowToContract } from '@revealui/schema/core/contracts'
import { ConfigValidationError } from '@revealui/contracts/cms'

const result = safeDbRowToContract(UserSchema, dbUser)
if (!result.success) {
  // Access detailed errors
  result.errors.issues.forEach((issue) => {
    console.error(`${issue.path.join('.')}: ${issue.message}`)
  })
}
```

### Type Mismatches

Type mismatches are caught at compile time:

```typescript
// TypeScript will error if types don't match
const dbInsert: Database['public']['Tables']['users']['Insert'] = 
  contractToDbInsert(someInvalidData) // ❌ Type error
```

## Advanced Patterns

### Custom Mappers

Create custom mappers for complex transformations:

```typescript
const userMapper = createDbRowMapper(UserSchema, (row) => ({
  ...row,
  // Transform data before validation
  email: row.email?.toLowerCase(),
  name: row.name.trim(),
}))
```

### Relationship Handling

Handle relationships when converting:

```typescript
// Fetch user with related data
const dbUser = await db.query.users.findFirst({
  with: { sessions: true },
})

// Convert user (sessions handled separately)
const user = dbRowToContract(UserSchema, dbUser)
// Note: relationships may need separate validation
```

## Related Documentation

- [Type Generation Guide](./TYPE_GENERATION_GUIDE.md) - Generate types from schema
- [Database Types Reference](./DATABASE_TYPES_REFERENCE.md) - Type definitions
- [Fresh Database Setup](./FRESH-DATABASE-SETUP.md) - Database setup guide
- [Drizzle Guide](../../development/DRIZZLE-GUIDE.md) - Drizzle ORM usage
- [Unified Backend Architecture](../../architecture/UNIFIED_BACKEND_ARCHITECTURE.md) - System architecture
- [Master Index](../../INDEX.md) - Complete documentation index
- [Task-Based Guide](../../INDEX.md) - Find docs by task
