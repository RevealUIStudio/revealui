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
   - Export types from `payload` package when available

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

4. **PayloadCMS Types:**
   - Use `Config` from `payload` for PayloadCMS config
   - Use `CollectionConfig` for collections
   - Use generated types from `src/types/payload.ts`

5. **Next.js 16 Types:**
   - `params` and `searchParams` are Promises
   - Always await them: `const { slug } = await params;`

6. **Error Handling:**
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

