# Path Aliases and Module Resolution Guide

This guide explains the path alias strategy used across the RevealUI monorepo for both TypeScript compilation (`tsconfig.json`) and test resolution (`vitest.config.ts`).

**Last Updated:** 2026-01-31

---

## Table of Contents

1. [Why Path Aliases?](#why-path-aliases)
2. [Monorepo Strategy](#monorepo-strategy)
3. [Configuration Patterns](#configuration-patterns)
4. [Synchronization Checklist](#synchronization-checklist)
5. [Common Patterns by Package Type](#common-patterns-by-package-type)
6. [Module Resolution Strategies](#module-resolution-strategies)
7. [Troubleshooting](#troubleshooting)
8. [Examples by Package](#examples-by-package)
9. [Best Practices](#best-practices)

---

## Why Path Aliases?

### Benefits

1. **Clean imports** - `import { foo } from '@/lib/foo'` vs `import { foo } from '../../../lib/foo'`
2. **Refactoring safety** - Moving files doesn't break imports
3. **Consistency** - Uniform import style across the codebase
4. **IntelliSense** - Better IDE autocomplete and navigation

### Trade-offs

- **Configuration overhead** - Must sync between tools
- **Learning curve** - New developers need to understand alias patterns
- **Build tool support** - Not all tools support all alias formats

## Monorepo Strategy

### Workspace Package References

**Preferred approach:** Use workspace protocol
```json
{
  "dependencies": {
    "@revealui/core": "workspace:*",
    "@revealui/contracts": "workspace:*"
  }
}
```

**Why?**
- pnpm handles resolution automatically
- No aliases needed in most cases
- Type checking works out of the box

### Internal Package Aliases

**When to use:** Within a package's source code

**Example:** `packages/services/tsconfig.json`
```json
{
  "compilerOptions": {
    "paths": {
      "services/*": ["./dist/*", "./src/*"]
    }
  }
}
```

## Configuration Patterns

### Pattern 1: Root Path Alias (`@`)

**Used in:** Apps (cms, web, dashboard)

**TypeScript (`tsconfig.json`):**
```json
{
  "compilerOptions": {
    "baseUrl": ".",
    "paths": {
      "@/*": ["./src/*"]
    }
  }
}
```

**Vitest (`vitest.config.ts`):**
```typescript
import path from 'node:path'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src')
    }
  }
})
```

**Usage:**
```typescript
// Instead of:
import { Button } from '../../../components/Button'

// Use:
import { Button } from '@/components/Button'
```

### Pattern 2: Package Name Alias

**Used in:** Packages with complex internal structure

**TypeScript (`tsconfig.json`):**
```json
{
  "compilerOptions": {
    "baseUrl": ".",
    "paths": {
      "services/*": ["./src/*"]
    }
  }
}
```

**Vitest (`vitest.config.ts`):**
```typescript
export default defineConfig({
  resolve: {
    alias: {
      'services': path.resolve(__dirname, './src')
    }
  }
})
```

**Usage:**
```typescript
import { stripeService } from 'services/core/stripe'
```

### Pattern 3: Workspace Cross-Package Aliases

**Used in:** Test files referencing other workspace packages

**Example:** `packages/core/vitest.config.ts`
```typescript
export default defineConfig({
  resolve: {
    alias: {
      '@revealui/contracts': path.resolve(__dirname, '../contracts/src')
    }
  }
})
```

**Why?**
- Vitest may not resolve workspace packages correctly in all cases
- Ensures tests can import from source (not dist)
- Faster test execution (no build step needed)

## Synchronization Checklist

When adding or modifying path aliases, update **both** files:

### 1. TypeScript Configuration
✅ Update `tsconfig.json` with `paths` mapping
✅ Verify IDE autocomplete works
✅ Run `pnpm typecheck` to confirm no errors

### 2. Vitest Configuration
✅ Update `vitest.config.ts` with `resolve.alias`
✅ Ensure paths match TypeScript config
✅ Run `pnpm test` to verify resolution

### 3. Documentation
✅ Update this document if introducing new patterns

## Common Patterns by Package Type

### Application (Next.js)

```typescript
// tsconfig.json
{
  "compilerOptions": {
    "baseUrl": ".",
    "paths": {
      "@/*": ["./src/*"],
      "@/components/*": ["./src/components/*"],
      "@/lib/*": ["./src/lib/*"]
    }
  }
}

// vitest.config.ts
{
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@/components': path.resolve(__dirname, './src/components'),
      '@/lib': path.resolve(__dirname, './src/lib')
    }
  }
}
```

### Library Package

```typescript
// tsconfig.json
{
  "compilerOptions": {
    "baseUrl": ".",
    "paths": {
      "package-name/*": ["./src/*"]
    }
  }
}

// vitest.config.ts (if tests exist)
{
  resolve: {
    alias: {
      'package-name': path.resolve(__dirname, './src')
    }
  }
}
```

## Module Resolution Strategies

### TypeScript Module Resolution

**Base tsconfig.json:** `moduleResolution: "NodeNext"`
- Used for Node.js scripts at monorepo root
- Follows Node.js ESM resolution rules

**Frontend packages:** `moduleResolution: "bundler"`
- Used for Vite, Next.js bundled packages
- Allows extensionless imports
- Supports path mapping

**Why different?**
- Monorepo has both Node.js scripts and bundled apps
- Each needs appropriate resolution strategy
- Documented in `packages/dev/src/ts/base.json`

### Vitest Resolution

Vitest uses Vite's resolver which:
- Supports `resolve.alias` configuration
- Respects `tsconfig.json` paths (with limitations)
- May need explicit aliases for workspace packages

## Troubleshooting

### Issue: "Cannot find module '@/foo'"

**TypeScript error:**
1. Check `tsconfig.json` has correct `paths` mapping
2. Verify `baseUrl` is set correctly
3. Restart TypeScript server in IDE

**Vitest error:**
1. Check `vitest.config.ts` has matching `resolve.alias`
2. Ensure path is resolved correctly with `path.resolve()`
3. Verify file exists at resolved path

### Issue: Alias works in TypeScript but not in Vitest

**Solution:** Add explicit alias to `vitest.config.ts`

```typescript
// vitest.config.ts
export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      // Add any missing aliases from tsconfig.json
    }
  }
})
```

### Issue: Circular dependencies with aliases

**Symptoms:**
- Build succeeds but runtime errors
- Tests pass individually but fail together

**Solution:**
- Review import graph
- Break circular dependencies at source level
- Don't rely on aliases to "fix" circular imports

## Examples by Package

### `packages/core`

**tsconfig.json:**
```json
{
  "compilerOptions": {
    "baseUrl": "."
    // No custom paths - uses workspace protocol
  }
}
```

**vitest.config.ts:**
```typescript
{
  resolve: {
    alias: {
      // Test-only alias to reference contracts source
      '@revealui/contracts': path.resolve(__dirname, '../contracts/src')
    }
  }
}
```

### `packages/services`

**tsconfig.json:**
```json
{
  "compilerOptions": {
    "paths": {
      "services/*": ["./dist/*", "./src/*"]
    }
  }
}
```

**vitest.config.ts:**
```typescript
{
  resolve: {
    alias: {
      'services': path.resolve(__dirname, './src'),
      // Test utilities alias
      'services/stripeTestUtils': path.resolve(
        __dirname,
        './src/core/stripe/stripeClient.test-utils.ts'
      )
    }
  }
}
```

### `apps/cms`

**tsconfig.json:**
```json
{
  "compilerOptions": {
    "baseUrl": ".",
    "paths": {
      "@/*": ["./src/*"]
    }
  }
}
```

**vitest.config.ts:**
```typescript
{
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src')
    }
  }
}
```

## Best Practices

### DO ✅

1. **Keep aliases simple** - `@/foo` is better than `@components/ui/Button`
2. **Match TypeScript and Vitest** - Aliases should be identical
3. **Use absolute paths** - `path.resolve(__dirname, './src')` not `'./src'`
4. **Document package-specific aliases** - Comment why non-standard aliases exist
5. **Prefer workspace protocol** - For inter-package imports

### DON'T ❌

1. **Create too many aliases** - Diminishing returns on maintainability
2. **Use aliases for external packages** - Let package manager handle it
3. **Forget to sync configs** - TypeScript and Vitest must match
4. **Mix resolution strategies** - Stick to one pattern per package type

### Maintenance

**When Adding New Aliases:**

1. **Consider necessity** - Does the alias solve a real problem?
2. **Update both configs** - TypeScript and Vitest
3. **Test thoroughly** - Build, typecheck, and test
4. **Document** - Add to this guide if pattern is new

**Regular Reviews:**

**Frequency:** Quarterly

**Checklist:**
- [ ] Are all aliases still used?
- [ ] Can any be simplified?
- [ ] Are configs in sync?
- [ ] Any new patterns to document?

### Migration Guide

**From Relative Imports to Aliases:**

**Before:**
```typescript
// src/app/dashboard/components/Widget.tsx
import { getUser } from '../../../lib/auth'
import { Button } from '../../../components/ui/Button'
```

**After:**
```typescript
// src/app/dashboard/components/Widget.tsx
import { getUser } from '@/lib/auth'
import { Button } from '@/components/ui/Button'
```

**Steps:**
1. Add alias configuration (TypeScript + Vitest)
2. Run find/replace with caution (test imports first)
3. Verify typecheck passes
4. Run full test suite

**From Aliases to Workspace Protocol:**

**Before:**
```typescript
// In a package, using alias
import { Contract } from '@revealui/contracts/src/types'
```

**After:**
```typescript
// Using proper package export
import { Contract } from '@revealui/contracts'
```

**Steps:**
1. Ensure target package has proper `exports` in package.json
2. Update imports to use package name
3. Remove unnecessary aliases
4. Rebuild and test

---

## Related Documentation

- [Development Overview](./README.md) - Development navigation hub
- [CI Environment](./CI_ENVIRONMENT.md) - CI/CD environment specifications
- [TypeScript Migration](./TYPESCRIPT_MIGRATION.md) - TypeScript strict mode guide
- [Master Index](../INDEX.md) - Complete documentation index

---

**Last Updated:** 2026-01-31
**Part of:** Development Guide consolidation
