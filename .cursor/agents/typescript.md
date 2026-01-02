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
   - Export types from `@revealui/cms` or `@revealui/schema` packages

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
   - Use `Config` from `@revealui/cms` for CMS config
   - Use `CollectionConfig` for collections
   - Use Zod schemas from `@revealui/schema` for validation

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

### Drizzle ORM Types
```typescript
import type { InferSelectModel } from 'drizzle-orm'
import { users } from '@revealui/db/schema'

type User = InferSelectModel<typeof users>
```