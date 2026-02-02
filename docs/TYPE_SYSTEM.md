# Unified Type System Architecture

## Overview

RevealUI uses a unified type system where **Drizzle schemas are the single source of truth**. All types, Zod schemas, and Contract wrappers are auto-generated from Drizzle table definitions, eliminating manual duplication and preventing type drift.

## Architecture

### Type Flow

```
┌─────────────────────────────────────────┐
│   SOURCE OF TRUTH: Drizzle Schemas      │
│   packages/db/src/schema/*.ts             │
└──────────────┬──────────────────────────┘
               │
               │ Auto-generate (drizzle-zod)
               ▼
┌─────────────────────────────────────────┐
│   GENERATED: Zod Schemas + Contracts    │
│   packages/contracts/src/generated/     │
│   - zod-schemas.ts                      │
│   - contracts.ts                        │
│   - database.ts (re-exports)            │
└──────────────┬──────────────────────────┘
               │
               │ Import & extend
               ▼
┌─────────────────────────────────────────┐
│   BUSINESS LOGIC: Entity Contracts      │
│   packages/contracts/src/entities/      │
│   - Dual representation                 │
│   - Business rules                      │
│   - Computed properties                 │
└──────────────┬──────────────────────────┘
               │
               │ Consume
               ▼
┌─────────────────────────────────────────┐
│   APPLICATION: Type-safe operations     │
│   apps/*, packages/core/*               │
└─────────────────────────────────────────┘
```

## Key Components

### 1. Drizzle Schemas (Source of Truth)

Location: `packages/db/src/schema/*.ts`

These define the actual database tables using Drizzle ORM:

```typescript
// packages/db/src/schema/users.ts
export const users = pgTable('users', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  email: text('email'),
  role: text('role').notNull().default('viewer'),
  // ... more fields
})
```

**Why Drizzle?**
- Type-safe database queries
- Migration generation
- Direct mapping to Postgres
- Single source of truth for schema

### 2. Auto-Generated Zod Schemas

Location: `packages/contracts/src/generated/zod-schemas.ts`

Generated automatically using `drizzle-zod`:

```typescript
// Auto-generated - DO NOT EDIT
export const UsersSelectSchema = createSelectSchema(tables.users)
export const UsersInsertSchema = createInsertSchema(tables.users)
export type UsersRow = z.infer<typeof UsersSelectSchema>
export type UsersInsert = z.infer<typeof UsersInsertSchema>
```

**Benefits:**
- Runtime validation
- Form validation
- API request/response validation
- Always in sync with database schema

### 3. Auto-Generated Contract Wrappers

Location: `packages/contracts/src/generated/contracts.ts`

Unified interface combining types, schemas, and validation:

```typescript
// Auto-generated - DO NOT EDIT
export const UsersRowContract = createContract({
  name: 'UsersRow',
  version: '1',
  description: 'Database row contract for users table',
  schema: Schemas.UsersSelectSchema,
})
```

**Contracts provide:**
- Type inference: `ContractType<typeof UsersRowContract>`
- Runtime validation: `UsersRowContract.validate(data)`
- Type guards: `UsersRowContract.isType(data)`
- Metadata: versioning, docs, deprecation

### 4. Business Logic Extensions

Location: `packages/contracts/src/entities/*.ts`

Extend generated schemas with business logic:

```typescript
// packages/contracts/src/entities/user.ts
import { UsersSelectSchema } from '../generated/zod-schemas.js'

// Extend with dual representation
export const UserSchema = UsersSelectSchema.merge(DualEntitySchema).extend({
  // Add computed fields
  emailVerified: z.boolean().default(false),
}).refine((data) => {
  // Business rules
  if (data.type === 'agent' && !data.agentModel) {
    return false
  }
  return true
}, { message: 'Agent users must specify agentModel' })
```

## Generation Commands

### Generate All Types

```bash
pnpm generate:all
```

This runs the unified generation pipeline:
1. `pnpm --filter @revealui/db generate:types` - Generate TypeScript types from Drizzle
2. `pnpm --filter @revealui/db generate:zod` - Generate Zod schemas
3. `pnpm --filter @revealui/db generate:contracts` - Generate Contract wrappers
4. `pnpm validate:types` - Validate consistency

### Individual Commands

```bash
# Generate only database types
pnpm --filter @revealui/db generate:types

# Generate only Zod schemas
pnpm --filter @revealui/db generate:zod

# Generate only Contracts
pnpm --filter @revealui/db generate:contracts

# Validate type consistency
pnpm validate:types

# Enhanced validation with detailed analysis
pnpm validate:types:enhanced
```

## Validation System

### Basic Validation

The basic validation (`pnpm validate:types`) checks:
- All discovered tables have corresponding generated files
- Generated files exist and are readable
- Type consistency across the system

