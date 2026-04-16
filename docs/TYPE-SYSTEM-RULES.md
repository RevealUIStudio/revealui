# Type System Rules & Enforcement

**Status**: 🔒 **CRITICAL RULE** - Must be followed by all developers and AI agents
**Created**: 2026-02-04
**Applies To**: All TypeScript code in RevealUI monorepo

---

## Core Principle

**ALL types MUST come from the `@revealui/contracts` system. Inline types and ad-hoc type definitions are prohibited.**

This is not a guideline - it's a hard requirement enforced through code review and automated tooling.

---

## Rules

### ✅ Rule 1: Use Contract Types

**ALWAYS** import types from `@revealui/contracts` for any domain entity or configuration.

```typescript
// ✅ CORRECT - Using contract types
import type { CollectionMetadata, GlobalMetadata } from '@revealui/ai/tools/admin'
import type { ChatRequestContract } from '@revealui/contracts'

const collection: CollectionMetadata = {
  slug: 'posts',
  label: 'Posts',
  description: 'Blog posts collection',
}
```

```typescript
// ❌ WRONG - Inline type definitions
const collection: { slug: string; label?: string } = {
  slug: 'posts',
  label: 'Posts',
}
```

### ✅ Rule 2: Export and Reuse Types

If you need a type that doesn't exist in contracts, create it in the appropriate contracts module and export it.

```typescript
// ✅ CORRECT - Define in contracts/factory, export, then use
// packages/ai/src/tools/admin/factory.ts
export interface CollectionMetadata {
  slug: string
  label?: string
  description?: string
}

// apps/admin/src/app/api/chat/route.ts
import type { CollectionMetadata } from '@revealui/ai/tools/admin'
const meta: CollectionMetadata = {...}
```

```typescript
// ❌ WRONG - Define inline at usage site
// apps/admin/src/app/api/chat/route.ts
const meta: { slug: string; label?: string } = {...}
```

### ✅ Rule 3: No Inline Generic Parameters

Use proper type imports for generic parameters, including map/filter callbacks.

```typescript
// ✅ CORRECT - Explicit return type from contracts
collections?.map((c): CollectionMetadata => ({
  slug: String(c.slug),
  label: c.labels?.singular || String(c.slug),
}))
```

```typescript
// ❌ WRONG - Inline parameter type
collections?.map((c: { slug: string; label?: string }) => ({
  slug: String(c.slug),
  label: c.label,
}))
```

### ✅ Rule 4: Type Assertions Must Reference Contracts

When type assertions are necessary, assert to contract types, not inline types.

```typescript
// ✅ CORRECT - Assert to contract type
import type { AdminAPIClient } from '@revealui/ai/tools/admin'
apiClient as AdminAPIClient
```

```typescript
// ❌ WRONG - Explicit any
apiClient as any
```

### ✅ Rule 5: Function Signatures Must Use Contract Types

All function parameters and return types must reference contract types.

```typescript
// ✅ CORRECT
import type { CollectionMetadata } from '@revealui/ai/tools/admin'

function transformCollection(config: unknown): CollectionMetadata {
  return {
    slug: String((config as any).slug),
    label: (config as any).label,
  }
}
```

```typescript
// ❌ WRONG - Inline return type
function transformCollection(config: unknown): { slug: string; label?: string } {
  return {...}
}
```

---

## Contract Type Locations

### Core Contracts (`@revealui/contracts`)

- **Entities**: `@revealui/contracts` - User, Post, Page, Media, etc.
- **Admin Types**: `@revealui/contracts/admin` - CollectionConfig, GlobalConfig, Field
- **Database Types**: `@revealui/contracts` - Generated from database schema
- **API Contracts**: `@revealui/contracts` - Request/response schemas

### Package-Specific Types

When a type is specific to a package and doesn't represent a cross-cutting domain concept:

1. Define it in the package's types file
2. Export it from the package's index
3. Import it with the package namespace

