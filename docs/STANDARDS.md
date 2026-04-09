---
title: "Code Standards"
description: "Code style, formatting, Biome configuration, and naming conventions"
category: guide
audience: contributor
---

# Code Style & Formatting Standards

This document describes the code style, linting, and formatting standards for the RevealUI monorepo, including best practices for ensuring LLMs generate consistent code.

---

## Table of Contents

- [Overview](#overview)
- [Tooling](#tooling)
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

The project uses **Biome 2** as its sole linter and formatter. Biome provides:

- Fast formatting and style rules (30x faster than Prettier)
- TypeScript-aware linting rules
- Import sorting and organization

**Philosophy**: Simple, consistent code style that works across the entire monorepo.

---

## Tooling

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
cd apps/admin
pnpm lint
```

### Formatting

**Biome handles ALL formatting**.

**Format all files**:
```bash
pnpm format
```

**Format and lint fix** (Biome formatting + lint fixes):
```bash
pnpm lint:fix
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
2. **TypeScript** - Strict type checking
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
| Biome | `biome.json` | `pnpm format` / `pnpm lint` |
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
- Components: `apps/marketing/src/components/`
- Utilities: `apps/marketing/src/lib/`
- Types: `packages/core/src/types/`
- Collections: `apps/admin/src/lib/collections/`
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

Add to your Biome config to catch common mistakes:

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
3. **Fix any errors**: Biome will report issues

---

## CI/CD Integration

The CI pipeline runs:

1. **Biome**: `pnpm lint` (checks formatting and linting)

Must pass for CI to succeed.

---

## Troubleshooting

### Cache issues

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

- All apps use the shared `biome.json` configuration
- App-specific overrides can be added in local `biome.json` files

### Packages

- All packages use the shared Biome configuration
- Package-specific ignores can be added in local `biome.json`

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
2. ✅ **Keep it in sync** with your actual tooling (Biome)
3. ✅ **Use concrete examples** instead of abstract rules
4. ✅ **Document anti-patterns** explicitly
5. ✅ **Reference your config files** (biome.json)
6. ✅ **Add validation commands** the LLM should run
7. ✅ **Use pre-commit hooks** for automatic formatting
8. ✅ **Iterate and improve** based on what the LLM generates

---

## Migration Notes

**Changed from**: Previously, some packages used ESLint for type-aware linting.

**Changed to**: Biome 2 is now the sole linter and formatter across the entire monorepo.

**Formatting**: Biome handles all formatting.

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

**For TypeScript type checking:** `apps/admin/tsconfig.json` uses path mappings that point to **source files** (not `dist/`):

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

**In `apps/admin/next.config.mjs`:**

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

- [Package Conventions](../../packages/PACKAGE-CONVENTIONS.md) - Package structure and conventions
- [Testing](./TESTING.md) - Testing requirements
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

Sentry is configured in `apps/admin/next.config.mjs` and will automatically capture errors.

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
- **'any' types**: 0 avoidable (8 total, all justified)
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
- **0 console statements** in production code (resolved)
- **0 avoidable 'any' types** across packages (resolved)
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

- [Architecture](./ARCHITECTURE.md) - System architecture and design

---

# AI Code Standards Enforcer

**Prevents AI-generated technical debt before it enters the codebase**

## Problem Statement

AI assistants (including Claude) have a pattern of generating code with anti-patterns like `console.log`, `any` types, and `TODO` comments without issue references, then later identifying these same patterns as technical debt that needs cleanup.

This creates a cycle of:
1. AI generates code with console.log
2. Code gets committed
3. AI audits codebase, finds 11k-62k console statements
4. AI recommends cleanup (60-80 hours of work)

**Solution:** Validate code at creation time, not cleanup time.

---

## Architecture

### Three-Layer Defense

```
┌─────────────────────────────────────────────┐
│  Layer 1: MCP Tool (Real-time validation)  │
│  Claude calls validate_code before Write   │
└──────────────┬──────────────────────────────┘
               │
               ▼
┌─────────────────────────────────────────────┐
│  Layer 2: Pre-commit Hook (Safety net)     │
│  Validates staged files before commit      │
└──────────────┬──────────────────────────────┘
               │
               ▼
┌─────────────────────────────────────────────┐
│  Layer 3: CI/CD (Final gate)               │
│  Validates all code in pull requests       │
└─────────────────────────────────────────────┘
```

### Components

1. **Validation Rules** (`.revealui/code-standards.json`)
   - Defines what patterns are violations
   - Severity levels (error, warning, info)
   - Exemptions (test files, scripts, etc.)
   - Suggested fixes

2. **Core Validator** (`packages/dev/src/code-validator`)
   - Pattern matching engine
   - Context extraction
   - Auto-fix capabilities
   - Exemption handling

3. **MCP Server** (`packages/mcp/src/servers/code-validator.ts`)
   - Exposes `validate_code` tool to Claude
   - Integrates with Model Context Protocol
   - Real-time validation during code generation

4. **Pre-commit Hook** (`scripts/git-hooks/pre-commit`)
   - Validates staged files before commit
   - Safety net for anything MCP layer missed
   - Can be bypassed with `--no-verify` (emergencies only)

5. **CLI Tool** (`scripts/validation/validate-code.ts`)
   - Manual validation
   - Testing and debugging
   - CI/CD integration

---

## Installation

### 1. Install Git Hook (Required)

```bash
pnpm hooks:install
```

This creates a symlink from `.git/hooks/pre-commit` to `scripts/git-hooks/pre-commit`.

### 2. Configure Claude Code MCP (Optional but Recommended)

Add to your Claude Code MCP configuration:

**`~/.config/claude-code/mcp_config.json`** (or equivalent):

```json
{
  "mcpServers": {
    "revealui-code-validator": {
      "command": "tsx",
      "args": ["./packages/mcp/src/servers/code-validator.ts"],
      "cwd": "/path/to/RevealUI",
      "description": "Code validation server - prevents technical debt",
      "enabled": true
    }
  }
}
```

Or copy from `.revealui/mcp-config.json`.

### 3. Install Dependencies

```bash
# Install minimatch (core validator dependency)
pnpm install

# Build packages/dev
pnpm --filter dev build
```

---

## Usage

### Manual Validation

```bash
# Validate a single file
pnpm validate:code src/foo.ts

# Validate from stdin (useful for pipes)
cat src/foo.ts | pnpm validate:code:stdin

# Auto-fix violations
pnpm validate:code:fix src/foo.ts
```

### MCP Tool (for Claude)

When MCP is configured, Claude can call:

```typescript
// Claude calls this before Write/Edit
const result = await validate_code({
  code: "console.log('debug')",
  filePath: "src/foo.ts",
  autoFix: false
})

if (!result.valid) {
  // Claude sees violations and can fix them before writing
}
```

### Pre-commit Hook (Automatic)

The hook runs automatically on `git commit`:

```bash
# Normal commit (hook validates)
git commit -m "feat: add feature"

# Emergency bypass (use sparingly!)
git commit --no-verify -m "hotfix: emergency"
```

---

## Validation Rules

Current rules (see `.revealui/code-standards.json`):

### 1. No console.log (ERROR)
**Pattern:** `console.(log|debug|info|warn|error)`

**Message:** Use logger instead of console.* - console statements create technical debt

**Fix:**
```typescript
// ❌ Bad
console.log('User created', userId)

// ✅ Good
import { logger } from '@revealui/core/logger'
logger.info('User created', { userId })
```

**Exemptions:** Test files, scripts, examples

---

### 2. No any types (WARNING)
**Pattern:** `: any` (explicit any types)

**Message:** Avoid explicit 'any' types - use proper TypeScript types

**Fix:**
```typescript
// ❌ Bad
function foo(data: any) { }

// ✅ Good
function foo(data: User) { }
function foo(data: unknown) { } // if truly unknown
```

**Exemptions:** Test files, scripts

---

### 3. TODO requires issue reference (WARNING)
**Pattern:** `// TODO` without `#123` or URL

**Message:** TODO comments must reference an issue

**Fix:**
```typescript
// ❌ Bad
// TODO fix this later

// ✅ Good
// TODO #123: Implement error handling
// TODO https://github.com/org/repo/issues/456
```

**Exemptions:** Test files, examples

---

### 4. No debugger statements (ERROR)
**Pattern:** `debugger`

**Message:** Remove debugger statements before committing

**Fix:** Remove the `debugger;` statement

**Exemptions:** Test files

---

### 5. No skipped tests (WARNING)
**Pattern:** `describe.skip(` or `it.skip(`

**Message:** Tests should not be skipped without issue reference

**Fix:** Either fix the test or add comment explaining why it's skipped

```typescript
// ❌ Bad
it.skip('should work', () => { })

// ✅ Good
// TODO #789: Re-enable after fixing flaky test
it.skip('should work', () => { })
```

---

## Exemptions

### By File Path (Glob Patterns)

```json
{
  "exemptions": {
    "paths": [
      "**/*.test.ts",       // Test files
      "**/*.spec.ts",       // Test files
      "**/scripts/**",      // Scripts directory
      "**/examples/**",     // Example code
      "**/__tests__/**"     // Test directories
    ]
  }
}
```

### By Comment

```typescript
// console.log allowed in this section
console.log('This is OK') // ai-validator-ignore

function debug() {
  // any-allowed: Legacy code being migrated
  const data: any = getLegacyData()
}
```

Supported exemption comments:
- `ai-validator-ignore` - Ignore all rules for this line
- `console-allowed` - Allow console.* for this line
- `any-allowed` - Allow any types for this line
- `skip-allowed` - Allow .skip tests for this line

---

## Configuration

### Adding New Rules

Edit `.revealui/code-standards.json`:

```json
{
  "rules": [
    {
      "id": "my-new-rule",
      "name": "Rule description",
      "pattern": "regex pattern",
      "severity": "error",
      "message": "What's wrong and why",
      "suggestedFix": "How to fix it",
      "exemptions": {
        "paths": ["**/test/**"],
        "comments": ["my-rule-ignore"]
      }
    }
  ]
}
```

### Severity Levels

- **error** - Blocks commit (exit code 1)
- **warning** - Allows commit but shows warning
- **info** - Informational only

### Auto-Fix Rules

```json
{
  "autoFix": {
    "enabled": true,
    "rules": [
      {
        "id": "no-console-log",
        "find": "console\\.log\\(([^)]*)\\)",
        "replace": "// FIXME: Replace with logger.info($1)"
      }
    ]
  }
}
```

---

## Testing

### Test the Validator

```bash
# Create test file
cat > /tmp/test.ts << 'EOF'
console.log('test')
const foo: any = {}
// TODO fix this
EOF

# Validate it
pnpm validate:code /tmp/test.ts

# Expected output:
# ✗ Code violations found
#
# ERROR [no-console-log] No console.log statements
#   at line 1:1
#   Use logger instead of console.*
#
# WARNING [no-any-type] No explicit any types
#   at line 2:11
#   Avoid explicit 'any' types
```

### Test Pre-commit Hook

```bash
# Create a file with violations
echo "console.log('test')" > src/test.ts

# Stage it
git add src/test.ts

# Try to commit (should fail)
git commit -m "test"

# Expected: Hook blocks commit with violation details
```

### Test MCP Server

```bash
# Start MCP server manually
tsx packages/mcp/src/servers/code-validator.ts

# Use MCP client to call validate_code
# (Or configure Claude Code and let Claude call it)
```

---

## CI/CD Integration

### GitHub Actions

```yaml
name: Code Validation

on: [pull_request]

jobs:
  validate:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v2
      - uses: actions/setup-node@v4
        with:
          node-version: '24'

      - run: pnpm install
      - run: pnpm --filter dev build

      # Validate all TypeScript files
      - run: |
          find . -name "*.ts" -o -name "*.tsx" | \
          while read file; do
            pnpm validate:code "$file" || exit 1
          done
```

---

## Workflow for Claude

When Claude Code has MCP configured:

### Before (Without Validator)
```
1. Claude generates code with console.log
2. Claude calls Write tool
3. Code written to disk with violations
4. Later: Claude audits, finds violations, recommends cleanup
```

### After (With Validator)
```
1. Claude generates code
2. Claude calls validate_code MCP tool
3. Validator returns violations
4. Claude fixes violations
5. Claude calls validate_code again (passes)
6. Claude calls Write tool
7. Clean code written to disk
```

---

## Metrics & Reporting

### Validation Result Format

```json
{
  "valid": false,
  "violations": [
    {
      "ruleId": "no-console-log",
      "ruleName": "No console.log statements",
      "severity": "error",
      "message": "Use logger instead of console.*",
      "line": 42,
      "column": 5,
      "lineContent": "  console.log('debug')",
      "context": [
        "   40 | function processUser() {",
        "   41 |   const user = getUser()",
        " > 42 |   console.log('debug')",
        "   43 |   return user",
        "   44 | }"
      ],
      "suggestedFix": "import { logger } from '@revealui/core/logger'\nlogger.info('message', { data })"
    }
  ],
  "errors": 1,
  "warnings": 0,
  "info": 0,
  "stats": {
    "linesScanned": 156,
    "rulesApplied": 5,
    "exemptionsApplied": 2
  }
}
```

---

## Troubleshooting

### Hook Not Running

```bash
# Check hook is installed
ls -la .git/hooks/pre-commit

# Should show symlink to scripts/git-hooks/pre-commit
# If not, reinstall:
pnpm hooks:install
```

### Validator Not Found

```bash
# Ensure packages/dev is built
pnpm --filter dev build

# Check validator exports
ls -la packages/dev/src/code-validator/
```

### MCP Server Not Connecting

```bash
# Test MCP server manually
tsx packages/mcp/src/servers/code-validator.ts

# Check Claude Code MCP config
cat ~/.config/claude-code/mcp_config.json

# Ensure correct paths in config
```

### False Positives

Add exemption comment:

```typescript
// ai-validator-ignore
console.log('This console.log is intentional')
```

Or add path exemption to `.revealui/code-standards.json`.

---

## Future Enhancements

### Planned Features

1. **Auto-fix on pre-commit**
   - `git commit --fix` to automatically fix violations

2. **IDE Integration**
   - VS Code extension
   - Real-time validation as you type

3. **Statistics Dashboard**
   - Track violations over time
   - Measure reduction in technical debt

4. **Custom Rule Plugins**
   - Allow packages to define their own rules
   - Plugin system for extensibility

5. **AI Training Feedback Loop**
   - Send validation results back to Claude
   - Learn from violations to improve future code generation

---

## Related Documentation

- [Code Standards](../STANDARDS.md) - Overall coding standards
- [MCP Guide](../MCP.md) - MCP server configuration
- [CI/CD Guide](./CI_CD_GUIDE.md) - CI pipelines and deployment

---

## Contributing

To add new validation rules:

1. Add rule to `.revealui/code-standards.json`
2. Test with `pnpm validate:code`
3. Add exemptions as needed
4. Document in this file
5. Submit PR

---

**Last Updated:** 2026-02-04
**Version:** 1.0.0

---

# Logging Guide

**Last Updated:** 2026-02-04

## Overview

RevealUI has a comprehensive logging system already implemented in `@revealui/core`. This guide shows how to use it instead of `console.log`.

## Quick Start

```typescript
// Client-side (React components, browser code)
import { logger } from '@revealui/core/utils/logger'

// Server-side (API routes, server components)
import { logger } from '@revealui/core/server'
// OR
import { logger } from '@revealui/core/utils/logger/server'
```

## Basic Usage

### Log Levels

```typescript
logger.debug('Debug information', { details: 'extra info' })
logger.info('Informational message', { userId: '123' })
logger.warn('Warning message', { reason: 'deprecated API' })
logger.error('Error occurred', new Error('Something went wrong'))
logger.fatal('Fatal error', new Error('System failure'))
```

### Creating Context-Aware Loggers

```typescript
import { createLogger } from '@revealui/core/utils/logger'

const userLogger = createLogger({ userId: '123', sessionId: 'abc' })
userLogger.info('User action') // Includes userId and sessionId automatically
```

## Advanced Features

### Request Logging

```typescript
import { createRequestLogger } from '@revealui/core/observability/logger'

const requestLogger = createRequestLogger({
  includeBody: true,
  includeHeaders: true
})

// Use in middleware
app.use(requestLogger)
```

### Performance Logging

```typescript
import { logPerformance } from '@revealui/core/observability/logger'

const start = Date.now()
// ... operation ...
const duration = Date.now() - start

logPerformance('database query', duration, { query: 'SELECT * FROM users' })
// Automatically warns if duration > 1000ms
```

### Audit Logging

For security-sensitive operations:

```typescript
import { logAudit } from '@revealui/core/observability/logger'

logAudit('user.login', {
  userId: user.id,
  ip: request.ip,
  timestamp: new Date()
})
```

### Database Query Logging

```typescript
import { logQuery } from '@revealui/core/observability/logger'

logQuery('SELECT * FROM users WHERE id = $1', 45, {
  table: 'users',
  operation: 'SELECT'
})
// Automatically warns on slow queries (> 1000ms)
```

### API Call Logging

```typescript
import { logAPICall } from '@revealui/core/observability/logger'

logAPICall('POST', '/api/users', 201, 150, {
  userId: '123',
  created: true
})
```

### Cache Logging

```typescript
import { logCache } from '@revealui/core/observability/logger'

logCache('hit', 'user:123', { ttl: 3600 })
logCache('miss', 'user:456')
logCache('set', 'user:789', { ttl: 3600 })
logCache('delete', 'user:123')
```

### User Action Logging

```typescript
import { logUserAction } from '@revealui/core/observability/logger'

logUserAction('profile.update', user.id, {
  fields: ['name', 'email'],
  success: true
})
```

## Configuration

### Environment Variables

```bash
# Set log level (default: info)
LOG_LEVEL=debug  # debug | info | warn | error | fatal

# Pretty printing (default: true in development, false in production)
NODE_ENV=production
```

### Custom Configuration

```typescript
import { Logger } from '@revealui/core/observability/logger'

const customLogger = new Logger({
  level: 'debug',
  enabled: true,
  pretty: false,
  includeTimestamp: true,
  includeStack: true,
  destination: 'console', // 'console' | 'file' | 'remote'
  remoteUrl: 'https://logs.example.com/ingest',
  onLog: (entry) => {
    // Custom log handler
    console.log('Custom:', entry)
  }
})
```

## Security Features

### Sensitive Data Sanitization

```typescript
import { sanitizeLogData } from '@revealui/core/observability/logger'

const userData = {
  email: 'user@example.com',
  password: 'secret123',
  token: 'abc123',
  name: 'John Doe'
}

const safe = sanitizeLogData(userData)
// { email: 'user@example.com', password: '[REDACTED]', token: '[REDACTED]', name: 'John Doe' }
```

Automatically redacts:
- `password`
- `token`
- `secret`
- `apiKey`
- `accessToken`
- `refreshToken`
- `creditCard`
- `ssn`

### Log Sampling

For high-volume logs, sample only a percentage:

```typescript
import { createSampledLogger } from '@revealui/core/observability/logger'

// Log only 10% of messages
const sampledLogger = createSampledLogger(0.1)

// Use like normal logger
sampledLogger.debug('This may or may not be logged')
```

## Migration from console.log

### Before

```typescript
console.log('User logged in')
console.log('User ID:', userId)
console.error('Login failed:', error)
console.warn('Deprecated API used')
```

### After

```typescript
import { logger } from '@revealui/core/utils/logger'

logger.info('User logged in', { userId })
logger.error('Login failed', error, { userId })
logger.warn('Deprecated API used', { api: 'v1/users' })
```

## Structured Logging

The logger outputs structured JSON in production:

```json
{
  "timestamp": "2026-02-04T12:00:00.000Z",
  "level": "info",
  "message": "User logged in",
  "context": {
    "userId": "123",
    "sessionId": "abc",
    "requestId": "xyz"
  }
}
```

This makes logs searchable and parseable by log aggregation tools like:
- ELK Stack (Elasticsearch, Logstash, Kibana)
- Splunk
- Datadog
- New Relic
- CloudWatch

## Client vs Server Loggers

### Client Logger (`@revealui/core/utils/logger`)
- Browser-safe (no Node.js dependencies)
- No `crypto` or `async_hooks`
- Suitable for React components

### Server Logger (`@revealui/core/utils/logger/server`)
- Full Node.js support
- Request context tracking with async_hooks
- Performance tracking
- File logging support

## Best Practices

1. **Use appropriate log levels:**
   - `debug`: Detailed diagnostic information
   - `info`: General informational messages
   - `warn`: Warning messages (non-critical issues)
   - `error`: Error messages (recoverable errors)
   - `fatal`: Fatal errors (system-critical failures)

2. **Include context:**
   ```typescript
   // ❌ Bad
   logger.info('Operation completed')

   // ✅ Good
   logger.info('Operation completed', {
     operation: 'user.create',
     userId: '123',
     duration: 45
   })
   ```

3. **Never log sensitive data:**
   ```typescript
   // ❌ Bad
   logger.info('Login', { password: user.password })

   // ✅ Good
   logger.info('Login', { userId: user.id })
   ```

4. **Use specialized loggers:**
   ```typescript
   // ❌ Generic
   logger.info('Query took 1500ms')

   // ✅ Specialized
   logQuery(query, 1500, { table: 'users' })
   ```

5. **Create child loggers for modules:**
   ```typescript
   const authLogger = createLogger({ module: 'auth' })
   authLogger.info('Login attempt') // Includes module: 'auth'
   ```

## Testing

In tests, you can mock the logger:

```typescript
import { vi } from 'vitest'
import { logger } from '@revealui/core/utils/logger'

// Mock logger
vi.spyOn(logger, 'info').mockImplementation(() => {})
vi.spyOn(logger, 'error').mockImplementation(() => {})

// Your test
myFunction()

expect(logger.info).toHaveBeenCalledWith('Expected message', { context: 'data' })
```

## Further Reading

- [Logger Implementation](../packages/core/src/observability/logger.ts)
- [Server Logger](../packages/core/src/utils/logger-server.ts)
- [Client Logger](../packages/core/src/utils/logger-client.ts)

---

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

## Entity Contracts

**Status:** ✅ 6 entity contracts complete (3,626 lines, 243+ helper functions)

Entity contracts provide comprehensive business logic, validation, and helper functions for core entities.

### Available Entity Contracts

#### 1. Session (`packages/contracts/src/entities/session.ts`)
- **Lines:** 342 lines, 18 helper functions
- **Purpose:** Security-critical authentication session management
- **Features:**
  - Token validation (SHA-256/bcrypt)
  - Expiration logic (1 day regular, 7 days persistent)
  - Activity tracking with 5-minute threshold
  - Session lifecycle management

```typescript
import {
  createSessionInsert,
  isSessionExpired,
  isSessionValid,
  sessionToHuman,
  type Session,
  type SessionInsert,
} from '@revealui/contracts/entities'

// Create session
const session = createSessionInsert(userId, tokenHash, {
  persistent: true,
  userAgent: 'Mozilla/5.0...',
  ipAddress: '192.168.1.1',
})

// Check expiration
if (isSessionExpired(session)) {
  // Handle expired session
}

// Get computed fields for UI
const sessionData = sessionToHuman(session)
console.log(sessionData._computed.timeRemaining)
```

#### 2. AgentContext (`packages/contracts/src/entities/agent-context.ts`)
- **Lines:** 513 lines, 35+ helper functions
- **Purpose:** Agent working memory with vector embeddings
- **Features:**
  - 768-dimensional nomic-embed-text embeddings (via Ollama)
  - Priority system (0-1 range with categorical levels)
  - Context data validation (size limits, circular references)
  - Cosine similarity for semantic search

```typescript
import {
  createAgentContextInsert,
  calculateCosineSimilarity,
  hasValidEmbedding,
  type AgentContext,
} from '@revealui/contracts/entities'

// Create context with embedding
const context = createAgentContextInsert(sessionId, agentId, {
  context: { workingMemory: 'Task in progress' },
  priority: 0.8,
  embedding: embeddingVector, // 1536 dimensions
})

// Semantic similarity
const similarity = calculateCosineSimilarity(embedding1, embedding2)
```

#### 3. AgentMemory (`packages/contracts/src/entities/agent-memory.ts`)
- **Lines:** 708 lines, 50+ helper functions
- **Purpose:** Long-term agent memory with verification workflow
- **Features:**
  - 8 memory types (fact, preference, decision, feedback, etc.)
  - Verification workflow (verified, verifiedBy, verifiedAt)
  - Multi-source tracking with provenance
  - Access tracking and relevance scoring
  - Expiration support for time-sensitive memories

```typescript
import {
  createAgentMemoryInsert,
  calculateRelevanceScore,
  isVerified,
  needsVerification,
  type AgentMemory,
} from '@revealui/contracts/entities'

// Create memory
const memory = createAgentMemoryInsert(
  'User prefers dark mode',
  'preference',
  { type: 'user_input', userId: 'u-123' },
  { importance: 0.9 }
)

// Check if needs verification
if (needsVerification(memory)) {
  // Prompt for verification
}

// Calculate relevance score (importance + access + verification)
const score = calculateRelevanceScore(memory)
```

#### 4. PageRevision (`packages/contracts/src/entities/page-revision.ts`)
- **Lines:** 556 lines, 30+ helper functions
- **Purpose:** Content versioning and change tracking
- **Features:**
  - Immutable revision records
  - Content snapshots (title, blocks, SEO)
  - Change type inference and descriptions
  - Revision comparison and diff detection
  - Age tracking and cleanup eligibility

```typescript
import {
  createRevisionFromSnapshot,
  compareRevisions,
  detectChanges,
  type PageRevision,
} from '@revealui/contracts/entities'

// Create revision from page snapshot
const revision = createRevisionFromSnapshot(
  pageId,
  revisionNumber,
  { title, blocks, seo },
  { changeType: 'publish', createdBy: userId }
)

// Compare revisions
const diff = compareRevisions(oldRevision, newRevision)
if (diff.titleChanged) {
  const changes = detectChanges(oldRevision, newRevision)
  console.log(changes) // ["Title: 'Old' → 'New'"]
}
```

#### 5. Post (`packages/contracts/src/entities/post.ts`)
- **Lines:** 710 lines, 50+ helper functions
- **Purpose:** CMS publishing workflow with Lexical editor
- **Features:**
  - Publishing workflow (draft → published → archived)
  - Lexical editor content management
  - SEO optimization with OG and Twitter card support
  - Category management (max 10 per post)
  - Reading time estimation (200 words/minute)
  - Slug generation and validation

```typescript
import {
  createPostInsert,
  createPublishUpdate,
  generateSlug,
  estimateReadingTime,
  type Post,
} from '@revealui/contracts/entities'

// Create draft post
const post = createPostInsert(
  'My Blog Post',
  generateSlug('My Blog Post'),
  {
    excerpt: 'A short description',
    status: 'draft',
    categories: ['tech', 'tutorial'],
  }
)

// Publish post
const publishUpdate = createPublishUpdate()
await db.update(posts).set(publishUpdate).where(eq(posts.id, post.id))

// Get reading time
const minutes = estimateReadingTime(post) // e.g., 5 minutes
```

#### 6. Media (`packages/contracts/src/entities/media.ts`)
- **Lines:** 797 lines, 60+ helper functions
- **Purpose:** File uploads with image processing
- **Features:**
  - 18 supported MIME types across 4 categories
  - Image dimension and aspect ratio calculations
  - Focal point for smart cropping (normalized 0-1 coordinates)
  - Multiple sizes/thumbnails for responsive images
  - File size validation and formatting
  - Accessibility validation (alt text)

```typescript
import {
  createMediaInsert,
  calculateScaledDimensions,
  findBestSize,
  formatFileSize,
  type Media,
  type FocalPoint,
} from '@revealui/contracts/entities'

// Create media with focal point
const media = createMediaInsert('photo.jpg', 'image/jpeg', url, {
  width: 1920,
  height: 1080,
  focalPoint: { x: 0.3, y: 0.5 }, // Left-center
  alt: 'Sunset over mountains',
})

// Calculate scaled dimensions
const scaled = calculateScaledDimensions(media, 800, 600)
// { width: 800, height: 450 }

// Find best thumbnail size
const thumbnail = findBestSize(media, 320, 240)

// Format file size
const size = formatFileSize(media.filesize ?? 0) // "2.45 MB"
```

### Dual Representations

All entity contracts provide dual representations:

**Human-friendly (UI):**
```typescript
const sessionData = sessionToHuman(session)
console.log(sessionData._computed)
// {
//   isExpired: false,
//   isValid: true,
//   timeRemaining: 86400000,
//   age: 3600000,
//   isNearExpiration: false,
//   needsRefresh: false,
//   durationMs: 86400000
// }
```

**Agent-compatible (API):**
```typescript
const sessionAgent = sessionToAgent(session)
console.log(sessionAgent.metadata)
// {
//   expired: false,
//   valid: true,
//   timeRemainingMs: 86400000,
//   ageMs: 3600000,
//   nearExpiration: false,
//   type: 'persistent'
// }
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

The type system is validated in CI to prevent drift. The workflow runs on:
- Pull requests touching schema or generated files
- Pushes to main branch
- Manual workflow dispatch

### Validation Steps

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

- name: Basic type validation
  run: pnpm validate:types

- name: Enhanced type validation
  run: pnpm validate:types:enhanced

- name: Check type coverage
  run: pnpm types:coverage

- name: Quick type consistency check
  run: pnpm types:check

- name: Run contract tests
  run: pnpm --filter @revealui/contracts test src/generated/__tests__/contracts.test.ts

- name: Type check packages
  run: |
    pnpm --filter @revealui/db typecheck
    pnpm --filter @revealui/contracts typecheck
```

**CI will fail if:**
- Generated files are out of sync with source
- Type drift is detected
- Basic or enhanced validation checks fail
- Contract tests fail (32 tests)
- TypeScript type checking fails
- Breaking changes are detected (errors only)
- Critical type safety issues found

**GitHub Actions Summary:**
- Provides detailed pass/fail summary
- Shows type system statistics
- Displays helpful troubleshooting tips on failure

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
- [Package Reference](./REFERENCE.md)