### Enhanced Validation

The enhanced validation system (`pnpm validate:types:enhanced`) provides comprehensive analysis:

```bash
pnpm validate:types:enhanced
```

**Features:**

1. **Breaking Change Detection**
   - Detects removed exports in generated types
   - Identifies type signature changes
   - Warns before changes reach production

2. **Schema Drift Analysis**
   - Compares source file timestamps vs generated files
   - Detects when schemas are modified but not regenerated
   - Prevents stale type usage

3. **Coverage Validation**
   - Ensures all Drizzle tables have Zod schemas
   - Checks for missing Contract wrappers
   - Identifies gaps in type generation

4. **Type Safety Checks**
   - Detects `any` types in generated code
   - Validates proper imports from drizzle-zod
   - Ensures type soundness

5. **Schema Version Tracking**
   - Checks generation timestamps
   - Warns if types are >30 days old
   - Encourages regular regeneration

**Example Output:**

```
🔍 Running enhanced type system validation...

📊 Validation Results

Tables checked: 23
Fields checked: 48
Errors: 0
Warnings: 1
Breaking changes: 0

⚠️  Warnings:

  generated.packages/contracts/src/generated/zod-schemas.ts
    Generated file is older than source schemas
    💡 Run: pnpm generate:all

✅ Enhanced validation passed!
```

**Issue Categories:**

- **Error** (❌) - Blocks deployment, must be fixed
- **Warning** (⚠️) - Should be addressed soon
- **Info** (ℹ️) - Informational, no action needed

**When to Use:**

- Before merging PRs that touch schemas
- During code review for database changes
- When debugging type-related issues
- As part of pre-deployment checks

## When to Regenerate

You **must** regenerate types when:

1. **Adding a new table**
   ```bash
   # After creating new table in packages/db/src/schema/
   pnpm generate:all
   git add packages/contracts/src/generated/
   git commit -m "feat: add new table schema"
   ```

2. **Modifying existing table**
   ```bash
   # After changing table definition
   pnpm generate:all
   git add packages/contracts/src/generated/
   git commit -m "feat: update table schema"
   ```

3. **Before committing** (CI will fail if out of sync)

## File Structure

```
packages/
├── db/
│   └── src/
│       ├── core/              # ← SOURCE OF TRUTH
│       │   ├── users.ts       # Drizzle table definitions
│       │   ├── sites.ts
│       │   └── ...
│       └── types/
│           ├── generate.ts              # Drizzle type generator
│           ├── generate-zod-schemas.ts  # Zod generator
│           └── generate-contracts.ts    # Contract generator
│
└── contracts/
    └── src/
        ├── generated/         # ← AUTO-GENERATED (don't edit!)
        │   ├── zod-schemas.ts    # Zod schemas
        │   ├── contracts.ts      # Contract wrappers
        │   └── database.ts       # Re-exports (was 768 lines, now 74)
        │
        └── entities/          # ← BUSINESS LOGIC
            ├── user.ts        # Extends generated schemas
            ├── site.ts
            └── ...
```

## CI/CD Integration

The type system is validated in CI to prevent drift:

```yaml
# .github/workflows/validate-types.yml
- name: Generate types
  run: pnpm generate:all

- name: Check for uncommitted changes
  run: |
    if [ -n "$(git status --porcelain packages/contracts/src/generated/)" ]; then
      echo "❌ Generated types are out of sync!"
      exit 1
    fi

- name: Validate consistency
  run: pnpm validate:types

- name: Enhanced validation
  run: pnpm validate:types:enhanced
```

**CI will fail if:**
- Generated files are out of sync with source
- Type drift is detected
- Validation checks fail
- Breaking changes are detected (errors only)
- Critical type safety issues found

## Usage Examples

### 1. Query Database with Type Safety

```typescript
import { db } from '@revealui/db'
import { users } from '@revealui/db/schema'

// Fully typed query result
const user = await db.select().from(users).where(eq(users.id, userId))
// user: UsersRow
```

### 2. Validate API Input

```typescript
import { UsersInsertSchema } from '@revealui/contracts/generated'

export async function createUser(input: unknown) {
  // Runtime validation
  const validated = UsersInsertSchema.parse(input)

  // Insert into database (fully typed)
  await db.insert(users).values(validated)
}
```

### 3. Use Contract for Full Validation

```typescript
import { UsersRowContract } from '@revealui/contracts/generated'

const result = UsersRowContract.validate(data)
if (result.success) {
  // result.data is fully typed
  console.log(result.data.email)
} else {
  console.error(result.errors)
}
```

### 4. Extend for Business Logic