Example:
```typescript
// packages/ai/src/tools/admin/factory.ts
export interface CollectionMetadata { ... }
export interface GlobalMetadata { ... }

// packages/ai/src/tools/admin/index.ts
export type { CollectionMetadata, GlobalMetadata } from './factory.js'

// Usage in other files
import type { CollectionMetadata } from '@revealui/ai/tools/admin'
```

---

## Enforcement

### Automated Checks

1. **ESLint Rule**: `@typescript-eslint/consistent-type-imports`
   - Enforces `import type` syntax
   - Catches missing type imports

2. **Biome Linter**: `noExplicitAny`
   - Prevents `any` types
   - Requires explicit types

3. **Custom ESLint Rule** (Planned): `revealui/no-inline-types`
   - Detects inline object types in annotations
   - Suggests contract type imports

### Manual Review Checklist

Before submitting a PR, verify:

- [ ] No inline object types (`{ prop: type }` in annotations)
- [ ] All types imported from `@revealui/contracts` or package exports
- [ ] No `any` types without explicit justification
- [ ] Function signatures reference contract types
- [ ] Map/filter callbacks use explicit return types

### Pre-commit Hook

The pre-commit hook runs:
```bash
pnpm biome check --write
```

This catches:
- Explicit `any` usage
- Import organization issues
- Unused variables

---

## AI Agent Instructions

**FOR ALL AI ASSISTANTS WORKING ON THIS CODEBASE:**

### 🚫 NEVER Do This:

1. ❌ Create inline types: `(x: { prop: string }) => ...`
2. ❌ Use `any` without importing proper types
3. ❌ Define types at usage sites instead of centralized locations
4. ❌ Skip importing types from contracts to "save time"

### ✅ ALWAYS Do This:

1. ✅ Check `@revealui/contracts` for existing types first
2. ✅ Import types: `import type { TypeName } from '@revealui/contracts'`
3. ✅ If type doesn't exist, create it in contracts and export
4. ✅ Use explicit return types in map/filter: `map((x): ReturnType => ...)`
5. ✅ Reference this document when making type-related changes

### Decision Tree for Type Fixes

```
Need a type?
├─ Does it exist in @revealui/contracts?
│  ├─ YES → Import and use it
│  └─ NO → Is it a cross-cutting domain type?
│     ├─ YES → Add to @revealui/contracts, export, then import
│     └─ NO → Is it package-specific?
│        ├─ YES → Add to package types, export from index, import
│        └─ NO → Reconsider if you really need this type
```

---

## Examples

### Example 1: Chat API with admin Tools

**Before (Incorrect):**
```typescript
// ❌ Inline types everywhere
const cmsTools = createAdminTools({
  apiClient: apiClient as any,
  collections: config.collections?.map((c: any) => ({
    slug: String(c.slug),
    label: c.label,
  })),
})
```

**After (Correct):**
```typescript
// ✅ Contract types imported and used
import type {
  AdminAPIClient,
  CollectionMetadata,
  GlobalMetadata,
} from '@revealui/ai/tools/admin'

const cmsTools = createAdminTools({
  apiClient: apiClient as AdminAPIClient,
  collections: config.collections?.map((c): CollectionMetadata => ({
    slug: String(c.slug),
    label: c.labels?.singular || String(c.slug),
    description: `Collection for ${c.labels?.singular || c.slug}`,
  })),
  globals: config.globals?.map((g): GlobalMetadata => ({
    slug: String(g.slug),
    label: (g.label as string | undefined) || String(g.slug),
    description: `Global configuration for ${g.label || g.slug}`,
  })),
})
```

### Example 2: Creating New Types

**Before (Incorrect):**
```typescript
// ❌ Type defined inline at usage
function processUser(user: { id: string; email: string; role?: string }) {
  // ...
}
```

