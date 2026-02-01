# Code Style & Formatting Standards

This document describes the code style, linting, and formatting standards for the RevealUI monorepo, including best practices for ensuring LLMs generate consistent code.

---

## Table of Contents

- [Overview](#overview)
- [Tooling](#tooling)
  - [ESLint Configuration](#eslint-configuration)
  - [Biome Configuration](#biome-configuration)
- [Commands](#commands)
- [Style Rules](#style-rules)
- [LLM Code Style Enforcement](#llm-code-style-enforcement)
  - [Best Practices](#best-practices)
  - [Advanced Techniques](#advanced-techniques)
- [Loop and Iteration Patterns](#loop-and-iteration-patterns)
- [Pre-Commit Guidelines](#pre-commit-guidelines)
- [CI/CD Integration](#cicd-integration)
- [Troubleshooting](#troubleshooting)

---

## Overview

The project uses **ESLint for type-aware linting** and **Biome for formatting + fast linting**. This separation provides:

- **ESLint**: Type-aware TypeScript rules that catch type safety issues
- **Biome**: Fast formatting and style rules that don't require type information

**Philosophy**: Simple, consistent code style that works across the entire monorepo.

---

## Tooling

### ESLint Configuration

#### Shared Config

Each package/app owns its `eslint.config.js` (or `eslint.config.mjs` if it is not ESM) and composes the shared config from `packages/dev`:

```javascript
// eslint.config.js
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { baseConfig, createTypeCheckedConfig } from 'dev/eslint'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

export default [
  ...baseConfig,
  createTypeCheckedConfig({ tsconfigRootDir: __dirname }),
]
```

For Next.js apps, add the Next plugin rules:

```javascript
import next from '@next/eslint-plugin-next'

const nextFiles = [
  'src/**/*.{ts,tsx,js,jsx}',
  'app/**/*.{ts,tsx,js,jsx}',
  'pages/**/*.{ts,tsx,js,jsx}',
]

export default [
  ...baseConfig,
  createTypeCheckedConfig({ tsconfigRootDir: __dirname }),
  {
    ...next.configs['core-web-vitals'],
    files: nextFiles,
  },
]
```

#### What ESLint Checks

ESLint focuses on **type-aware TypeScript rules** that require type information:

- `@typescript-eslint/no-explicit-any`: Prevents `any` types
- `@typescript-eslint/no-unsafe-*`: Catches unsafe type operations
- Additional type-safe rules from the `recommended-type-checked` preset

#### Config Files

Config files are excluded from type-aware linting (they use basic syntax-only rules):
- `**/*.config.*`
- `**/eslint.config.*`
- `**/vite.config.*`
- `**/next.config.*`

### Biome Configuration

#### What Biome Handles

- **Formatting**: All code formatting (quotes, semicolons, indentation)
- **Style Rules**: Code style checks (use const, use template, etc.)
- **Accessibility**: a11y rules
- **Performance**: Performance-related linting
- **Security**: Security-related linting

#### Biome Rules

See `biome.json` in the root for full configuration. Key settings:

- **Module System**: ESM (ES Modules) - use `import`/`export`, NOT CommonJS
- **Quotes**: Single for strings, double for JSX
- **Semicolons**: `asNeeded` (only when required)
- **Line Width**: 100 characters
- **Indentation**: 2 spaces
- **Trailing Commas**: ES6 style
- **Arrow Functions**: Always parentheses around params

---

## Commands

### Running Linting

**From root** (lints all packages):
```bash
pnpm lint
```

**Biome-only in a specific package**:
```bash
cd apps/cms
pnpm lint
```

**ESLint in a specific package/app**:
```bash
pnpm --filter <pkg> lint:eslint
```

### Formatting

**Biome handles ALL formatting**. Do not use ESLint's `--fix` flag.

**Format all files**:
```bash
pnpm format
```

**Format and lint fix** (Biome formatting + lint fixes):
```bash
pnpm lint:fix
```

**ESLint fixes** (type-aware lint fixes):
```bash
pnpm lint:eslint:fix
```

### Standardized Commands

The repo standardizes on a single ESLint command from the root (Turbo runs per-package `lint:eslint` scripts):

```bash
pnpm lint:eslint
```

---

## Style Rules

### Module System

RevealUI uses **ESM (ES Modules)** exclusively - use `import`/`export`, NOT CommonJS.

✅ **Correct (ESM)**:
```typescript
import { useState } from 'react'
import { Button } from '@/components/Button'

export function Component() {
  return <Button />
}
```

❌ **Incorrect (CommonJS)**:
```typescript
const { useState } = require('react')
const { Button } = require('@/components/Button')

module.exports = { Component }
```

### Formatting Rules

Based on `biome.json`:
- **Quotes**: Single for strings, double for JSX
- **Semicolons**: As needed (omitted when possible)
- **Indent**: 2 spaces
- **Line Width**: 100 characters
- **Trailing Commas**: ES6 style
- **Arrow Functions**: Always parentheses around params

### Quick Reference

```bash
# Format code
pnpm format

# Lint code
pnpm lint

# Type check
pnpm typecheck

# All checks
pnpm format && pnpm lint && pnpm typecheck
```

---

## LLM Code Style Enforcement

### Best Practices

Your project uses a multi-layered approach to enforce code style:
1. **Biome** - Fast formatter and linter (30x faster than Prettier)
2. **ESLint** - Advanced TypeScript/React rules
3. **TypeScript** - Strict type checking
4. **`.cursorrules`** - LLM-specific instructions

#### 1. Comprehensive `.cursorrules` File

The `.cursorrules` file is your primary tool for LLM code style enforcement. It should include:

##### Include Specific Formatting Rules
```markdown
### Formatting Rules
- Use single quotes for strings
- Omit semicolons when not required
- 2 spaces indentation
- Max line width: 100 characters
```

##### Provide Code Examples
Show correct patterns, not just rules:
```typescript
// ✅ Correct
export function Component({ prop }: Props) {
  return <div>{prop}</div>
}

// ❌ Incorrect
export default function Component(props: any) {
  return <div>{props.prop}</div>;
}
```

##### Document Anti-Patterns
Explicitly list what NOT to do:
- ❌ Don't use `any` type
- ❌ Don't use default exports
- ❌ Don't add unnecessary semicolons

##### Reference Your Tools
Mention your tooling so the LLM knows what to align with:
```markdown
### Formatting Rules (Biome Configuration)
- Configured in `biome.json`
- Run `pnpm format` to auto-format
```

#### 2. Keep Configuration Files in Sync

Ensure your `.cursorrules` matches your actual tooling:

| Tool | Config File | Command |
|------|-------------|---------|
| Biome | `biome.json` | `pnpm format` |
| ESLint | `eslint.config.js` | `pnpm lint` |
| TypeScript | `tsconfig.json` | `pnpm typecheck:all` |

**Action**: When you update `biome.json`, update `.cursorrules` too.

#### 3. Use Concrete Examples

Abstract rules are less effective than concrete examples:

##### ❌ Less Effective
```markdown
- Use proper TypeScript types
```

##### ✅ More Effective
```markdown
### TypeScript Types
- Use explicit types for function parameters
- Prefer `interface` over `type` for object shapes
- Use `unknown` instead of `any` when type is truly unknown

Example:
```typescript
interface User {
  id: string
  name: string
}

function getUser(id: string): Promise<User> {
  // ...
}
```
```

#### 4. Document Project-Specific Patterns

Your project has specific patterns that should be documented:

```markdown
### Next.js 16 Patterns
- `params` and `searchParams` are Promises - always await them
- Use `export const dynamic = "force-dynamic"` for dynamic routes

Example:
```typescript
export default async function Page({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  // ...
}
```
```

#### 5. Reference File Structure

Help the LLM understand where code belongs:

```markdown
### File Organization
- Components: `apps/web/src/components/`
- Utilities: `apps/web/src/lib/`
- Types: `packages/core/src/types/`
- Collections: `apps/cms/src/lib/collections/`
```

#### 6. Add Validation Commands

Include commands the LLM should run after making changes:

```markdown
## When Making Changes
1. Ensure TypeScript compiles: `pnpm typecheck:all`
2. Run formatter: `pnpm format`
3. Run linter: `pnpm lint`
4. Verify build: `pnpm build`
```

### Advanced Techniques

#### 1. Use Pre-commit Hooks

Automatically format code before commits.

#### 2. Add Style Check to CI/CD

Your CI already checks linting. Consider adding:

```yaml
- name: Check formatting
  run: pnpm biome check --write --formatted .
```

#### 3. Create Style Examples File

Create a `STYLE-EXAMPLES.md` with common patterns:

```markdown
# Style Examples

## React Component
```typescript
interface Props {
  title: string
}

export function Component({ title }: Props) {
  return <h1>{title}</h1>
}
```

## API Route Handler
```typescript
export async function GET(req: NextRequest) {
  // ...
}
```
```

#### 4. Use TypeScript Strict Mode

Your project already uses strict mode. This helps catch style issues:

```json
{
  "compilerOptions": {
    "strict": true,
    "noImplicitAny": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true
  }
}
```

### Testing Your Setup

#### Verify LLM Follows Style

1. Ask the LLM to create a new component
2. Check if it matches your style:
   - ✅ Uses ESM (`import`/`export`), not CommonJS?
   - ✅ Uses single quotes?
   - ✅ No unnecessary semicolons?
   - ✅ Proper TypeScript types?
   - ✅ Named exports?

#### Iterate on `.cursorrules`

If the LLM generates code that doesn't match your style:
1. Add the specific pattern to `.cursorrules`
2. Include both correct and incorrect examples
3. Be more explicit about the rule

---

## Loop and Iteration Patterns

### When to Use `for...of` vs `.forEach()`

This section provides specific guidance on loops and iteration, which is especially important for LLM code generation.

#### Use `for...of` when:

1. **You need `await` (sequential async operations)**
   ```typescript
   // ✅ CORRECT - for...of handles await properly
   for (const field of fields) {
     await processField(field) // Waits for each field sequentially
   }

   // ❌ WRONG - forEach doesn't wait, fires all promises in parallel
   fields.forEach(async (field) => {
     await processField(field) // All promises fire at once!
   })
   ```

2. **You need early termination (`break` or `continue`)**
   ```typescript
   // ✅ CORRECT - can use continue/break
   for (const item of items) {
     if (shouldSkip(item)) continue
     if (shouldStop(item)) break
     process(item)
   }

   // ❌ WRONG - forEach doesn't support break/continue
   items.forEach((item) => {
     if (shouldSkip(item)) return // can't use continue
     // No way to break early
   })
   ```

3. **You need index or other control flow**
   ```typescript
   // ✅ CORRECT - can access index if needed
   for (const [index, item] of items.entries()) {
     if (index === 0) continue
     process(item)
   }
   ```

#### Use `.forEach()` when:

1. **Side effects without await (parallel async is fine)**
   ```typescript
   // ✅ CORRECT - pushing promises into array for Promise.all()
   const promises: Promise<void>[] = []
   fields.forEach((field) => {
     promises.push(processField(field)) // Fire all promises
   })
   await Promise.all(promises) // Wait for all at once
   ```

2. **Simple iteration without control flow needs**
   ```typescript
   // ✅ CORRECT - simple side effect
   items.forEach((item) => {
     console.log(item)
   })
   ```

3. **Functional style preference (when no async/control flow)**
   ```typescript
   // ✅ CORRECT - functional style for simple operations
   Object.entries(sort).forEach(([key, direction]) => {
     sortConditions.push(`"${key}" ${direction === '-1' ? 'DESC' : 'ASC'}`)
   })
   ```

#### Use `.map()`, `.filter()`, `.reduce()` when:

1. **Transforming arrays**
   ```typescript
   // ✅ CORRECT - map for transformation
   const names = users.map((user) => user.name)
   ```

2. **Filtering arrays**
   ```typescript
   // ✅ CORRECT - filter for filtering
   const adults = users.filter((user) => user.age >= 18)
   ```

3. **Accumulating values**
   ```typescript
   // ✅ CORRECT - reduce for accumulation
   const total = numbers.reduce((sum, num) => sum + num, 0)
   ```

### Recommended Default: `for...of`

**Reasoning:**
1. Works correctly with `await`
2. Supports `break`/`continue`
3. More performant than `forEach` in most cases
4. Clearer intent for sequential processing

### Common Refactoring Patterns

#### Before (Problematic):
```typescript
// ❌ WRONG - forEach with async
fields.forEach(async (field) => {
  await processField(field)
})
```

#### After (Correct):
```typescript
// ✅ CORRECT - for...of with await
for (const field of fields) {
  await processField(field)
}
```

#### Or (If Parallel is Desired):
```typescript
// ✅ CORRECT - map for parallel execution
const promises = fields.map((field) => processField(field))
await Promise.all(promises)
```

### Enforcement with Linting

Add to your ESLint config to catch common mistakes:

```json
{
  "rules": {
    "prefer-for-of": "error",
    "no-await-in-loop": "off",
    "no-restricted-syntax": [
      "error",
      {
        "selector": "CallExpression[callee.property.name='forEach'][arguments.0.params.length=2]",
        "message": "Avoid forEach with async/await. Use for...of instead."
      }
    ]
  }
}
```

---

## Pre-Commit Guidelines

Before committing:

1. **Format code**: `pnpm format` or `pnpm lint:fix`
2. **Run linting**: `pnpm lint`
3. **Fix any errors**: ESLint and Biome will report issues

---

## CI/CD Integration

The CI pipeline runs:

1. **Biome**: `pnpm lint:biome` (checks formatting and Biome linting)
2. **ESLint**: `pnpm lint:eslint` (type-aware checks for apps/packages source)

Both must pass for CI to succeed.

---

## Troubleshooting

### ESLint "Cannot find module 'dev/eslint'"

Ensure `dev` workspace package is installed:
```bash
pnpm install
```

### Type-aware rules not working

Ensure your package has a `tsconfig.json` and files are included in the `include` array.

### Formatting conflicts

Never use `eslint --fix`. Always use `biome format --write .` for formatting.

### Cache issues

Clear ESLint cache:
```bash
rm -rf .eslintcache
```

Clear Biome cache:
```bash
rm -rf node_modules/.cache/biome
```

### LLM Generates Wrong Style

1. **Check `.cursorrules`** - Is the rule documented?
2. **Add examples** - Concrete examples work better than abstract rules
3. **Be explicit** - "Use single quotes" is better than "follow style guide"
4. **Reference config** - Point to `biome.json` for formatting rules

### Inconsistent Formatting

1. Run `pnpm format` to auto-fix
2. Update `.cursorrules` with the specific pattern
3. Consider adding a pre-commit hook

### TypeScript Errors

1. Ensure strict mode is enabled
2. Document type patterns in `.cursorrules`
3. Provide type examples for common cases

---

## Package-Specific Notes

### Apps

- Use local `eslint.config.js`/`eslint.config.mjs` plus the shared `dev/eslint` config
- Next apps add `@next/eslint-plugin-next` rules (core web vitals)

### Packages

- Use the `lint:eslint` script (`eslint .`)
- Extend shared config from `dev/eslint`
- Package-specific ignores in local `eslint.config.*`

---

## Best Practices

1. **Always run `pnpm format` before committing**
2. **Fix linting errors before pushing**
3. **Don't disable rules without justification**
4. **Keep ignore patterns minimal** (prefer fixing issues over ignoring)

---

## Summary

The best way to enforce code style with LLMs:

1. ✅ **Comprehensive `.cursorrules`** with specific rules and examples
2. ✅ **Keep it in sync** with your actual tooling (Biome, ESLint)
3. ✅ **Use concrete examples** instead of abstract rules
4. ✅ **Document anti-patterns** explicitly
5. ✅ **Reference your config files** (biome.json, eslint.config.js)
6. ✅ **Add validation commands** the LLM should run
7. ✅ **Use pre-commit hooks** for automatic formatting
8. ✅ **Iterate and improve** based on what the LLM generates

---

## Migration Notes

**Changed from**: Previously, some packages used `biome lint .` for linting.

**Changed to**: Each package/app owns an `eslint.config.*` and a `lint:eslint` script; the root `pnpm lint:eslint` runs them via Turbo.

**Formatting**: Biome still handles all formatting (unchanged).

---

---

## Module Resolution

### Overview

This section explains the module resolution strategy for the RevealUI monorepo, specifically how TypeScript and Next.js/Turbopack resolve workspace packages and why certain decisions were made.

### Problem Statement

In a monorepo with Next.js 16 and Turbopack, there's a fundamental tension between:
- **TypeScript's type checking** (which prefers source files via `tsconfig.json` paths)
- **Turbopack's runtime resolution** (which works best with `package.json` exports pointing to compiled `dist` files)
- **Development experience** (want to use source files during development for better error messages)

### Core Strategy

#### 1. Package.json Exports (Primary Resolution Mechanism)

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

#### 2. TypeScript Path Mappings (For Type Checking Only)

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

#### 3. TranspilePackages (Bridge Between Source and Runtime)

**In `apps/cms/next.config.mjs`:**

```javascript
transpilePackages: ['@revealui/core', '@revealui/db', '@revealui/contracts', '@revealui/auth', '@revealui/config']
```

**Why:** This tells Next.js:
- Transpile source files during development (uses `tsconfig.json` paths)
- Use `package.json` exports for module resolution (uses compiled `dist/` files)
- Ensures relative imports resolve correctly in the transpiled output

### Resolution Flow

#### During Development (Next.js Dev Server with Turbopack)

1. **Import:** `import { getSession } from '@revealui/auth/server'`
2. **TypeScript checks types:** Uses `tsconfig.json` path → `../../packages/auth/src/server/index.ts` (source)
3. **Turbopack resolves runtime:**
   - Checks `tsconfig.json` paths first (for entry point)
   - Falls back to `package.json` exports → `./dist/server/index.js` (compiled)
   - With `transpilePackages`, transpiles source but uses `dist` for resolution

#### During Build

1. **TypeScript compilation:** Uses source files via path mappings
2. **Next.js bundling:** Uses `package.json` exports (pointing to `dist/` files)
3. **Relative imports:** Already resolved in compiled `dist/` files

### Rules and Conventions

#### ✅ DO

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

#### ❌ DON'T

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

### Common Patterns

#### Pattern 1: Package with Main Export

**Package:** `@revealui/core`
- **Has main export:** `"."` in `package.json` exports
- **No `tsconfig.json` path** for main export (forces use of `package.json` exports)
- **Has `tsconfig.json` paths** for subpaths (e.g., `@revealui/core/utils/*`)

#### Pattern 2: Package with Only Subpath Exports

**Package:** `@revealui/auth`
- **No main export:** Only `./server`, `./client`, `./react` in `package.json` exports
- **Has `tsconfig.json` paths** for each subpath pointing to source files

#### Pattern 3: Package Needing Specific Subpath Type Resolution

**Package:** `@revealui/contracts` (schema merged into contracts)
- **Has main export** but also specific subpaths like `./cms`, `./entities`, `./agents`
- **No `tsconfig.json` path** for main export (use package.json exports)
- **Has specific `tsconfig.json` path** for subpaths if needed (needed for TypeScript type inference)

### Troubleshooting

#### Error: "Module not found: Can't resolve './storage/index.js'"

**Cause:** Turbopack is resolving to source files via `tsconfig.json` paths, but source files have relative imports that aren't resolved yet.

**Solution:**
1. Ensure `transpilePackages` includes the package
2. Remove `tsconfig.json` path for main package entry (force use of `package.json` exports)
3. Verify `package.json` exports point to `dist/` files

#### Error: "Cannot find module '@revealui/auth/server'"

**Cause:** TypeScript can't resolve the module for type checking.

**Solution:**
1. Add specific `tsconfig.json` path for the subpath:
   ```json
   "@revealui/auth/server": ["../../packages/auth/src/server/index.ts"]
   ```
2. Verify the package is in dependencies and the export exists

#### Error: "Cyclic dependency detected"

**Cause:** Packages depend on each other in a circular manner.

**Solution:**
1. Break the cycle by removing dependencies (use local implementations instead of imports)
2. Use type-only imports where possible
3. Restructure packages to eliminate circular dependencies

### Module Resolution Best Practices

1. **Always build packages before type checking** (ensures `dist/` files exist)
   ```bash
   pnpm --filter @revealui/auth build
   pnpm typecheck
   ```

2. **Keep `package.json` exports in sync with actual file structure**

3. **Test module resolution in both development and build modes**

4. **Document any special cases** (like why a particular path mapping exists)

### Module Resolution References

- [Next.js TranspilePackages Documentation](https://nextjs.org/docs/app/api-reference/next-config-js/transpilePackages)
- [TypeScript Path Mapping](https://www.typescriptlang.org/docs/handbook/modules/reference.html#path-mapping)
- [Package.json Exports Field](https://nodejs.org/api/packages.html#exports)

---

## Related Documentation

- [OBSERVABILITY.md](./OBSERVABILITY.md) - Error handling and logging standards
- [DOCUMENTATION_STANDARDS.md](./DOCUMENTATION_STANDARDS.md) - Documentation guidelines
- [Package Conventions](../../packages/PACKAGE-CONVENTIONS.md) - Package structure and conventions
- [Testing Strategy](../testing/TESTING_STRATEGY.md) - Testing requirements
- [ESLint Config](../../packages/dev/src/eslint/eslint.config.js) - Shared ESLint configuration
- [Biome Config](../../biome.json) - Biome configuration


---


# Observability: Error Handling & Logging

This document outlines error handling and logging strategies for RevealUI Framework, providing comprehensive guidance on observability practices.

---

## Table of Contents

- [Overview](#overview)
- [Logging Strategy](#logging-strategy)
  - [Basic Usage](#basic-usage)
  - [Log Levels](#log-levels)
  - [Configuration](#configuration)
  - [Best Practices](#logging-best-practices)
- [Error Handling](#error-handling)
  - [Error Handling Patterns](#error-handling-patterns)
  - [Error Types](#error-types)
  - [Error Response Format](#error-response-format)
  - [Best Practices](#error-handling-best-practices)
- [Error Monitoring](#error-monitoring)
- [Testing](#testing)
- [Future Enhancements](#future-enhancements)

---

## Overview

RevealUI uses consistent observability patterns across all packages:
- Standardized error types
- Structured logging with configurable log levels
- Proper error propagation
- User-friendly error messages
- Error logging integration
- Error monitoring integration

---

## Logging Strategy

### Basic Usage

```typescript
import { logger } from '@revealui/core/utils/logger'

// Info log
logger.info('User logged in', { userId: '123', email: 'user@example.com' })

// Warning log
logger.warn('Rate limit approaching', { userId: '123', requests: 95 })

// Error log
logger.error('Failed to save document', {
  documentId: '456',
  error: error.message
})

// Debug log (only in development)
logger.debug('Cache hit', { key: 'user:123' })
```

### Creating Custom Logger

```typescript
import { createLogger } from '@revealui/core/utils/logger'

// Create logger with custom log level
const logger = createLogger('debug') // Options: 'debug' | 'info' | 'warn' | 'error'
```

### Log Levels

| Level | Use Case | Default Output |
|-------|----------|----------------|
| `debug` | Development debugging | Only in development |
| `info` | General information | ✅ Always |
| `warn` | Warnings, non-critical issues | ✅ Always |
| `error` | Errors, failures | ✅ Always |

### Configuration

#### Environment Variables

```bash
# Set minimum log level (default: 'info')
LOG_LEVEL=debug  # Options: debug, info, warn, error
```

#### Production Logging

In production, the logger can be extended to use structured logging services:

1. **Vercel** - Automatic log aggregation
2. **Sentry** - Error monitoring (already configured)
3. **Datadog** - APM and logging
4. **CloudWatch** - AWS logging

To integrate with a logging service, modify `packages/core/src/core/utils/logger.ts`:

```typescript
export function createLogger(minLevel?: LogLevel): Logger {
  if (process.env.LOG_SERVICE === 'datadog') {
    return new DatadogLogger(minLevel)
  }
  // Default console logger
  return new ConsoleLogger(minLevel)
}
```

### Logging Best Practices

#### 1. Use Structured Data

✅ **Good:**
```typescript
logger.error('Failed to save document', {
  documentId: '123',
  collection: 'pages',
  userId: '456',
  error: error.message,
})
```

❌ **Bad:**
```typescript
logger.error(`Failed to save document ${documentId} for user ${userId}: ${error}`)
```

#### 2. Include Context

Always include relevant context:
- User ID (if available)
- Request ID (if available)
- Resource IDs
- Error details

#### 3. Appropriate Log Levels

- **debug**: Development debugging, verbose information
- **info**: Important events (user actions, successful operations)
- **warn**: Non-critical issues (rate limits, missing optional data)
- **error**: Failures, exceptions, critical issues

#### 4. Don't Log Sensitive Data

❌ **Never log:**
- Passwords
- Tokens (API keys, session tokens)
- Credit card numbers
- PII (personally identifiable information) unless necessary

#### 5. Performance Considerations

- Don't log in tight loops
- Use `debug` level for verbose logging
- Consider log volume in production

### Migration from console.log

#### Before
```typescript
console.log('User logged in:', userId)
console.error('Error:', error)
```

#### After
```typescript
import { logger } from '@revealui/core/utils/logger'

logger.info('User logged in', { userId })
logger.error('Error', { error: error.message })
```

---

## Error Handling

### Error Handling Patterns

#### 1. API Route Handlers

**Pattern:**
```typescript
import { NextRequest, NextResponse } from 'next/server'
import { logger } from '@revealui/core/utils/logger'

export async function GET(req: NextRequest) {
  try {
    // Business logic
    const data = await fetchData()
    return NextResponse.json({ data })
  } catch (error) {
    logger.error('Failed to fetch data', {
      error: error instanceof Error ? error.message : String(error),
      path: req.url,
    })

    // Return user-friendly error
    return NextResponse.json(
      { error: 'Failed to fetch data' },
      { status: 500 }
    )
  }
}
```

**Best Practices:**
- Always wrap business logic in try-catch
- Log errors with context
- Return user-friendly messages (don't expose internals)
- Use appropriate HTTP status codes

#### 2. Server Functions

**Pattern:**
```typescript
import { logger } from '@revealui/core/utils/logger'

export async function processDocument(id: string) {
  try {
    // Business logic
    return { success: true, data }
  } catch (error) {
    logger.error('Failed to process document', {
      documentId: id,
      error: error instanceof Error ? error.message : String(error),
    })

    // Re-throw or return error result
    throw error
  }
}
```

#### 3. Validation Errors

**Pattern:**
```typescript
import { z } from 'zod/v4'
import { logger } from '@revealui/core/utils/logger'

const schema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
})

export async function validateInput(data: unknown) {
  try {
    return schema.parse(data)
  } catch (error) {
    if (error instanceof z.ZodError) {
      logger.warn('Validation failed', {
        errors: error.errors,
      })
      // Return validation errors
      throw new Error(`Validation failed: ${error.errors.map(e => e.message).join(', ')}`)
    }
    throw error
  }
}
```

#### 4. Database Errors

**Pattern:**
```typescript
import { logger } from '@revealui/core/utils/logger'

export async function createUser(data: UserData) {
  try {
    return await db.insert(users).values(data)
  } catch (error) {
    // Check for specific database errors
    if (error instanceof Error && error.message.includes('unique')) {
      logger.warn('User already exists', { email: data.email })
      throw new Error('User already exists')
    }

    logger.error('Database error', {
      error: error instanceof Error ? error.message : String(error),
      operation: 'createUser',
    })

    throw new Error('Failed to create user')
  }
}
```

### Error Types

#### Application Errors

**Use for:**
- Business logic failures
- Validation failures
- Expected errors

```typescript
class ApplicationError extends Error {
  constructor(
    message: string,
    public code: string,
    public statusCode: number = 500,
  ) {
    super(message)
    this.name = 'ApplicationError'
  }
}

// Usage
throw new ApplicationError('User not found', 'USER_NOT_FOUND', 404)
```

#### Validation Errors

**Use for:**
- Input validation failures
- Schema validation failures

```typescript
class ValidationError extends Error {
  constructor(
    message: string,
    public field: string,
    public value: unknown,
  ) {
    super(message)
    this.name = 'ValidationError'
  }
}
```

### Error Response Format

#### Standard API Error Response

```typescript
interface ErrorResponse {
  error: string
  code?: string
  details?: unknown
}

// Example
{
  "error": "Validation failed",
  "code": "VALIDATION_ERROR",
  "details": {
    "field": "email",
    "message": "Invalid email format"
  }
}
```

### Error Handling Best Practices

#### 1. Don't Expose Internals

❌ **Bad:**
```typescript
catch (error) {
  return NextResponse.json({ error: error.message }, { status: 500 })
}
```

✅ **Good:**
```typescript
catch (error) {
  logger.error('Internal error', { error: error.message })
  return NextResponse.json(
    { error: 'An error occurred' },
    { status: 500 }
  )
}
```

#### 2. Include Context

✅ **Good:**
```typescript
logger.error('Failed to process payment', {
  userId: user.id,
  amount: payment.amount,
  error: error.message,
})
```

#### 3. Use Appropriate Status Codes

- `400` - Bad Request (validation errors)
- `401` - Unauthorized (authentication required)
- `403` - Forbidden (permission denied)
- `404` - Not Found (resource doesn't exist)
- `409` - Conflict (resource already exists)
- `500` - Internal Server Error (unexpected errors)

#### 4. Log Before Re-throwing

✅ **Good:**
```typescript
catch (error) {
  logger.error('Operation failed', { context })
  throw error  // Re-throw for error monitoring
}
```

---

## Error Monitoring

### Sentry Integration

Sentry is configured in `apps/cms/next.config.mjs` and will automatically capture errors.

**Manual Error Capture:**
```typescript
import * as Sentry from '@sentry/nextjs'

try {
  // Code that might fail
} catch (error) {
  Sentry.captureException(error, {
    tags: { component: 'user-service' },
    extra: { userId: '123' },
  })
  throw error
}
```

**Configuration:**
```bash
# Set Sentry DSN
NEXT_PUBLIC_SENTRY_DSN=https://your-sentry-dsn@sentry.io/project-id
SENTRY_ORG=your-org
SENTRY_PROJECT=your-project
```

### Integration with Error Monitoring

The logger works with error monitoring services:

```typescript
// Sentry integration (if configured)
import * as Sentry from '@sentry/nextjs'

logger.error('Failed operation', { context })
// Sentry will automatically capture this if error monitoring is configured
```

---

## Testing

```typescript
import { expect } from 'vitest'

it('should handle errors gracefully', async () => {
  await expect(functionThatThrows()).rejects.toThrow(ApplicationError)

  // Or check error response
  const response = await request('/api/endpoint')
  expect(response.status).toBe(500)
  expect(response.body.error).toBeDefined()
})
```

---

## Future Enhancements

- [ ] Custom error classes for specific error types
- [ ] Error recovery strategies
- [ ] Circuit breaker pattern for external services
- [ ] Retry logic with exponential backoff
- [ ] Error aggregation and analysis
- [ ] Structured logging service integration (Datadog, CloudWatch)
- [ ] Log aggregation configuration
- [ ] Request ID tracking
- [ ] Performance metrics logging
- [ ] Audit log integration

---

---

## Development Safeguards

### Overview

RevealUI uses a **simplified safeguard system** (20% of original complexity) focused on preventing catastrophic failures while allowing development freedom.

**Philosophy**: Simple safeguards that work > Complex safeguards that don't

### What We Protect Against

#### ✅ Import Disasters (Biome Configuration)
- **Protection**: Prevents automatic import reorganization that can break module loading
- **Mechanism**: `organizeImports: "off"` in Biome configuration
- **Impact**: Prevents ElectricSQL-style integration disasters
- **Maintenance**: Zero - configuration never changes

#### ✅ Build Failures (CI/CD Pipeline)
- **Protection**: Catches compilation, linting, testing, and build failures
- **Mechanism**: GitHub Actions PR validation
- **Coverage**: TypeScript, Biome, Vitest, Turborepo builds
- **Maintenance**: Automatic via CI

#### ✅ Security Vulnerabilities (Automated Audit)
- **Protection**: Detects security vulnerabilities in dependencies
- **Mechanism**: Existing `security-scan` CI job with comprehensive audit
- **Coverage**: All dependencies checked for high/critical vulnerabilities
- **Impact**: Prevents deployment of insecure code on main branch
- **Maintenance**: Automatic via existing CI

#### ✅ Code Quality Gates (Comprehensive)
- **Protection**: Console statements quality enforced, security vulnerabilities blocked
- **Mechanism**: CI pipeline with automated audit scripts and security scanning
- **Coverage**: Console statements (<50 target ✅), security vulnerabilities (high/crit blocked)
- **Impact**: Prevents merging low-quality or insecure code
- **Maintenance**: Automatic via CI with biome linting and audit scripts

#### ✅ Performance Monitoring (Build Success)
- **Protection**: All builds must succeed before merge
- **Mechanism**: Multiple CI build jobs (CMS, Web, packages) with biome linting
- **Coverage**: TypeScript compilation, bundling, testing, code quality
- **Impact**: Ensures deployable, well-formatted, type-safe code
- **Maintenance**: Automatic via CI with unified biome tooling

#### ⚠️ Package Structure Issues (Pre-commit Hooks)
- **Protection**: Prevents unauthorized package creation and extraction issues
- **Mechanism**: Existing guardrails (Biome formatting may have environment issues)
- **Status**: Core protection active, monitor environment issues
- **Maintenance**: Minimal - leverages existing systems

### What We Don't Protect Against (By Design)

#### ❌ Architectural Issues
- Complex integration design problems
- Database schema mismatches
- API contract violations

#### ❌ Performance Issues
- Memory leaks, slow queries, bundle size

#### ⚠️ Advanced Security Issues
- Supply chain attacks (basic dependency audit active, could be enhanced)
- Runtime security issues (not covered)

#### ❌ Performance Issues
- Runtime performance regressions (no monitoring)
- Memory leaks (no detection)
- Bundle size inflation (no automated monitoring)

#### ✅ Code Quality Issues (Now Protected)
- **Console statements**: <50 enforced via audit scripts (53 ✅ TARGET ACHIEVED - 61% reduction)
- **Security vulnerabilities**: High/critical blocked in CI, moderate monitored
- **Code formatting**: Biome enforced across all packages
- **Type safety**: TypeScript compilation required
- **Build quality**: Multi-stage CI validation

#### ⚠️ Remaining Quality Gaps (Address in Next Phase)
- **'any' types**: 188 remaining (needs systematic cleanup)
- **Bundle size**: No automated monitoring yet
- **Performance regression**: No automated testing yet
- **Test coverage**: No minimum coverage requirements

### Current System Status

#### ✅ **Active Protections**
- **Biome Config**: Prevents import disasters
- **CI/CD Pipeline**: Catches build failures, security issues, code quality
- **Security Audit**: Automated dependency vulnerability scanning (high/crit blocked)
- **Code Quality Gates**: Console statements <50 enforced, biome formatting required
- **Unified Tooling**: Single biome-based linting/formatting across all packages
- **Package Guardrails**: Prevents structural issues

#### ⚠️ **Temporarily Disabled**
- **Biome Formatting**: Skipped in pre-commit due to environment issues
- **Console Validation**: Too aggressive, blocks legitimate development

#### 🗑️ **Removed (Over-engineered)**
- Complex validation scripts (8 scripts → 0)
- Aggressive console policing
- TypeScript 'any' type blocking
- Related test enforcement

### Technical Debt Status

**Known Issues** (intentionally not automated):
- **138 console statements** in production code (target: <50)
- **188 'any' types** across packages (regression)
- **ElectricSQL dead code** polluting codebase (105+ lines)
- **No security vulnerability scanning**
- **No performance monitoring or budgets**

**Cleanup Approach**: Manual, prioritized by impact, not automated blocking.

### Maintenance Philosophy

- **Minimal maintenance** for basic safeguards (build failures, import disasters)
- **Broken systems need fixing** (Biome formatting in pre-commit)
- **Honest assessment required** - no false promises about protection scope
- **Balance needed** between developer freedom and code quality

### Future Safeguard Additions

**Criteria for any new safeguards:**
1. **Zero false positives** (never blocks legitimate work)
2. **Zero maintenance** (works forever)
3. **Genuine value** (prevents real disasters)
4. **Non-blocking** (CI alerts, not pre-commit failures)

**Current candidates: NONE** - Existing safeguards are sufficient.

---

## Related Documentation

- [CODE_STYLE.md](./CODE_STYLE.md) - Code style and formatting standards