```typescript
import { UsersSelectSchema } from '@revealui/contracts/generated'
import { z } from 'zod'

// Add business-specific fields
const EnrichedUserSchema = UsersSelectSchema.extend({
  displayName: z.string(),
  permissions: z.array(z.string()),
}).transform(data => ({
  ...data,
  displayName: data.name || data.email || 'Unknown',
  permissions: computePermissions(data.role)
}))
```

## Benefits

### ✅ Single Source of Truth
- Drizzle schemas are the only place to define tables
- All types flow from this source
- No manual synchronization needed

### ✅ Zero Manual Duplication
- Previously: 768 lines of manual type definitions
- Now: 74 lines of re-exports
- 90% reduction in manual code

### ✅ Type Safety Everywhere
- Compile-time: TypeScript types from Drizzle
- Runtime: Zod schemas for validation
- Contracts: Unified interface

### ✅ No Type Drift
- CI catches inconsistencies
- Impossible to forget regeneration
- Always in sync

### ✅ Better Developer Experience
- Clear import paths
- Consistent API
- Auto-completion everywhere
- Less cognitive load

### ✅ Maintainable
- Changes flow automatically
- Update schema once, get everywhere
- Easy to understand flow

## Migration Guide

### For New Tables

```typescript
// 1. Define Drizzle schema
export const newTable = pgTable('new_table', {
  id: text('id').primaryKey(),
  // ... fields
})

// 2. Export from rest.ts or appropriate file
export * from './new-table.js'

// 3. Generate types
// pnpm generate:all

// 4. Use generated schemas
import { NewTableSelectSchema } from '@revealui/contracts/generated'
```

### For Existing Entity Contracts

```typescript
// Before: Manual schema
const UserSchema = z.object({
  id: z.string(),
  name: z.string(),
  // ... duplicated fields
})

// After: Extend generated
import { UsersSelectSchema } from '../generated/zod-schemas.js'

const UserSchema = UsersSelectSchema.extend({
  // Only add computed/business fields
  emailVerified: z.boolean()
})
```

## Troubleshooting

### Generated files out of sync

```bash
# Regenerate everything
pnpm generate:all

# Run enhanced validation to see details
pnpm validate:types:enhanced

# Commit changes
git add packages/contracts/src/generated/
git commit -m "chore: regenerate types"
```

### Type errors after schema change

```bash
# 1. Regenerate
pnpm generate:all

# 2. Run enhanced validation
pnpm validate:types:enhanced

# 3. Rebuild packages
pnpm --filter @revealui/db build
pnpm --filter @revealui/contracts build

# 4. Check for breaking changes
pnpm typecheck:all
```

### Missing table in generated schemas

```bash
# Check table is exported from schema/index.ts
grep "export.*from.*your-table" packages/db/src/schema/rest.ts

# Run enhanced validation to see coverage
pnpm validate:types:enhanced

# Regenerate
pnpm generate:all
```

### Stale generated files warning

If enhanced validation warns about stale files:

```bash
# Check which files are out of date
pnpm validate:types:enhanced

# Regenerate to sync timestamps
pnpm generate:all

# Verify fix
pnpm validate:types:enhanced
```

### Breaking changes detected

If CI detects breaking changes:

```bash
# Run enhanced validation locally
pnpm validate:types:enhanced

# Review the breaking changes in output
# Common fixes:
# - Add deprecation notice before removing types
# - Provide migration path for changed types
# - Update consuming code before changing schemas
```

## Performance

### Generation Time

- **Drizzle types**: ~1s
- **Zod schemas**: ~1s
- **Contracts**: ~1s
- **Total**: ~3s

Fast enough to run before every commit!

### Build Impact

- No runtime overhead
- All types erased at compile time
- Zod schemas tree-shakeable

## Best Practices

### DO ✅

- Always run `pnpm generate:all` after schema changes
- Run `pnpm validate:types:enhanced` before committing schema changes
- Commit generated files with schema changes
- Extend generated schemas for business logic
- Use Contracts for public APIs
- Rely on CI to catch drift
- Check enhanced validation output for warnings
- Address breaking changes before they reach main

### DON'T ❌

- Edit generated files manually
- Duplicate type definitions
- Skip regeneration after schema changes
- Ignore validation warnings
- Import from `@revealui/db` in contracts (circular dependency)
- Create parallel type definitions
- Push with stale generated files
- Ignore breaking change warnings

## Support

For questions or issues:
- Check [TROUBLESHOOTING.md](./TROUBLESHOOTING.md)
- Review [ARCHITECTURE.md](./ARCHITECTURE.md)
- Open an issue in the repository

## Related Documentation

- [Database Schema Guide](./DATABASE.md)
- [Contract System](./CONTRACTS.md)
- [Type Safety Strategy](./TYPE_SAFETY.md)