**After (Correct):**
```typescript
// Step 1: Add to contracts or package types
// packages/ai/src/tools/admin/factory.ts
export interface UserContext {
  id: string
  email: string
  role?: string
}

// Step 2: Export from package index
// packages/ai/src/tools/admin/index.ts
export type { UserContext } from './factory.js'

// Step 3: Import and use
// some-other-file.ts
import type { UserContext } from '@revealui/ai/tools/admin'

function processUser(user: UserContext) {
  // ...
}
```

---

## Common Violations and Fixes

### Violation 1: Inline Callback Types

```typescript
// ❌ WRONG
items.map((item: { id: string }) => item.id)

// ✅ CORRECT
import type { Page } from '@revealui/contracts'
items.map((item: Page) => item.id)

// ✅ ALSO CORRECT - Explicit return type
items.map((item): string => item.id)
```

### Violation 2: Partial/Pick Without Contract Base

```typescript
// ❌ WRONG - Creating ad-hoc subset
type UserBasic = { id: string; email: string }

// ✅ CORRECT - Using Partial/Pick from contract
import type { User } from '@revealui/contracts'
type UserBasic = Pick<User, 'id' | 'email'>
```

### Violation 3: Config Types Not From Contracts

```typescript
// ❌ WRONG
interface SiteConfig {
  option1: string
  option2: boolean
}

// ✅ CORRECT - Define in contracts, export, import
// packages/contracts/src/entities/site.ts
export interface SiteSettings {
  option1: string
  option2: boolean
}

// Usage
import type { SiteSettings } from '@revealui/contracts/entities'
```

---

## Migration Guide

### For Existing Code

If you find code violating these rules:

1. **Identify the inline type**
2. **Check if equivalent contract type exists**
   - Search in `@revealui/contracts`
   - Search in package type exports
3. **If exists: Import and replace**
4. **If not exists: Create in appropriate location**
   - Domain types → `@revealui/contracts`
   - Package-specific → Package's type files
5. **Export and import properly**
6. **Test and commit**

### Automated Migration (Future)

Planned tooling:
- `pnpm ops migrate:inline-types` - Detect and suggest replacements
- ESLint auto-fix for simple cases
- Codemod for common patterns

---

## Exceptions

The ONLY acceptable exceptions (must be documented in code):

### 1. Third-party Library Integration

When interfacing with untyped third-party libraries where creating contracts would be excessive:

```typescript
// Acceptable - Third-party untyped data
const result = externalLib.getData() as unknown
// Document why: "External library returns untyped data, validated separately"
```

### 2. Temporary Development (Must be removed before PR)

During active development, inline types may be used temporarily but MUST be converted before commit:

```typescript
// TODO: Replace with contract type before commit
const temp: { id: string } = getTempData()
```

**These temporary inline types MUST NOT pass code review.**

---

## Benefits of This System

### Type Safety ✅
- Single source of truth for all types
- Compiler catches breaking changes across packages
- Runtime validation matches compile-time types

### Maintainability ✅
- Easy to find type definitions (always in contracts)
- Refactoring updates propagate automatically
- No duplicate type definitions scattered across codebase

### Documentation ✅
- Types serve as living documentation
- Contract definitions include examples and validation
- Clear API boundaries

### Onboarding ✅
- New developers know exactly where to find types
- Consistent patterns across codebase
- AI agents have clear rules to follow

---

## Related Documentation

- [Contracts System Overview](../packages/contracts/README.md)
- [Linting Rules](./LINTING_RULES.md)
- [Code Standards](./CODE_STANDARDS.md)
- [Contributing Guidelines](../CONTRIBUTING.md)

---

## Enforcement Status

- ✅ Linting rules configured (Biome)
- ✅ Pre-commit hooks active
- 🚧 Custom ESLint rule (planned)
- 🚧 Automated migration tool (planned)
- ✅ Code review checklist updated

---

**Last Updated**: 2026-02-04
**Enforced By**: All code reviews, automated tooling, CI/CD
**Questions**: See `CONTRIBUTING.md` or ask in #dev-standards
