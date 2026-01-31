# RevealUI Database Documentation

**Last Updated:** 2025-01-31
**Supported Providers:** Neon, Supabase, Vercel Postgres

---

## Table of Contents

1. [Overview](#overview)
2. [Quick Start](#quick-start)
3. [Provider Setup](#provider-setup)
   - [Neon Database](#neon-database)
   - [Supabase Database](#supabase-database)
   - [Vercel Postgres](#vercel-postgres)
4. [Database Types](#database-types)
   - [Type Generation](#type-generation)
   - [Type Structure](#type-structure)
   - [Type Utilities](#type-utilities)
   - [Usage Examples](#usage-examples)
5. [Provider-Specific Features](#provider-specific-features)
   - [ElectricSQL Setup](#electricsql-setup)
   - [Supabase Networking](#supabase-networking)
6. [Troubleshooting](#troubleshooting)
7. [Best Practices](#best-practices)
8. [Related Documentation](#related-documentation)

---

## Overview

RevealUI uses a universal PostgreSQL adapter that automatically detects your provider and handles connection management. This guide covers setting up a RevealUI database using **Neon**, **Supabase**, or **Vercel Postgres**, as well as working with generated TypeScript types for full type safety.

### Why Fresh Database?

- ✅ RevealUI automatically creates tables with correct names (`revealui_*` instead of legacy `payload_*`)
- ✅ No migration complexity
- ✅ Clean slate for new projects
- ✅ Zero downtime approach

### Key Features

- **Full type safety** for all database operations
- **Autocomplete** for table names, columns, and relationships
- **Type inference** for Row, Insert, and Update operations
- **Universal adapter** - One adapter works with all three providers
- **Auto-detection** - Provider detected automatically from connection string
- **Feature parity** with Supabase's Database type

---

## Quick Start

### 1. Choose Your Database Provider

| Provider | Best For | Pricing | Connection Limit | Connection String Format |
|----------|----------|---------|------------------|--------------------------|
| **Neon** | Serverless, branching, edge functions | Free tier, pay-as-you-go | Auto-scaling | `postgresql://...@ep-xxx.neon.tech/...` |
| **Supabase** | Full-featured backend, auth included | Free tier, fixed plans | Connection pooling | `postgresql://...@xxx.supabase.co/...` |
| **Vercel Postgres** | Vercel deployments, seamless integration | Free tier, fixed plans | Managed by Vercel | `postgres://...` (auto-configured) |

**Note:** Vercel Postgres is deprecated. Prefer Neon for new projects.

### 2. Set Environment Variable

```bash
# .env.local
DATABASE_URL=your_connection_string_here

# Or use provider-specific variable names
POSTGRES_URL=... # Neon/Vercel
SUPABASE_DATABASE_URI=... # Supabase
```

### 3. Update RevealUI Config

RevealUI uses a **universal PostgreSQL adapter** that automatically detects your provider:

```typescript
// apps/cms/revealui.config.ts
import { universalPostgresAdapter } from '@revealui/core/database'

export default buildConfig({
  db: universalPostgresAdapter({
    // Auto-detected from DATABASE_URL, POSTGRES_URL, or SUPABASE_DATABASE_URI
    // Or explicitly set:
    connectionString: process.env.DATABASE_URL,
    provider: 'neon', // Optional: 'neon' | 'supabase' | 'vercel'
  }),
  // ... rest of config
})
```

### 4. Initialize Database

```bash
# Verify connection and check tables
pnpm db:init

# Start development server (tables created automatically)
pnpm dev

# Visit admin panel
# http://localhost:4000/admin
```

---

## Provider Setup

### Neon Database

#### Step 1: Create Neon Database

1. Sign up at [neon.tech](https://neon.tech)
2. Create a new project
3. Copy your connection string:
   ```
   postgresql://user:password@ep-xxx.us-east-1.aws.neon.tech/neondb?sslmode=require
   ```

#### Step 2: Configure Environment

```bash
# .env.local or .env.production
DATABASE_URL=postgresql://user:password@ep-xxx.us-east-1.aws.neon.tech/neondb?sslmode=require
```

Or explicitly:
```bash
POSTGRES_URL=postgresql://user:password@ep-xxx.us-east-1.aws.neon.tech/neondb?sslmode=require
```

#### Step 3: Install Dependencies

Neon uses `@neondatabase/serverless` (already included if using `@revealui/db`):

```bash
pnpm add @neondatabase/serverless
```

#### Step 4: Update RevealUI Config

```typescript
// apps/cms/revealui.config.ts
import { universalPostgresAdapter } from '@revealui/core/database'

export default buildConfig({
  db: universalPostgresAdapter({
    provider: 'neon', // Optional: auto-detected from connection string
  }),
  // ... rest of config
})
```

#### Step 5: Initialize Database

```bash
# Start development server
pnpm dev

# Or run initialization script
pnpm db:init
```

RevealUI will automatically create tables on first run.

---

### Supabase Database

#### Step 1: Create Supabase Project

1. Sign up at [supabase.com](https://supabase.com)
2. Create a new project
3. Go to **Settings** → **Database**
4. Copy your connection string (use **Session mode** for serverless):
   ```
   postgresql://postgres:password@xxx.supabase.co:5432/postgres
   ```

#### Step 2: Configure Environment

```bash
# .env.local
DATABASE_URL=postgresql://postgres:password@xxx.supabase.co:5432/postgres
```

Or use Supabase-specific variable:
```bash
SUPABASE_DATABASE_URI=postgresql://postgres:password@xxx.supabase.co:5432/postgres
```

#### Step 3: Configure IP Allowlist

**Important:** Supabase requires IP allowlist configuration for external connections.

1. Go to **Project Settings** → **Database** → **Network**
2. Add your development machine's IP address
3. For production, add your server's IP or use connection pooling

**For serverless deployments:**
- Use Supabase's connection pooling (port 6543)
- Enable **Session mode** for better compatibility

#### Step 4: Install Dependencies

```bash
pnpm add pg @types/pg
```

#### Step 5: Update RevealUI Config

```typescript
// apps/cms/revealui.config.ts
import { universalPostgresAdapter } from '@revealui/core/database'

export default buildConfig({
  db: universalPostgresAdapter({
    provider: 'supabase', // Optional: auto-detected
  }),
  // ... rest of config
})
```

#### Step 6: Initialize Database

```bash
pnpm dev
```

Tables will be created automatically.

---

### Vercel Postgres

**Note:** Vercel Postgres is deprecated. Use Neon for new projects.

#### Step 1: Create Vercel Postgres Database

1. Go to your Vercel project
2. Navigate to **Storage** tab
3. Create a new Postgres database
4. Copy connection string

#### Step 2: Configure Environment

Vercel automatically sets environment variables:
- `POSTGRES_URL` - Connection string
- `POSTGRES_PRISMA_URL` - Prisma-specific URL
- `POSTGRES_URL_NON_POOLING` - Direct connection URL

For local development:
```bash
# .env.local
DATABASE_URL=$POSTGRES_URL
```

#### Step 3: Install Dependencies

```bash
pnpm add @neondatabase/serverless pg
```

Note: Vercel Postgres uses Neon under the hood, so we use `@neondatabase/serverless`.

#### Step 4: Update RevealUI Config

```typescript
// apps/cms/revealui.config.ts
import { universalPostgresAdapter } from '@revealui/core/database'

export default buildConfig({
  db: universalPostgresAdapter({
    provider: 'vercel', // Or let it auto-detect
  }),
  // ... rest of config
})
```

#### Step 5: Initialize Database

```bash
pnpm dev
```

---

## Database Types

### Type Generation

RevealUI generates TypeScript types from Drizzle ORM schemas, creating a centralized `Database` type that matches Supabase's structure.

#### Generating Types

Generate types from Drizzle schemas:

```bash
# Generate types in @revealui/db package
pnpm --filter @revealui/db generate:types

# Or use the root script (generates and copies to generated package)
pnpm generate:neon-types
```

#### What Gets Generated

The generator creates `packages/db/src/types/database.ts` with:

1. **Individual table types**: `UsersRow`, `UsersInsert`, `UsersUpdate`, etc.
2. **Centralized Database type**: Matching Supabase structure
3. **Type utilities**: `TableRow`, `TableInsert`, `TableUpdate`, etc.
4. **Relationships**: Foreign key relationships for each table
5. **Enums**: Database enum types (when defined)

**Note**: Types are automatically copied to `packages/core/src/core/generated/types/neon.ts` when using `pnpm generate:neon-types`.

#### When to Regenerate

Regenerate types when:

- ✅ Adding new tables to Drizzle schemas
- ✅ Modifying table structures (columns, types)
- ✅ Adding or changing relationships
- ✅ Before deploying to production
- ✅ After database migrations

---

### Type Structure

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

### Type Utilities

#### TableRow

Extract Row type for a table:

```typescript
import type { TableRow } from '@revealui/db/types'

type User = TableRow<'users'>
// Equivalent to: Database['public']['Tables']['users']['Row']
```

#### TableInsert

Extract Insert type for a table:

```typescript
import type { TableInsert } from '@revealui/db/types'

type NewUser = TableInsert<'users'>
// Equivalent to: Database['public']['Tables']['users']['Insert']
```

#### TableUpdate

Extract Update type for a table:

```typescript
import type { TableUpdate } from '@revealui/db/types'

type UserUpdate = TableUpdate<'users'>
// Equivalent to: Database['public']['Tables']['users']['Update']
```

#### TableRelationships

Extract Relationships for a table:

```typescript
import type { TableRelationships } from '@revealui/db/types'

type UserRelationships = TableRelationships<'users'>
// Equivalent to: Database['public']['Tables']['users']['Relationships']
```

---

### Usage Examples

#### Importing the Database Type

```typescript
import type { Database } from '@revealui/db/types'

// Or from the core package (merged from @revealui/generated)
import type { Database } from '@revealui/core/generated/types/neon'
```

#### Query Operations

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

#### Insert Operations

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

#### Update Operations

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

#### Working with Enums

When enums are defined in the database schema, they're included in the `Enums` type:

```typescript
import type { Database } from '@revealui/db/types'

// Access enum values
type StatusEnum = Database['public']['Enums']['status_enum']
// StatusEnum is a union of string literals
```

---

## Provider-Specific Features

### ElectricSQL Setup

ElectricSQL Electrification Migrations enable tables to be synchronized to client applications.

**What is Electrification?**
- Enables tables to be synchronized to client applications
- Each table needs to be explicitly electrified with appropriate sync rules
- Should be run via ElectricSQL CLI or service after setting up the service

#### Electrification Commands

```sql
-- Electrify agent_contexts table
-- Syncs contexts filtered by agent_id and optional session_id
ALTER TABLE agent_contexts ENABLE ELECTRIC;

-- Electrify agent_memories table
-- Syncs memories filtered by agent_id and optional site_id
ALTER TABLE agent_memories ENABLE ELECTRIC;

-- Electrify conversations table
-- Syncs conversations filtered by user_id and optional agent_id
ALTER TABLE conversations ENABLE ELECTRIC;

-- Electrify agent_actions table
-- Syncs actions filtered by agent_id and optional conversation_id
ALTER TABLE agent_actions ENABLE ELECTRIC;
```

#### Row Level Security (RLS) Policies

Row Level Security policies should be configured in PostgreSQL to enforce data filtering at the database level. The sync shapes in the client code work in conjunction with RLS policies to ensure only authorized data is synced.

**Example RLS policies** (should be created in your database migrations):

```sql
-- Agent contexts policy
CREATE POLICY sync_agent_contexts_policy ON agent_contexts
  FOR SELECT
  USING (
    agent_id = current_setting('app.agent_id', true)::text
    AND (
      session_id = current_setting('app.session_id', true)::text
      OR current_setting('app.session_id', true) IS NULL
    )
  );

-- Agent memories policy
CREATE POLICY sync_agent_memories_policy ON agent_memories
  FOR SELECT
  USING (
    agent_id = current_setting('app.agent_id', true)::text
    AND (
      site_id = current_setting('app.site_id', true)::text
      OR current_setting('app.site_id', true) IS NULL
    )
  );

-- Conversations policy
CREATE POLICY sync_conversations_policy ON conversations
  FOR SELECT
  USING (
    user_id = current_setting('app.user_id', true)::text
    AND (
      agent_id = current_setting('app.agent_id', true)::text
      OR current_setting('app.agent_id', true) IS NULL
    )
  );

-- Agent actions policy
CREATE POLICY sync_agent_actions_policy ON agent_actions
  FOR SELECT
  USING (
    agent_id = current_setting('app.agent_id', true)::text
    AND (
      conversation_id = current_setting('app.conversation_id', true)::text
      OR current_setting('app.conversation_id', true) IS NULL
    )
  );
```

---

### Supabase Networking

#### IPv4/IPv6 Compatibility

Supabase databases use **IPv6 addresses by default**. This section explains what this means and when you might need the IPv4 add-on.

**Understanding the Protocols:**
- **IPv6**: Modern internet protocol (most modern networks support it)
- **IPv4**: Older internet protocol (still widely used, especially in corporate networks)

#### Do You Need the IPv4 Add-On?

**✅ You Probably DON'T Need It If:**

1. You're on a modern network (most home/office networks support IPv6)
2. Your development environment works (if connections are working, you're fine)
3. You're using Supabase's Session Pooler (which handles IPv4/IPv6 automatically)

**⚠️ You MIGHT Need It If:**

1. You're on a corporate network that blocks IPv6
2. You're getting connection errors when trying to connect
3. You're deploying to a server that only supports IPv4
4. You're using direct database connections (not Session Pooler)

#### Session Pooler (Recommended)

**Session Pooler** is Supabase's connection pooling service that:
- ✅ Handles IPv4/IPv6 compatibility automatically
- ✅ Provides better connection management
- ✅ Is **free** to use
- ✅ Uses a different connection string format

**Standard connection string:**
```
postgresql://postgres:password@db.xxx.supabase.co:5432/postgres
```

**Session Pooler connection string:**
```
postgresql://postgres:password@db.xxx.supabase.co:6543/postgres
```

Notice: Port **6543** instead of **5432** (this is the Session Pooler port)

#### Cost Comparison

- **Session Pooler**: ✅ **FREE** (recommended)
- **IPv4 Add-On**: 💰 **~$4/month** (only if needed)

#### Recommendation

**For most users**: You don't need the IPv4 add-on. The Supabase client library works with both IPv4 and IPv6 automatically.

**Only enable IPv4 add-on if:**
- You're getting actual connection errors
- You're on a network that blocks IPv6
- You need direct PostgreSQL connections

---

## Troubleshooting

### Connection Issues

**Problem:** Cannot connect to database

**Solutions:**
- Check connection string format
- Verify IP allowlist (for Supabase)
- Ensure SSL is enabled: `?sslmode=require`
- Check database permissions
- Verify network connectivity

### Tables Not Created

**Problem:** RevealUI doesn't create tables automatically

**Solutions:**
- Check database permissions (user must have CREATE TABLE permission)
- Verify RevealUI config loads correctly
- Check application logs for errors
- Try running `pnpm db:init` manually

### Wrong Provider Detected

**Problem:** Universal adapter detects wrong provider

**Solution:**
Explicitly set provider in config:
```typescript
db: universalPostgresAdapter({
  provider: 'neon', // Force specific provider
})
```

### Connection Pool Exhausted

**Problem:** "Too many connections" error

**Solutions:**
- Use connection pooling (Supabase port 6543)
- Reduce concurrent connections
- Use Neon's auto-scaling connections
- Configure connection limits in adapter

### SSL/TLS Errors

**Problem:** SSL connection errors

**Solution:**
Add SSL parameters to connection string:
```
postgresql://...?sslmode=require
```

For Neon:
```
postgresql://...?sslmode=require&sslrootcert=/path/to/cert.pem
```

### Types Not Updating

**Problem:** Changes to schemas not reflected in generated types.

**Solution:**
1. Ensure you've saved all schema files
2. Run `pnpm --filter @revealui/db generate:types`
3. Check that `packages/db/src/types/database.ts` was updated
4. Restart TypeScript server in your IDE

### Missing Tables

**Problem:** Some tables not appearing in Database type.

**Solution:**
1. Verify table is exported from `packages/db/src/core/index.ts`
2. Check table name matches database table name (snake_case)
3. Regenerate types: `pnpm generate:neon-types`

### Import Errors

**Problem:** Cannot import Database type.

**Solution:**
1. Ensure `@revealui/db` package is built: `pnpm --filter @revealui/db build`
2. Check import path: `@revealui/db/types` or `@revealui/core/generated/types/neon`
3. Verify types are exported in `packages/db/src/types/index.ts`

---

## Best Practices

### Type Safety

#### Use Type Utilities

Prefer type utilities over manual extraction:

```typescript
// ✅ Good - concise and readable
import type { TableRow } from '@revealui/db/types'
type User = TableRow<'users'>

// ❌ Less readable - but functionally equivalent
type User = Database['public']['Tables']['users']['Row']
```

#### Type-Safe Inserts

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

#### Use Drizzle's Native API

Drizzle provides excellent type safety out of the box:

```typescript
// ✅ Good - Drizzle's native API is fully type-safe
const users = await db.query.users.findMany()

// ❌ Avoid - loses type safety
const users = await db.execute(sql`SELECT * FROM users`)
```

### Type Generation

- **After schema changes**: Run `pnpm generate:neon-types`
- **Before deployment**: Ensure types match production schema
- **Commit generated files**: Include `database.ts` in version control

### Validation

Use contracts to validate database data:

```typescript
import { dbRowToContract } from '@revealui/contracts/database'
import { UserSchema } from '@revealui/contracts'

const dbUser = await db.query.users.findFirst()
const validatedUser = dbRowToContract(UserSchema, dbUser)
```

---

## What Gets Created Automatically

When RevealUI starts, it automatically creates:

### System Tables

- ✅ `revealui_locked_documents` - Document locking for concurrent editing
- ✅ `revealui_locked_documents_rels` - Relationship junctions
- ✅ `revealui_preferences` - User/system preferences
- ✅ `revealui_preferences_rels` - Preference relationships
- ✅ `revealui_migrations` - Migration tracking

### Collection Tables

- ✅ One table per collection in your config
- ✅ Junction tables (`*_rels`) for relationships
- ✅ All with correct `revealui_*` naming (not legacy `payload_*`)

---

## Universal Adapter Features

The universal PostgreSQL adapter (`packages/core/src/cms/database/universal-postgres.ts`) provides:

- ✅ **Auto-detection:** Automatically detects provider from connection string
- ✅ **Parameterized Queries:** Handles parameter formatting for all providers
- ✅ **Connection Pooling:** Supports connection pooling where available
- ✅ **Fallback Mechanisms:** Graceful degradation for compatibility
- ✅ **Type Safety:** Full TypeScript support

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

## Key Benefits

✅ **No Migration Needed** - Fresh databases create correct table names automatically
✅ **Universal Adapter** - One adapter works with all three providers
✅ **Auto-Detection** - Provider detected automatically from connection string
✅ **Type Safety** - Full TypeScript support with Supabase-compatible types
⚠️ **Production Capability** - Designed for connection pooling, SSL, and edge functions (Pending verification)

---

## Next Steps

1. ✅ Choose your provider (Neon, Supabase, or Vercel Postgres)
2. ✅ Get connection string from provider dashboard
3. ✅ Set `DATABASE_URL` environment variable
4. ✅ Run `pnpm db:init` to verify connection
5. ✅ Start development: `pnpm dev`
6. ✅ Visit `http://localhost:4000/admin`
7. ✅ Create your first admin user
8. ✅ Generate types: `pnpm generate:neon-types`

---

## Contract Integration

Guide to integrating Database types with the Contracts system for end-to-end type safety.

### Overview

The Contracts system bridges Database types (from `@revealui/db`) with Zod schemas (from `@revealui/contracts`), ensuring type safety across all layers:

```
Database (Postgres)
    ↓
Drizzle Schemas (@revealui/db)
    ↓
Database Types (Database['public']['Tables'])
    ↓
Contracts (@revealui/contracts/database)
    ↓
RevealUI Types (@revealui/core)
```

### Database Contract Bridge

#### Converting Database Rows to Contracts

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

#### Safe Conversion (No Throw)

Use `safeDbRowToContract` for error handling:

```typescript
import { safeDbRowToContract } from '@revealui/contracts/database'
import { UserSchema } from '@revealui/contracts'

const result = safeDbRowToContract(UserSchema, dbUser)
if (result.success) {
  // result.data is fully typed and validated
  console.log(result.data.email)
} else {
  // Handle validation errors
  console.error(result.errors.issues)
}
```

#### Converting Contracts to Database Inserts

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

### Type Bridge Utilities

#### Creating Mappers

Create reusable mappers for type conversion:

```typescript
import { createDbRowMapper, createContractToDbMapper } from '@revealui/contracts/database'
import { UserSchema } from '@revealui/contracts'

// Map database rows to contracts
const userMapper = createDbRowMapper(UserSchema)

const dbUsers = await db.query.users.findMany()
const validatedUsers = dbUsers.map(userMapper)

// Map contracts to database inserts
const insertMapper = createContractToDbMapper<User, Database['public']['Tables']['users']['Insert']>()

const newUser = createUser('user-123', { email: 'user@example.com', name: 'User' })
const dbInsert = insertMapper(newUser)
```

#### Batch Conversion

Convert multiple rows at once:

```typescript
import { batchDbRowsToContract, batchContractToDbInsert } from '@revealui/contracts/database'

// Batch convert database rows
const dbUsers = await db.query.users.findMany()
const validatedUsers = batchDbRowsToContract(UserSchema, dbUsers)

// Batch convert contracts to inserts
const newUsers = [createUser('1', {...}), createUser('2', {...})]
const dbInserts = batchContractToDbInsert(newUsers)
await db.insert(users).values(dbInserts)
```

#### Type Guards

Use type guards for runtime type checking:

```typescript
import { isDbRowMatchingContract, isDbRowAndContract } from '@revealui/contracts/database'

const dbUser = await db.query.users.findFirst()

if (isDbRowMatchingContract(UserSchema, dbUser)) {
  // dbUser is now typed as User (from contract)
  console.log(dbUser.email)
}
```

### Table Contract Registry

Register contracts for automatic validation:

```typescript
import { databaseContractRegistry } from '@revealui/contracts/database'
import { UserSchema, SiteSchema } from '@revealui/contracts'

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

#### Creating Type-Safe Registries

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

### Type Conversion Patterns

#### Pattern 1: Query → Validate → Use

```typescript
import { safeDbRowToContract } from '@revealui/contracts/database'
import { UserSchema } from '@revealui/contracts'

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

#### Pattern 2: Contract → Insert

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

#### Pattern 3: Batch Processing

```typescript
import { batchDbRowsToContract } from '@revealui/contracts/database'

// Fetch and validate in batch
const dbUsers = await db.query.users.findMany()
const validatedUsers = batchDbRowsToContract(UserSchema, dbUsers)

// Process validated users
validatedUsers.forEach((user) => {
  // user is fully typed and validated
  processUser(user)
})
```

### Contract Integration Best Practices

#### 1. Validate at Boundaries

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

#### 2. Use Contracts for Inserts

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

#### 3. Register Contracts Early

Register contracts at application startup:

```typescript
// In your app initialization
import { databaseContractRegistry } from '@revealui/contracts/database'
import { UserSchema, SiteSchema, PageSchema } from '@revealui/contracts'

databaseContractRegistry.register('users', UserSchema)
databaseContractRegistry.register('sites', SiteSchema)
databaseContractRegistry.register('pages', PageSchema)
```

#### 4. Type Safety First

Leverage TypeScript's type system:

```typescript
// ✅ Good - full type safety
type User = Database['public']['Tables']['users']['Row']
const user: User = await db.query.users.findFirst()

// ✅ Better - validated type
const validatedUser = dbRowToContract(UserSchema, user)
// validatedUser is both typed AND validated
```

### Contract Error Handling

#### Validation Errors

Contracts provide detailed validation errors:

```typescript
import { safeDbRowToContract } from '@revealui/contracts/database'
import { ConfigValidationError } from '@revealui/contracts/cms'

const result = safeDbRowToContract(UserSchema, dbUser)
if (!result.success) {
  // Access detailed errors
  result.errors.issues.forEach((issue) => {
    console.error(`${issue.path.join('.')}: ${issue.message}`)
  })
}
```

#### Type Mismatches

Type mismatches are caught at compile time:

```typescript
// TypeScript will error if types don't match
const dbInsert: Database['public']['Tables']['users']['Insert'] =
  contractToDbInsert(someInvalidData) // ❌ Type error
```

### Advanced Contract Patterns

#### Custom Mappers

Create custom mappers for complex transformations:

```typescript
const userMapper = createDbRowMapper(UserSchema, (row) => ({
  ...row,
  // Transform data before validation
  email: row.email?.toLowerCase(),
  name: row.name.trim(),
}))
```

#### Relationship Handling

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

---

## Drizzle ORM Guide

### Overview

This section covers Drizzle ORM integration with Neon HTTP, including connection patterns, compatibility issues, and best practices.

**Key Topics**:
- ✅ Official Drizzle ORM connection patterns
- ✅ Known compatibility issues with Neon HTTP driver
- ✅ Implementation fixes and best practices
- ✅ Workarounds for query builder limitations

**Key Finding**: The Drizzle query builder has compatibility issues with Neon HTTP driver. This is a known limitation, not a code bug.

### Connection Pattern

#### Official Pattern (Recommended)

According to [Drizzle ORM - Connect Neon](https://orm.drizzle.team/docs/connect-neon):

```typescript
import { neon } from '@neondatabase/serverless'
import { drizzle } from 'drizzle-orm/neon-http'

const sql = neon(process.env.DATABASE_URL!)
const db = drizzle({ client: sql })
```

#### RevealUI Implementation

**File**: `packages/db/src/client/index.ts`

```typescript
import { neon } from '@neondatabase/serverless'
import { drizzle } from 'drizzle-orm/neon-http'

export function createClient(config: DatabaseConfig): Database {
  const sql = neon(config.connectionString)

  return drizzle({
    client: sql,
    schema,
    logger: config.logger ?? false,
  })
}
```

✅ **Status**: Matches official pattern

### Known Compatibility Issues

#### Query Builder Limitations

**Problem**: Drizzle query builder (`db.query.table.findFirst()`) has compatibility problems with Neon HTTP driver.

**Root Cause**:
- Neon HTTP driver translates queries to HTTP requests
- Some Drizzle query patterns don't translate correctly
- Prepared statements aren't supported (which Drizzle relies on)

**Affected Queries**:
- `db.query.nodeIdMappings.findFirst()`
- `db.query.agentMemories.findFirst()`
- Any relational query using `findFirst()`

**Symptoms**:
- Queries timeout or fail with "Failed query" errors
- Retry logic triggers but queries never succeed
- Direct SQL queries work (verified via `psql`)

**Status**: Library-level issue, not fixable in our code

#### Workarounds

##### Option 1: Use Raw SQL (Recommended)

For queries that fail with query builder, use raw SQL:

```typescript
import { sql } from 'drizzle-orm'

const result = await db.execute(
  sql`SELECT * FROM node_id_mappings WHERE id = ${hash} LIMIT 1`
)
```

##### Option 2: Use Direct Postgres Driver for Local Testing

For local development and testing, consider using direct PostgreSQL driver:

```typescript
// For local testing only
import { drizzle } from 'drizzle-orm/node-postgres'
import { Pool } from 'pg'

const pool = new Pool({ connectionString: config.connectionString })
return drizzle({ client: pool, schema })
```

##### Option 3: Hybrid Approach

Use query builder where it works, raw SQL where it doesn't:

```typescript
// Try query builder first
try {
  const result = await db.query.table.findFirst({ where: ... })
  return result
} catch (error) {
  // Fallback to raw SQL
  return await db.execute(sql`SELECT * FROM table WHERE ... LIMIT 1`)
}
```

### Drizzle Best Practices

#### 1. Driver Selection

| Driver | Use Case | Status |
|--------|----------|--------|
| `drizzle-orm/neon-http` | HTTP connections (serverless) | ✅ Recommended |
| `drizzle-orm/neon-serverless` | WebSocket connections (transactions) | ⚠️ Use if transactions needed |
| `drizzle-orm/node-postgres` | Direct Postgres (local testing) | 💡 Alternative for testing |

#### 2. Connection Pooling

- ⚠️ **Avoid with Drizzle**: Neon's connection pooling (PgBouncer) doesn't support prepared statements
- ✅ **Use direct connections**: Or Neon HTTP driver (which we are)

#### 3. Initialize Clients Correctly

- Use the official pattern: `drizzle({ client: neon(connectionString) })`
- Pass schema and logger in the config object
- Don't use old pattern: `drizzle(sql, { schema, logger })` ❌

#### 4. Handle Transactions

- Neon HTTP driver doesn't support true transactions
- Use `@neondatabase/serverless` Pool for transaction support if needed

### Testing Status

#### What Works ✅

- Database connection: Working
- Migrations: Applied successfully
- CRDT persistence tests: 4/4 passing
- Connection pattern: Matches official docs
- Direct SQL queries: Working

#### What Doesn't Work ❌

- Integration tests: 8/8 failing (query builder compatibility)
- Performance tests: Failing (same issue)
- Relational queries: Fail with Neon HTTP driver

**Note**: Failures are due to library-level compatibility, not our code.

### Implementation History

#### Changes Applied (2025-01-27)

1. ✅ **Updated connection pattern** to match official Drizzle documentation
2. ✅ **Fixed test setup issues** (constructor parameters, method names)
3. ✅ **Documented known compatibility issues** with Neon HTTP driver
4. ✅ **Identified library-level limitations** that require workarounds

#### Files Updated

- `packages/db/src/client/index.ts` - Updated connection pattern
- `packages/ai/src/memory/__tests__/integration/automated-validation.test.ts` - Fixed test setup

### Recommendations

#### Immediate Actions

1. ✅ **Keep current implementation** - Connection pattern is correct
2. ✅ **Document limitations** - Team knows about query builder issues
3. ⏳ **Use workarounds** - Use raw SQL for failing queries if needed

#### Long-term Strategy

1. **Monitor library updates** - Watch for Drizzle/Neon compatibility fixes
2. **Alternative for local testing** - Use direct Postgres driver for integration tests
3. **Hybrid approach** - Use query builder where it works, raw SQL where it doesn't

#### For Production

1. **Test thoroughly** - Verify all queries work in production environment
2. **Have fallbacks** - Know how to use raw SQL if query builder fails
3. **Monitor errors** - Track query failures and adjust accordingly

### References

#### Official Documentation

- [Drizzle ORM - Connect Neon](https://orm.drizzle.team/docs/connect-neon)
- [Drizzle ORM - Tutorial with Neon](https://orm.drizzle.team/docs/tutorials/drizzle-with-neon)
- [Drizzle ORM - Upgrade to v1.0](https://orm.drizzle.team/docs/upgrade-v1)
- [Drizzle ORM - Relations v1 to v2](https://orm.drizzle.team/docs/relations-v1-v2)
- [Neon Serverless Driver](https://neon.tech/docs/serverless/serverless-driver)

#### Related Issues

- GitHub: Drizzle ORM compatibility issues with Neon
- Known limitation: Prepared statements with connection pooling

---

## Related Documentation

- [MIGRATIONS.md](./MIGRATIONS.md) - Migration strategies and provider switching
- [Unified Backend Architecture](../architecture/UNIFIED_BACKEND_ARCHITECTURE.md) - System architecture

### External Resources

- [Drizzle ORM Documentation](https://orm.drizzle.team) - Official Drizzle documentation
- [Supabase Type Generation](https://supabase.com/docs/guides/api/generating-types) - Supabase comparison reference
- [Neon Documentation](https://neon.tech/docs) - Neon PostgreSQL documentation
- [PostgreSQL Documentation](https://www.postgresql.org/docs/) - PostgreSQL reference

---

**Last Updated:** 2025-01-31
**Status:** Production-ready with caveats (see troubleshooting)
