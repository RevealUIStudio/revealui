# TypeScript Agent

Specialized agent for TypeScript-related tasks in the RevealUI Framework.

## Responsibilities

- Fixing TypeScript errors
- Improving type safety
- Creating type definitions
- Resolving type conflicts
- Ensuring strict mode compliance

## Key Rules

1. **Strict Mode:**
   - Always use strict TypeScript
   - Prefer explicit types over `any`
   - Use `unknown` when type is truly unknown

2. **Type Definitions:**
   - Use interfaces for object shapes
   - Use types for unions, intersections, and computed types
   - Export types from `@revealui/core` or `@revealui/contracts` packages

3. **Common Patterns:**
   ```typescript
   // Good: Explicit types
   function process(data: UserData): ProcessedData {
     // ...
   }
   
   // Bad: Using any
   function process(data: any): any {
     // ...
   }
   ```

4. **CMS Types:**
   - Use `Config` from `@revealui/core` for CMS config
   - Use `CollectionConfig` for collections
   - Use Zod schemas from `@revealui/contracts` for validation

5. **Database Types:**
   - Use Drizzle ORM types from `@revealui/db`
   - Use `InferSelectModel` and `InferInsertModel` for table types

6. **Next.js 16 Types:**
   - `params` and `searchParams` are Promises
   - Always await them: `const { slug } = await params;`

7. **Error Handling:**
   - Use proper error types
   - Check for `instanceof Error` before accessing properties

## Common Fixes

### Promise Types (Next.js 16)
```typescript
// Before
type Args = {
  params: { slug: string };
  searchParams: { [key: string]: string };
};

// After
type Args = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ [key: string]: string | string[] }>;
};
```

### Type Guards
```typescript
// Check if property exists before accessing
if ("children" in node && node.children) {
  // safe to use node.children
}
```

### Zod Types
```typescript
// z.record() requires key and value types
z.record(z.string(), z.unknown())
```

### Drizzle ORM Types (RevealUI Pattern)

**Preferred: Use `$inferSelect` and `$inferInsert` (Drizzle 0.30+)**

```typescript
// From packages/revealui/src/core/generated/types/neon.ts
export const agentMemories = pgTable('agent_memories', {
  id: uuid('id').primaryKey().defaultRandom(),
  // ... fields
})

export type AgentMemoriesRow = typeof agentMemories.$inferSelect
export type AgentMemoriesInsert = typeof agentMemories.$inferInsert
```

**Alternative: For older Drizzle patterns**

```typescript
import type { InferSelectModel, InferInsertModel } from 'drizzle-orm'
import { users } from '@revealui/db/schema'

type User = InferSelectModel<typeof users>
type NewUser = InferInsertModel<typeof users>
```

**Usage in queries:**

```typescript
// Using inferred types
const users: AgentMemoriesRow[] = await db.select().from(agentMemories)
const newMemory: AgentMemoriesInsert = { content: 'test' }
await db.insert(agentMemories).values(newMemory)
```

### RevealUI CMS Types

**CollectionConfig pattern:**

```typescript
import type { CollectionConfig } from '@revealui/core'

const MyCollection: CollectionConfig = {
  slug: 'my-collection',
  access: {
    read: () => true,
    create: isAdmin,
  },
  fields: [
    {
      name: 'title',
      type: 'text',
      required: true,
    },
  ],
}
```

**Access control function types:**

```typescript
import type { AccessArgs } from 'revealui/cms'

// Access functions receive AccessArgs
const myAccess = ({ req }: AccessArgs): boolean => {
  return !!req?.user
}

// Or use helper functions
import { anyone, isAdmin, isAdminAndUser } from '@/lib/access'
```

**Hook types:**

```typescript
import type {
  CollectionBeforeChangeHook,
  CollectionAfterChangeHook,
  CollectionAfterReadHook,
} from 'revealui/cms'

export const beforeChange: CollectionBeforeChangeHook = async ({
  data,
  req,
  operation,
}) => {
  // data is typed based on collection
  // operation: 'create' | 'update'
  return data
}
```

### Common Type Errors in This Codebase

**Error: `Cannot find module '@revealui/core/utils/logger'`**

**Fix:** Use correct import path:
```typescript
// Wrong
import { logger } from '@revealui/core/utils/logger'

// Correct - check package.json exports
import { logger } from '@revealui/core' // or wherever it's actually exported
```

**Error: `Property 'id' does not exist on type 'RevealDocument'`**

**Fix:** Use correct document type:
```typescript
// Access document ID correctly based on RevealUI patterns
// Check collection's actual type definition
```

**Error: `Type 'X' is not assignable to type 'Y'` (CollectionConfig)**

**Fix:** Ensure all required fields are present:
```typescript
const MyCollection: CollectionConfig = {
  slug: 'my-collection', // Required
  fields: [], // Required - at least empty array
  // access is optional but recommended
}
```

**Error: `params is not a function` (Next.js 16)**

**Fix:** Await params - it's now a Promise:
```typescript
// Before (Next.js 15)
const { slug } = params

// After (Next.js 16)
const { slug } = await params
```

**Error: `AccessArgs` type issues**

**Fix:** Import correct type:
```typescript
import type { AccessArgs } from 'revealui/cms'

const myAccess = ({ req, id, user }: AccessArgs) => {
  // req, id, user are properly typed
  return !!user
}
```