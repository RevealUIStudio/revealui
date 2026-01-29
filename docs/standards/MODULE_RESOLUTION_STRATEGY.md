# Module Resolution Strategy for RevealUI Monorepo

## Overview

This document explains the module resolution strategy for the RevealUI monorepo, specifically how TypeScript and Next.js/Turbopack resolve workspace packages and why certain decisions were made.

## Problem Statement

In a monorepo with Next.js 16 and Turbopack, there's a fundamental tension between:
- **TypeScript's type checking** (which prefers source files via `tsconfig.json` paths)
- **Turbopack's runtime resolution** (which works best with `package.json` exports pointing to compiled `dist` files)
- **Development experience** (want to use source files during development for better error messages)

## Core Strategy

### 1. Package.json Exports (Primary Resolution Mechanism)

**For runtime/Turbopack:** All workspace packages define `exports` in their `package.json` that point to compiled `dist/` files:

```json
{
  "exports": {
    ".": {
      "types": "./dist/index.d.ts",
      "import": "./dist/index.js"
    },
    "./server": {
      "types": "./dist/server/index.d.ts",
      "import": "./dist/server/index.js"
    }
  }
}
```

**Why:** Turbopack respects `package.json` exports and uses them for runtime module resolution. The compiled `dist/` files have relative imports already resolved, preventing errors like "Can't resolve './storage/index.js'".

### 2. TypeScript Path Mappings (For Type Checking Only)

**For TypeScript type checking:** `apps/cms/tsconfig.json` uses path mappings that point to **source files** (not `dist/`):

```json
{
  "compilerOptions": {
    "paths": {
      "@revealui/auth/server": ["../../packages/auth/src/server/index.ts"],
      "@revealui/core/*": ["../../packages/core/src/*"],
      "@revealui/db/*": ["../../packages/db/src/*"]
    }
  }
}
```

**Why:** 
- Source files provide better type information and error messages
- TypeScript doesn't care about runtime resolution—it just needs types
- Allows type checking without requiring a full build

### 3. TranspilePackages (Bridge Between Source and Runtime)

**In `apps/cms/next.config.mjs`:**

```javascript
transpilePackages: ['@revealui/core', '@revealui/db', '@revealui/contracts', '@revealui/auth', '@revealui/config']
```

**Why:** This tells Next.js:
- Transpile source files during development (uses `tsconfig.json` paths)
- Use `package.json` exports for module resolution (uses compiled `dist/` files)
- Ensures relative imports resolve correctly in the transpiled output

## Resolution Flow

### During Development (Next.js Dev Server with Turbopack)

1. **Import:** `import { getSession } from '@revealui/auth/server'`
2. **TypeScript checks types:** Uses `tsconfig.json` path → `../../packages/auth/src/server/index.ts` (source)
3. **Turbopack resolves runtime:** 
   - Checks `tsconfig.json` paths first (for entry point)
   - Falls back to `package.json` exports → `./dist/server/index.js` (compiled)
   - With `transpilePackages`, transpiles source but uses `dist` for resolution

### During Build

1. **TypeScript compilation:** Uses source files via path mappings
2. **Next.js bundling:** Uses `package.json` exports (pointing to `dist/` files)
3. **Relative imports:** Already resolved in compiled `dist/` files

## Rules and Conventions

### ✅ DO

1. **Define `exports` in `package.json`** for all workspace packages
   ```json
   {
     "exports": {
       ".": {
         "types": "./dist/index.d.ts",
         "import": "./dist/index.js"
       },
       "./subpath": {
         "types": "./dist/subpath/index.d.ts",
         "import": "./dist/subpath/index.js"
       }
     }
   }
   ```

2. **Use source file paths in `tsconfig.json`** for TypeScript type checking
   ```json
   {
     "paths": {
       "@revealui/auth/server": ["../../packages/auth/src/server/index.ts"]
     }
   }
   ```

3. **List packages in `transpilePackages`** in `next.config.mjs`
   ```javascript
   transpilePackages: ['@revealui/core', '@revealui/db', '@revealui/contracts', '@revealui/auth']
   ```

4. **Keep main package entry points without `tsconfig.json` paths** to force Turbopack to use `package.json` exports
   ```json
   // ✅ GOOD: No tsconfig path for main export
   // "@revealui/core": ["../../packages/core/src/index.ts"], // REMOVED
   // TypeScript uses package.json exports, Turbopack uses package.json exports
   ```

### ❌ DON'T

1. **Don't point `tsconfig.json` paths to `dist/` files** (except for special cases like `@revealui/auth` subpaths that had specific issues)
   ```json
   // ❌ BAD: Points to dist files
   "@revealui/auth/server": ["../../packages/auth/dist/server/index.d.ts"]
   ```

2. **Don't add explicit `resolveAlias` in `turbopack` config for workspace packages**
   ```javascript
   // ❌ BAD: Explicit alias for workspace package
   resolveAlias: {
     '@revealui/core': path.resolve(__dirname, '../packages/core')
   }
   ```

3. **Don't use wildcard `tsconfig.json` paths for main package exports** (prevents Turbopack from using `package.json` exports)
   ```json
   // ❌ BAD: Wildcard path for main export
   "@revealui/core": ["../../packages/core/src/index.ts"],
   "@revealui/core/*": ["../../packages/core/src/*"] // Conflicts with main export resolution
   ```

## Common Patterns

### Pattern 1: Package with Main Export

**Package:** `@revealui/core`
- **Has main export:** `"."` in `package.json` exports
- **No `tsconfig.json` path** for main export (forces use of `package.json` exports)
- **Has `tsconfig.json` paths** for subpaths (e.g., `@revealui/core/utils/*`)

### Pattern 2: Package with Only Subpath Exports

**Package:** `@revealui/auth`
- **No main export:** Only `./server`, `./client`, `./react` in `package.json` exports
- **Has `tsconfig.json` paths** for each subpath pointing to source files

### Pattern 3: Package Needing Specific Subpath Type Resolution

**Package:** `@revealui/contracts` (schema merged into contracts)
- **Has main export** but also specific subpaths like `./cms`, `./entities`, `./agents`
- **No `tsconfig.json` path** for main export (use package.json exports)
- **Has specific `tsconfig.json` path** for subpaths if needed (needed for TypeScript type inference)

## Troubleshooting

### Error: "Module not found: Can't resolve './storage/index.js'"

**Cause:** Turbopack is resolving to source files via `tsconfig.json` paths, but source files have relative imports that aren't resolved yet.

**Solution:**
1. Ensure `transpilePackages` includes the package
2. Remove `tsconfig.json` path for main package entry (force use of `package.json` exports)
3. Verify `package.json` exports point to `dist/` files

### Error: "Cannot find module '@revealui/auth/server'"

**Cause:** TypeScript can't resolve the module for type checking.

**Solution:**
1. Add specific `tsconfig.json` path for the subpath:
   ```json
   "@revealui/auth/server": ["../../packages/auth/src/server/index.ts"]
   ```
2. Verify the package is in dependencies and the export exists

### Error: "Cyclic dependency detected"

**Cause:** Packages depend on each other in a circular manner.

**Solution:**
1. Break the cycle by removing dependencies (use local implementations instead of imports)
2. Use type-only imports where possible
3. Restructure packages to eliminate circular dependencies

## Best Practices

1. **Always build packages before type checking** (ensures `dist/` files exist)
   ```bash
   pnpm --filter @revealui/auth build
   pnpm typecheck
   ```

2. **Keep `package.json` exports in sync with actual file structure**

3. **Test module resolution in both development and build modes**

4. **Document any special cases** (like why a particular path mapping exists)

## References

- [Next.js TranspilePackages Documentation](https://nextjs.org/docs/app/api-reference/next-config-js/transpilePackages)
- [TypeScript Path Mapping](https://www.typescriptlang.org/docs/handbook/modules/reference.html#path-mapping)
- [Package.json Exports Field](https://nodejs.org/api/packages.html#exports)
